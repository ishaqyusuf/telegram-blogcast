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
from typing import Callable, Optional
from urllib.parse import quote, urlparse

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
PRELOAD_WHISPER = os.getenv("PRELOAD_WHISPER", "0") == "1"
TRANSCRIPT_CACHE_ENABLED = os.getenv("TRANSCRIPT_CACHE_ENABLED", "0") == "1"
TRANSCRIPTION_QUEUE_API_BASE_URL = os.getenv(
    "TRANSCRIPTION_QUEUE_API_BASE_URL",
    "",
).rstrip("/")
TRANSCRIPTION_QUEUE_WORKER_ENABLED = (
    os.getenv("TRANSCRIPTION_QUEUE_WORKER_ENABLED", "1") == "1"
)
TRANSCRIPTION_QUEUE_WORKER_ID = os.getenv(
    "TRANSCRIPTION_QUEUE_WORKER_ID",
    f"local-transcriber-{os.getpid()}",
)
TRANSCRIPTION_QUEUE_POLL_SECONDS = float(os.getenv("TRANSCRIPTION_QUEUE_POLL_SECONDS", "5"))
TRANSCRIPTION_WORKER_TOKEN = os.getenv("TRANSCRIPTION_WORKER_TOKEN", "")
TRANSCRIPTION_QUEUE_CHUNKS = max(
    1,
    int(os.getenv("TRANSCRIPTION_QUEUE_CHUNKS", "10")),
)

AUDIO_CACHE = CACHE_DIR / "audio"
CLIP_CACHE = CACHE_DIR / "clips"
TRANSCRIPT_CACHE = CACHE_DIR / "transcripts"

AUDIO_CACHE.mkdir(parents=True, exist_ok=True)
CLIP_CACHE.mkdir(parents=True, exist_ok=True)
TRANSCRIPT_CACHE.mkdir(parents=True, exist_ok=True)

# ── Inference lock ──────────────────────────────────────────────────────────────

_inference_lock = threading.Lock()
_whisper_load_lock = threading.RLock()
_whisper_module = None
_whisper_model_path: Optional[str] = None
_whisper_status = "not_loaded"
_whisper_error: Optional[str] = None
_whisper_load_started_at: Optional[float] = None
_whisper_load_finished_at: Optional[float] = None

# ── App ─────────────────────────────────────────────────────────────────────────

app = FastAPI(title="Al-Ghurobaa Local Transcriber")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def load_whisper_module():
    global _whisper_module
    global _whisper_status
    global _whisper_error
    global _whisper_load_started_at
    global _whisper_load_finished_at

    if _whisper_module is not None:
        return _whisper_module

    with _whisper_load_lock:
        if _whisper_module is not None:
            return _whisper_module

        _whisper_status = "loading"
        _whisper_error = None
        _whisper_load_started_at = time.time()
        _whisper_load_finished_at = None
        log.info("Loading mlx_whisper module")

        try:
            import mlx_whisper
        except Exception as exc:
            _whisper_status = "error"
            _whisper_error = str(exc)[:500]
            _whisper_load_finished_at = time.time()
            log.exception("Failed to load mlx_whisper module")
            raise

        _whisper_module = mlx_whisper
        _whisper_status = "module_loaded"
        _whisper_load_finished_at = time.time()
        log.info(
            "Loaded mlx_whisper module in %.2fs",
            _whisper_load_finished_at - _whisper_load_started_at,
        )
        return _whisper_module


def ensure_whisper_model_ready():
    global _whisper_model_path
    global _whisper_status
    global _whisper_error
    global _whisper_load_started_at
    global _whisper_load_finished_at

    if _whisper_status == "ready" and _whisper_model_path:
        return

    with _whisper_load_lock:
        if _whisper_status == "ready" and _whisper_model_path:
            return

        _whisper_status = "loading"
        _whisper_error = None
        _whisper_load_started_at = time.time()
        _whisper_load_finished_at = None

        try:
            load_whisper_module()
            model_path = Path(WHISPER_MODEL).expanduser()
            if model_path.exists():
                _whisper_model_path = str(model_path)
            else:
                from huggingface_hub import snapshot_download

                log.info("Downloading/preparing Whisper model assets: %s", WHISPER_MODEL)
                _whisper_model_path = snapshot_download(repo_id=WHISPER_MODEL)
        except Exception as exc:
            _whisper_status = "error"
            _whisper_error = str(exc)[:500]
            _whisper_load_finished_at = time.time()
            log.exception("Failed to prepare Whisper model")
            raise

        _whisper_status = "ready"
        _whisper_load_finished_at = time.time()
        log.info(
            "Prepared Whisper model %s in %.2fs",
            WHISPER_MODEL,
            _whisper_load_finished_at - _whisper_load_started_at,
        )


def warm_whisper_model():
    try:
        ensure_whisper_model_ready()
    except Exception:
        pass


@app.on_event("startup")
def start_whisper_warmup():
    if PRELOAD_WHISPER:
        threading.Thread(target=warm_whisper_model, daemon=True).start()

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


class WordOut(BaseModel):
    word: str
    start: float
    end: float


class SegmentOut(BaseModel):
    start: float
    end: float
    text: str
    words: list[WordOut] = Field(default_factory=list)


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
    segments: list[SegmentOut] = Field(default_factory=list)
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


def get_or_download_audio(audio_url: str) -> Path:
    audio_hash = hashlib.sha256(audio_url.encode()).hexdigest()[:16]
    download_path = AUDIO_CACHE / audio_hash
    existing = list(AUDIO_CACHE.glob(f"{audio_hash}.*"))
    if download_path.exists():
        return download_path
    if existing:
        return existing[0]
    return download_audio(audio_url, download_path)


# ── ffmpeg ──────────────────────────────────────────────────────────────────────

def probe_audio_duration_seconds(input_path: Path) -> float:
    cmd = [
        "ffprobe",
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        str(input_path),
    ]

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        if result.returncode != 0:
            raise HTTPException(
                status_code=500,
                detail={
                    "ok": False,
                    "error": {
                        "code": "FFPROBE_FAILED",
                        "message": result.stderr.strip()[:500] or "ffprobe duration probe failed",
                    },
                },
            )
    except FileNotFoundError:
        raise HTTPException(
            status_code=500,
            detail={
                "ok": False,
                "error": {
                    "code": "FFPROBE_NOT_FOUND",
                    "message": "ffprobe is not installed or not in PATH",
                },
            },
        )
    except subprocess.TimeoutExpired:
        raise HTTPException(
            status_code=500,
            detail={
                "ok": False,
                "error": {
                    "code": "FFPROBE_TIMEOUT",
                    "message": "ffprobe duration probe timed out",
                },
            },
        )

    try:
        duration = float(result.stdout.strip())
    except ValueError:
        duration = 0.0

    if duration <= 0:
        raise HTTPException(
            status_code=500,
            detail={
                "ok": False,
                "error": {
                    "code": "AUDIO_DURATION_UNKNOWN",
                    "message": "Could not determine audio duration for queued transcription",
                },
            },
        )

    return duration


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
    mlx_whisper = load_whisper_module()

    log.info("Transcribing %s with model %s (language=%s)", clip_path, WHISPER_MODEL, language)

    transcribe_start = time.time()
    result = mlx_whisper.transcribe(
        str(clip_path),
        path_or_hf_repo=WHISPER_MODEL,
        language=language,
        word_timestamps=word_timestamps,
    )
    log.info("mlx_whisper returned in %.2fs", time.time() - transcribe_start)

    text = result.get("text", "").strip()
    raw_segments = result.get("segments", [])

    segments_out: list[SegmentOut] = []
    for seg in raw_segments:
        words_out: list[WordOut] = []
        for word in seg.get("words", []) or []:
            word_text = (word.get("word", "") or "").strip()
            if not word_text:
                continue
            words_out.append(WordOut(
                word=word_text,
                start=round(word.get("start", 0.0) + from_offset, 3),
                end=round(word.get("end", 0.0) + from_offset, 3),
            ))

        segments_out.append(SegmentOut(
            start=round(seg.get("start", 0.0) + from_offset, 3),
            end=round(seg.get("end", 0.0) + from_offset, 3),
            text=(seg.get("text", "") or "").strip(),
            words=words_out,
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
    load_elapsed = None
    if _whisper_load_started_at:
        load_ended_at = _whisper_load_finished_at or time.time()
        load_elapsed = round(load_ended_at - _whisper_load_started_at, 2)

    return {
        "ok": _whisper_status == "ready",
        "service": "al-ghurobaa-local-transcriber",
        "model": WHISPER_MODEL,
        "device": "apple-silicon-local",
        "status": _whisper_status,
        "ready": _whisper_status == "ready",
        "error": _whisper_error,
        "loadSeconds": load_elapsed,
    }


ProgressCallback = Callable[[int, str], None]


def perform_transcription(req: TranscribeRequest, progress: Optional[ProgressCallback] = None):
    def report(percent: int, stage: str):
        if progress:
            progress(percent, stage)

    report(2, "validating")
    validate_audio_url(req.audioUrl)

    if _whisper_status != "ready":
        raise HTTPException(
            status_code=503,
            detail={
                "ok": False,
                "error": {
                    "code": "WHISPER_NOT_READY",
                    "message": "Local Whisper is still loading. Wait for /health status=ready, then retry.",
                },
            },
        )

    report(5, "cache_check")
    cache_key = make_cache_key(
        audio_url=req.audioUrl,
        from_sec=req.from_,
        to_sec=req.to,
        language=req.language,
        model=WHISPER_MODEL,
        word_timestamps=req.wordTimestamps,
    )

    # Check cache
    if TRANSCRIPT_CACHE_ENABLED and not req.force:
        cached = load_cached_transcript(cache_key)
        if cached:
            cached["ok"] = True
            cached["cached"] = True
            report(100, "completed")
            return cached

    t0 = time.time()

    # Download
    report(15, "downloading")
    download_path = get_or_download_audio(req.audioUrl)

    # Build clip
    report(35, "clipping")
    clip_hash = cache_key[:16]
    clip_path = CLIP_CACHE / clip_hash
    clip_path = run_ffmpeg(download_path, clip_path, req.from_, req.to)

    # Transcribe
    report(55, "transcribing")
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

    if TRANSCRIPT_CACHE_ENABLED:
        save_cached_transcript(cache_key, response_data)

    report(100, "completed")
    return response_data


@app.post("/transcribe")
def transcribe(req: TranscribeRequest):
    return perform_transcription(req)


# ── DB-backed queue worker ──────────────────────────────────────────────────────

def queue_headers() -> dict[str, str]:
    headers = {"content-type": "application/json"}
    if TRANSCRIPTION_WORKER_TOKEN:
        headers["authorization"] = f"Bearer {TRANSCRIPTION_WORKER_TOKEN}"
    return headers


def queue_post(client: httpx.Client, path: str, payload: dict) -> dict:
    url = f"{TRANSCRIPTION_QUEUE_API_BASE_URL}{path}"
    response = client.post(
        url,
        json=payload,
        headers=queue_headers(),
        timeout=REQUEST_TIMEOUT_SECONDS,
    )
    response.raise_for_status()
    return response.json()


def job_error_message(exc: Exception) -> str:
    if isinstance(exc, HTTPException):
        detail = exc.detail
        if isinstance(detail, dict):
            error = detail.get("error")
            if isinstance(error, dict) and error.get("message"):
                return str(error["message"])[:500]
        return str(detail)[:500]
    return str(exc)[:500] or "Transcription failed."


def report_queue_progress(
    client: httpx.Client,
    job_id: int,
    percent: int,
    stage: str,
    current_chunk: int = 0,
    total_chunks: int = 0,
):
    queue_post(
        client,
        f"/api/internal/transcription-jobs/{job_id}/progress",
        {
            "workerId": TRANSCRIPTION_QUEUE_WORKER_ID,
            "progressPercent": percent,
            "stage": stage,
            "currentChunk": current_chunk,
            "totalChunks": total_chunks,
        },
    )


def queue_chunk_progress_percent(completed_chunks: int, total_chunks: int) -> int:
    if total_chunks <= 0:
        return 55
    return min(100, 55 + round((completed_chunks / total_chunks) * 45))


def build_queue_chunks(from_sec: float, to_sec: float) -> list[tuple[float, float]]:
    if to_sec <= from_sec:
        raise RuntimeError("Queued transcription requires toSec to be greater than fromSec.")

    duration = to_sec - from_sec
    chunk_count = TRANSCRIPTION_QUEUE_CHUNKS
    chunk_duration = duration / chunk_count
    chunks: list[tuple[float, float]] = []

    for index in range(chunk_count):
        chunk_start = from_sec + (chunk_duration * index)
        chunk_end = to_sec if index == chunk_count - 1 else from_sec + (chunk_duration * (index + 1))
        chunks.append((round(chunk_start, 3), round(chunk_end, 3)))

    return chunks


def queue_chunk_key(chunk_start_sec: float, chunk_end_sec: float) -> str:
    return f"{round(float(chunk_start_sec), 3):.3f}:{round(float(chunk_end_sec), 3):.3f}"


def saved_queue_chunk_keys(job: dict) -> set[str]:
    media = job.get("media") or {}
    transcript = media.get("transcript") or {}
    segments = transcript.get("segments") or []
    keys: set[str] = set()

    for segment in segments:
        if not isinstance(segment, dict) or segment.get("status") == "failed":
            continue
        try:
            chunk_start = float(segment.get("chunkStartSec"))
            chunk_end = float(segment.get("chunkEndSec"))
        except (TypeError, ValueError):
            continue
        if chunk_end <= chunk_start:
            continue
        keys.add(queue_chunk_key(chunk_start, chunk_end))

    return keys


def save_queue_chunk(
    client: httpx.Client,
    job_id: int,
    chunk_start_sec: float,
    chunk_end_sec: float,
    segments: list[dict],
    progress_percent: int,
    current_chunk: int,
    total_chunks: int,
):
    queue_post(
        client,
        f"/api/internal/transcription-jobs/{job_id}/chunk",
        {
            "workerId": TRANSCRIPTION_QUEUE_WORKER_ID,
            "chunkStartSec": chunk_start_sec,
            "chunkEndSec": chunk_end_sec,
            "segments": segments,
            "progressPercent": progress_percent,
            "stage": "chunk_completed",
            "currentChunk": current_chunk,
            "totalChunks": total_chunks,
            "model": "whisper-local",
        },
    )


def process_queue_job(client: httpx.Client, job: dict):
    job_id = int(job["id"])
    audio_url = job.get("audioUrl")
    telegram_file_id = job.get("telegramFileId")
    if not audio_url and telegram_file_id and TRANSCRIPTION_QUEUE_API_BASE_URL:
        audio_url = (
            f"{TRANSCRIPTION_QUEUE_API_BASE_URL}/api/telegram/file/"
            f"{quote(str(telegram_file_id), safe='')}"
        )
    if not audio_url:
        raise RuntimeError(
            "Queued transcription worker requires audioUrl; Telegram-only jobs must be resolved before enqueue."
        )

    last_progress = {"percent": int(job.get("progressPercent") or 0)}

    def progress(percent: int, stage: str, current_chunk: int = 0, total_chunks: int = 0):
        last_progress["percent"] = percent
        report_queue_progress(client, job_id, percent, stage, current_chunk, total_chunks)

    try:
        progress(2, "validating")
        validate_audio_url(audio_url)

        from_sec = float(job.get("fromSec") or 0)
        if job.get("toSec") is None:
            progress(15, "downloading")
            download_path = get_or_download_audio(audio_url)
            progress(35, "probing")
            to_sec = probe_audio_duration_seconds(download_path)
        else:
            progress(35, "chunkifying")
            to_sec = float(job.get("toSec"))

        chunks = build_queue_chunks(from_sec, to_sec)
        total_chunks = len(chunks)
        saved_chunk_keys = saved_queue_chunk_keys(job)
        saved_chunk_count = sum(
            1 for chunk_start, chunk_end in chunks
            if queue_chunk_key(chunk_start, chunk_end) in saved_chunk_keys
        )
        if saved_chunk_count > 0:
            progress(
                queue_chunk_progress_percent(saved_chunk_count, total_chunks),
                "resuming",
                saved_chunk_count,
                total_chunks,
            )
            log.info(
                "Resuming transcription job %s with %s/%s chunks already saved",
                job_id,
                saved_chunk_count,
                total_chunks,
            )
        else:
            progress(55, "transcribing", 0, total_chunks)

        for index, (chunk_start, chunk_end) in enumerate(chunks, start=1):
            if queue_chunk_key(chunk_start, chunk_end) in saved_chunk_keys:
                log.info(
                    "Skipping saved transcription job %s chunk %s/%s (%s-%s)",
                    job_id,
                    index,
                    total_chunks,
                    chunk_start,
                    chunk_end,
                )
                continue
            req = TranscribeRequest(
                audioUrl=audio_url,
                from_=chunk_start,
                to=chunk_end,
                language=job.get("language") or DEFAULT_LANGUAGE,
                wordTimestamps=True,
            )
            result = perform_transcription(req)
            progress_percent = queue_chunk_progress_percent(index, total_chunks)
            save_queue_chunk(
                client=client,
                job_id=job_id,
                chunk_start_sec=chunk_start,
                chunk_end_sec=chunk_end,
                segments=result.get("segments", []),
                progress_percent=progress_percent,
                current_chunk=index,
                total_chunks=total_chunks,
            )
            last_progress["percent"] = progress_percent
    except Exception as exc:
        setattr(exc, "queue_progress_percent", last_progress["percent"])
        raise

    queue_post(
        client,
        f"/api/internal/transcription-jobs/{job_id}/complete",
        {
            "workerId": TRANSCRIPTION_QUEUE_WORKER_ID,
        },
    )


def queue_worker_loop():
    log.info(
        "Transcription queue worker enabled (api=%s, worker=%s)",
        TRANSCRIPTION_QUEUE_API_BASE_URL,
        TRANSCRIPTION_QUEUE_WORKER_ID,
    )

    with httpx.Client(follow_redirects=True) as client:
        while True:
            try:
                if _whisper_status != "ready":
                    ensure_whisper_model_ready()

                claimed = queue_post(
                    client,
                    "/api/internal/transcription-jobs/claim",
                    {"workerId": TRANSCRIPTION_QUEUE_WORKER_ID},
                )
                job = claimed.get("job")
                if not job:
                    time.sleep(TRANSCRIPTION_QUEUE_POLL_SECONDS)
                    continue

                log.info("Claimed transcription job %s", job.get("id"))
                try:
                    process_queue_job(client, job)
                    log.info("Completed transcription job %s", job.get("id"))
                except Exception as job_exc:
                    message = job_error_message(job_exc)
                    progress_percent = getattr(
                        job_exc,
                        "queue_progress_percent",
                        job.get("progressPercent") or 0,
                    )
                    log.exception(
                        "Failed transcription job %s: %s",
                        job.get("id"),
                        message,
                    )
                    queue_post(
                        client,
                        f"/api/internal/transcription-jobs/{job.get('id')}/fail",
                        {
                            "workerId": TRANSCRIPTION_QUEUE_WORKER_ID,
                            "progressPercent": progress_percent,
                            "errorMessage": message,
                        },
                    )
            except Exception as loop_exc:
                log.warning("Transcription queue worker idle after error: %s", loop_exc)
                time.sleep(TRANSCRIPTION_QUEUE_POLL_SECONDS)


@app.on_event("startup")
def start_transcription_queue_worker():
    if TRANSCRIPTION_QUEUE_WORKER_ENABLED and TRANSCRIPTION_QUEUE_API_BASE_URL:
        threading.Thread(target=queue_worker_loop, daemon=True).start()


# ── Entrypoint ──────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=HOST, port=PORT, reload=True)
