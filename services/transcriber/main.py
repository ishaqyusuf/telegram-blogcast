"""
Al-Ghurobaa Local Arabic Transcriber
FastAPI service using MLX Whisper on Apple Silicon.
"""

import hashlib
import json
import logging
import mimetypes
import os
import subprocess
import threading
import time
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger("transcriber")

# ── Config ──────────────────────────────────────────────────────────────────────

HOST = os.getenv("TRANSCRIBER_HOST", "0.0.0.0")
PORT = int(os.getenv("TRANSCRIBER_PORT", "8787"))
WHISPER_MODEL = os.getenv("WHISPER_MODEL", "mlx-community/whisper-large-v3-turbo")
DEFAULT_LANGUAGE = os.getenv("DEFAULT_LANGUAGE", "ar")
CACHE_DIR = Path(os.getenv("CACHE_DIR", "./cache"))
MAX_DOWNLOAD_MB = int(os.getenv("MAX_DOWNLOAD_MB", "500"))
REQUEST_TIMEOUT_SECONDS = int(os.getenv("REQUEST_TIMEOUT_SECONDS", "60"))
ALLOWED_HOSTS = os.getenv("ALLOWED_AUDIO_HOSTS", "*")

AUDIO_CACHE = CACHE_DIR / "audio"
CLIP_CACHE = CACHE_DIR / "clips"
TRANSCRIPT_CACHE = CACHE_DIR / "transcripts"

AUDIO_CACHE.mkdir(parents=True, exist_ok=True)
CLIP_CACHE.mkdir(parents=True, exist_ok=True)
TRANSCRIPT_CACHE.mkdir(parents=True, exist_ok=True)

# ── Inference lock ──────────────────────────────────────────────────────────────

_inference_lock = threading.Lock()

# ── App ─────────────────────────────────────────────────────────────────────────

app = FastAPI(title="Al-Ghurobaa Local Transcriber")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Models ──────────────────────────────────────────────────────────────────────

class TranscribeRequest(BaseModel):
    audioUrl: str = Field(..., description="HTTP(S) URL of the audio file")
    from_: Optional[float] = Field(None, alias="from", ge=0)
    to: Optional[float] = Field(None, gt=0)
    language: str = Field(default=DEFAULT_LANGUAGE)
    force: bool = Field(default=False)
    wordTimestamps: bool = Field(default=False)

    @field_validator("to")
    @classmethod
    def validate_range(cls, v, info):
        from_val = info.data.get("from_")
        if from_val is not None and v is not None and v <= from_val:
            raise ValueError("'to' must be greater than 'from'")
        return v

    class Config:
        populate_by_name = True


class SegmentOut(BaseModel):
    start: float
    end: float
    text: str


class TranscribeResponse(BaseModel):
    ok: bool
    cached: bool = False
    cacheKey: str = ""
    audioUrl: str = ""
    from_: Optional[float] = Field(None, alias="from")
    to: Optional[float] = None
    language: str = ""
    model: str = ""
    text: str = ""
    segments: list[SegmentOut] = []
    durationSeconds: float = 0
    processingSeconds: float = 0

    class Config:
        populate_by_name = True


class ErrorResponse(BaseModel):
    ok: bool = False
    error: dict


# ── URL validation ──────────────────────────────────────────────────────────────

def validate_audio_url(url: str) -> str:
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise HTTPException(
            status_code=400,
            detail={"ok": False, "error": {"code": "INVALID_URL", "message": "Only http/https URLs are allowed"}},
        )
    if ALLOWED_HOSTS != "*":
        if parsed.hostname not in [h.strip() for h in ALLOWED_HOSTS.split(",")]:
            raise HTTPException(
                status_code=400,
                detail={"ok": False, "error": {"code": "HOST_NOT_ALLOWED", "message": f"Host {parsed.hostname} is not in ALLOWED_AUDIO_HOSTS"}},
            )
    return url


# ── Cache key ───────────────────────────────────────────────────────────────────

def make_cache_key(
    audio_url: str,
    from_sec: Optional[float],
    to_sec: Optional[float],
    language: str,
    model: str,
    word_timestamps: bool,
) -> str:
    raw = f"{audio_url}|{from_sec}|{to_sec}|{language}|{model}|{word_timestamps}"
    return hashlib.sha256(raw.encode()).hexdigest()


# ── Download ────────────────────────────────────────────────────────────────────

def guess_extension(url: str, content_type: Optional[str] = None) -> str:
    path = urlparse(url).path
    ext = os.path.splitext(path)[1].lower()
    if ext in (".mp3", ".wav", ".ogg", ".flac", ".m4a", ".aac", ".opus", ".webm", ".mp4"):
        return ext
    if content_type:
        ext = mimetypes.guess_extension(content_type.split(";")[0].strip())
        if ext:
            return ext
    return ".mp3"


def download_audio(audio_url: str, dest_path: Path) -> Path:
    max_bytes = MAX_DOWNLOAD_MB * 1024 * 1024
    downloaded = 0

    try:
        with httpx.stream("GET", audio_url, timeout=REQUEST_TIMEOUT_SECONDS, follow_redirects=True) as response:
            response.raise_for_status()
            content_type = response.headers.get("content-type")
            ext = guess_extension(audio_url, content_type)
            dest_path = dest_path.with_suffix(ext)

            with open(dest_path, "wb") as f:
                for chunk in response.iter_bytes(chunk_size=8192):
                    f.write(chunk)
                    downloaded += len(chunk)
                    if downloaded > max_bytes:
                        raise HTTPException(
                            status_code=413,
                            detail={"ok": False, "error": {"code": "DOWNLOAD_TOO_LARGE", "message": f"Audio exceeds {MAX_DOWNLOAD_MB}MB limit"}},
                        )

            log.info("Downloaded %s → %s (%.1f MB)", audio_url, dest_path, downloaded / (1024 * 1024))
            return dest_path

    except httpx.HTTPError as e:
        raise HTTPException(
            status_code=502,
            detail={"ok": False, "error": {"code": "DOWNLOAD_FAILED", "message": f"Could not download audio file: {e}"}},
        )


# ── ffmpeg ──────────────────────────────────────────────────────────────────────

def run_ffmpeg(input_path: Path, output_path: Path, from_sec: Optional[float] = None, to_sec: Optional[float] = None) -> Path:
    output_path = output_path.with_suffix(".wav")

    cmd = ["ffmpeg", "-y", "-loglevel", "error"]

    if from_sec is not None:
        cmd.extend(["-ss", str(from_sec)])

    cmd.extend(["-i", str(input_path)])

    if to_sec is not None:
        if from_sec is not None:
            duration = to_sec - from_sec
        else:
            duration = to_sec
        cmd.extend(["-t", str(duration)])
    elif from_sec is not None:
        pass

    cmd.extend(["-ac", "1", "-ar", "16000", str(output_path)])

    log.info("ffmpeg: %s", " ".join(cmd))

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
        if result.returncode != 0:
            raise HTTPException(
                status_code=500,
                detail={"ok": False, "error": {"code": "FFMPEG_FAILED", "message": result.stderr.strip()[:500] or "ffmpeg processing failed"}},
            )
    except FileNotFoundError:
        raise HTTPException(
            status_code=500,
            detail={"ok": False, "error": {"code": "FFMPEG_NOT_FOUND", "message": "ffmpeg is not installed or not in PATH"}},
        )
    except subprocess.TimeoutExpired:
        raise HTTPException(
            status_code=500,
            detail={"ok": False, "error": {"code": "FFMPEG_TIMEOUT", "message": "ffmpeg processing timed out"}},
        )

    return output_path


# ── Whisper transcription ───────────────────────────────────────────────────────

def transcribe_clip(clip_path: Path, language: str, word_timestamps: bool, from_offset: float = 0.0):
    import mlx_whisper

    log.info("Transcribing %s with model %s (language=%s)", clip_path, WHISPER_MODEL, language)

    result = mlx_whisper.transcribe(
        str(clip_path),
        path_or_hf_repo=WHISPER_MODEL,
        language=language,
        word_timestamps=word_timestamps,
    )

    text = result.get("text", "").strip()
    raw_segments = result.get("segments", [])

    segments_out: list[SegmentOut] = []
    for seg in raw_segments:
        segments_out.append(SegmentOut(
            start=round(seg.get("start", 0.0) + from_offset, 3),
            end=round(seg.get("end", 0.0) + from_offset, 3),
            text=(seg.get("text", "") or "").strip(),
        ))

    return text, segments_out


# ── Cache ops ───────────────────────────────────────────────────────────────────

def load_cached_transcript(cache_key: str) -> Optional[dict]:
    cache_file = TRANSCRIPT_CACHE / f"{cache_key}.json"
    if not cache_file.exists():
        return None
    try:
        data = json.loads(cache_file.read_text())
        log.info("Cache HIT: %s", cache_key)
        return data
    except (json.JSONDecodeError, OSError):
        return None


def save_cached_transcript(cache_key: str, data: dict):
    cache_file = TRANSCRIPT_CACHE / f"{cache_key}.json"
    cache_file.write_text(json.dumps(data, ensure_ascii=False, indent=2))
    log.info("Cached transcript: %s", cache_key)


# ── Endpoints ───────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {
        "ok": True,
        "service": "al-ghurobaa-local-transcriber",
        "model": WHISPER_MODEL,
        "device": "apple-silicon-local",
    }


@app.post("/transcribe")
def transcribe(req: TranscribeRequest):
    validate_audio_url(req.audioUrl)

    cache_key = make_cache_key(
        audio_url=req.audioUrl,
        from_sec=req.from_,
        to_sec=req.to,
        language=req.language,
        model=WHISPER_MODEL,
        word_timestamps=req.wordTimestamps,
    )

    # Check cache
    if not req.force:
        cached = load_cached_transcript(cache_key)
        if cached:
            cached["ok"] = True
            cached["cached"] = True
            return cached

    t0 = time.time()

    # Download
    audio_hash = hashlib.sha256(req.audioUrl.encode()).hexdigest()[:16]
    download_path = AUDIO_CACHE / audio_hash
    if not download_path.exists() and not any(AUDIO_CACHE.glob(f"{audio_hash}.*")):
        download_path = download_audio(req.audioUrl, download_path)
    else:
        existing = list(AUDIO_CACHE.glob(f"{audio_hash}.*"))
        download_path = existing[0] if existing else download_audio(req.audioUrl, download_path)

    # Build clip
    clip_hash = cache_key[:16]
    clip_path = CLIP_CACHE / clip_hash
    clip_path = run_ffmpeg(download_path, clip_path, req.from_, req.to)

    # Transcribe
    try:
        with _inference_lock:
            text, segments = transcribe_clip(
                clip_path=clip_path,
                language=req.language,
                word_timestamps=req.wordTimestamps,
                from_offset=req.from_ or 0.0,
            )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={"ok": False, "error": {"code": "TRANSCRIPTION_FAILED", "message": str(e)[:500]}},
        )

    elapsed = round(time.time() - t0, 2)

    # Determine duration from segments or clip
    duration = (segments[-1].end if segments else 0.0) if segments else 0.0
    if duration == 0 and req.to and req.from_ is not None:
        duration = req.to - req.from_
    elif duration == 0 and req.to:
        duration = req.to

    response_data = {
        "ok": True,
        "cached": False,
        "cacheKey": cache_key,
        "audioUrl": req.audioUrl,
        "from": req.from_,
        "to": req.to,
        "language": req.language,
        "model": WHISPER_MODEL,
        "text": text,
        "segments": [s.model_dump(by_alias=True) for s in segments],
        "durationSeconds": round(duration, 3),
        "processingSeconds": elapsed,
    }

    # Cache for future use
    save_cached_transcript(cache_key, response_data)

    return response_data


# ── Entrypoint ──────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=HOST, port=PORT, reload=True)
