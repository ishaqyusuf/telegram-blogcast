"""
Al-Ghurobaa Facebook media bridge.

This local service resolves a saved Facebook post URL, downloads the media with
the local browser session, uploads the file to a Telegram bot channel, and
returns durable Telegram file metadata to the API.
"""

import asyncio
import hashlib
import html
import importlib.util
import logging
import mimetypes
import os
import re
import shutil
import subprocess
import sys
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
log = logging.getLogger("facebook-media-bridge")


def load_env_file(path: Path):
    if not path.exists():
        return

    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue

        key, value = stripped.split("=", 1)
        key = key.removeprefix("export ").strip()
        if not key or key in os.environ:
            continue

        value = value.strip()
        if (
            (value.startswith('"') and value.endswith('"'))
            or (value.startswith("'") and value.endswith("'"))
        ):
            value = value[1:-1]
        os.environ[key] = value


REPO_ROOT = Path(__file__).resolve().parents[2]
for env_file in [
    REPO_ROOT / ".env",
    REPO_ROOT / "apps/api/.env",
    REPO_ROOT / "apps/www/.env",
    Path(__file__).resolve().parent / ".env",
]:
    load_env_file(env_file)


HOST = os.getenv("FACEBOOK_MEDIA_BRIDGE_HOST", "0.0.0.0")
PORT = int(os.getenv("FACEBOOK_MEDIA_BRIDGE_PORT", "8790"))
CACHE_DIR = Path(os.getenv("FACEBOOK_MEDIA_CACHE_DIR", "./cache"))
DOWNLOAD_DIR = CACHE_DIR / "downloads"
MAX_DOWNLOAD_MB = int(os.getenv("FACEBOOK_MEDIA_MAX_MB", "200"))
REQUEST_TIMEOUT_SECONDS = int(os.getenv("FACEBOOK_MEDIA_REQUEST_TIMEOUT", "60"))
COOKIES_FROM_BROWSER = os.getenv("FACEBOOK_COOKIES_FROM_BROWSER", "chrome")
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_UPLOAD_CHAT_ID = (
    os.getenv("TELEGRAM_UPLOAD_CHAT_ID")
    or os.getenv("AL_GHUROBAA_TELEGRAM_CHANNEL_ID")
    or os.getenv("TELEGRAM_CHANNEL_ID")
    or ""
)

DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="Al-Ghurobaa Facebook Media Bridge")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ProcessRequest(BaseModel):
    blogId: int
    sourceUrl: str = Field(min_length=1)
    sourceId: Optional[str] = None
    title: Optional[str] = None
    caption: Optional[str] = None
    channelName: Optional[str] = None

    @field_validator("sourceUrl")
    @classmethod
    def validate_source_url(cls, value: str) -> str:
        parsed = urlparse(value)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise ValueError("sourceUrl must be an absolute http(s) URL")
        return value


class DownloadedMedia(BaseModel):
    path: str
    method: str
    directUrl: Optional[str] = None
    mimeType: Optional[str] = None
    mediaType: str
    fileSize: int


def now_ms() -> int:
    return int(time.time() * 1000)


def truncate(value: str, max_length: int) -> str:
    if len(value) <= max_length:
        return value
    return value[: max_length - 3] + "..."


def safe_dir_name(value: Optional[str], fallback: str = "unknown-channel") -> str:
    cleaned = re.sub(r"[\\/:\*\?\"<>\|\x00-\x1f]+", " ", value or "").strip()
    cleaned = re.sub(r"\s+", " ", cleaned)
    return truncate(cleaned, 80) or fallback


def build_channel_hashtag(value: Optional[str]) -> str:
    cleaned = re.sub(r"[^\w\u0600-\u06ff]+", "_", value or "", flags=re.UNICODE)
    cleaned = re.sub(r"_+", "_", cleaned).strip("_")
    return f"#{cleaned}" if cleaned else ""


def safe_job_dir(blog_id: int, source_url: str, channel_name: Optional[str] = None) -> Path:
    digest = hashlib.sha256(source_url.encode("utf-8")).hexdigest()[:16]
    path = DOWNLOAD_DIR / safe_dir_name(channel_name) / f"{blog_id}-{digest}"
    path.mkdir(parents=True, exist_ok=True)
    return path


def sniff_mime(path: Path) -> str:
    guessed, _ = mimetypes.guess_type(path.name)
    with path.open("rb") as file:
        header = file.read(32)

    if header.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if header.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if header.startswith(b"GIF8"):
        return "image/gif"
    if header.startswith(b"RIFF") and b"WEBP" in header:
        return "image/webp"
    if len(header) > 12 and header[4:8] == b"ftyp":
        return "video/mp4"
    return guessed or "application/octet-stream"


def media_type_from_mime(mime_type: str) -> str:
    if mime_type.startswith("image/"):
        return "image"
    if mime_type.startswith("video/"):
        return "video"
    return "document"


def find_downloaded_file(target_dir: Path, stdout: str) -> Optional[Path]:
    candidates: list[Path] = []
    for line in stdout.splitlines():
        cleaned = line.strip()
        if cleaned:
            candidate = Path(cleaned)
            if candidate.exists() and candidate.is_file():
                candidates.append(candidate)

    if not candidates:
        candidates = [item for item in target_dir.iterdir() if item.is_file()]

    if not candidates:
        return None

    return max(candidates, key=lambda item: item.stat().st_mtime)


def has_python_module(module_name: str) -> bool:
    return importlib.util.find_spec(module_name) is not None


def check_pyexpat_ok() -> bool:
    try:
        import pyexpat  # noqa: F401
    except Exception:
        return False
    return True


def get_ytdlp_command() -> list[str]:
    if has_python_module("yt_dlp"):
        return [sys.executable, "-m", "yt_dlp"]

    executable = shutil.which("yt-dlp")
    if executable:
        return [executable]

    raise RuntimeError(
        "yt-dlp is not installed. Run bun run facebook-media-bridge:install."
    )


def get_ytdlp_command_label() -> str:
    try:
        command = get_ytdlp_command()
    except Exception as error:
        return f"unavailable: {error}"
    return " ".join(command)


def run_ytdlp_download(source_url: str, target_dir: Path) -> DownloadedMedia:
    output_template = str(target_dir / "%(id)s.%(ext)s")
    cmd = [
        *get_ytdlp_command(),
        "--cookies-from-browser",
        COOKIES_FROM_BROWSER,
        "--no-playlist",
        "--no-progress",
        "--print",
        "after_move:filepath",
        "-o",
        output_template,
    ]
    if MAX_DOWNLOAD_MB > 0:
        cmd.extend(["--max-filesize", f"{MAX_DOWNLOAD_MB}m"])
    cmd.append(source_url)

    log.info("Resolving Facebook media with yt-dlp for %s", source_url)
    result = subprocess.run(
        cmd,
        cwd=str(target_dir),
        capture_output=True,
        text=True,
        timeout=max(REQUEST_TIMEOUT_SECONDS * 4, 120),
        check=False,
    )
    if result.returncode != 0:
        message = (result.stderr or result.stdout or "yt-dlp failed").strip()
        if "No module named expat" in message or "pyexpat" in message:
            message = (
                "yt-dlp Python runtime is missing XML/expat support. "
                "Run bun run facebook-media-bridge:install and restart the bridge. "
                f"Original error: {message}"
            )
        raise RuntimeError(truncate(message, 1000))

    downloaded = find_downloaded_file(target_dir, result.stdout)
    if not downloaded:
        raise RuntimeError("yt-dlp did not produce a downloadable media file.")

    mime_type = sniff_mime(downloaded)
    return DownloadedMedia(
        path=str(downloaded),
        method="yt-dlp",
        mimeType=mime_type,
        mediaType=media_type_from_mime(mime_type),
        fileSize=downloaded.stat().st_size,
    )


def extract_og_media_url(page_html: str) -> Optional[str]:
    patterns = [
        r'<meta[^>]+property=["\']og:video:secure_url["\'][^>]+content=["\']([^"\']+)["\']',
        r'<meta[^>]+property=["\']og:video:url["\'][^>]+content=["\']([^"\']+)["\']',
        r'<meta[^>]+property=["\']og:video["\'][^>]+content=["\']([^"\']+)["\']',
        r'<meta[^>]+property=["\']og:image:secure_url["\'][^>]+content=["\']([^"\']+)["\']',
        r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)["\']',
    ]
    for pattern in patterns:
        match = re.search(pattern, page_html, flags=re.IGNORECASE)
        if match:
            return html.unescape(match.group(1))
    return None


def extension_for_mime(mime_type: str) -> str:
    extension = mimetypes.guess_extension(mime_type)
    if extension:
        return extension
    if mime_type == "video/mp4":
        return ".mp4"
    if mime_type == "image/jpeg":
        return ".jpg"
    return ".bin"


async def download_direct_media(
    client: httpx.AsyncClient,
    media_url: str,
    target_dir: Path,
) -> DownloadedMedia:
    async with client.stream("GET", media_url) as response:
        response.raise_for_status()
        content_type = response.headers.get("content-type", "").split(";")[0].strip()
        mime_type = content_type or "application/octet-stream"
        file_path = target_dir / f"opengraph-{now_ms()}{extension_for_mime(mime_type)}"
        max_bytes = MAX_DOWNLOAD_MB * 1024 * 1024
        total = 0
        with file_path.open("wb") as output:
            async for chunk in response.aiter_bytes():
                total += len(chunk)
                if max_bytes > 0 and total > max_bytes:
                    raise RuntimeError(
                        f"Facebook media is larger than {MAX_DOWNLOAD_MB} MB."
                    )
                output.write(chunk)

    sniffed = sniff_mime(file_path)
    return DownloadedMedia(
        path=str(file_path),
        method="opengraph",
        directUrl=media_url,
        mimeType=sniffed,
        mediaType=media_type_from_mime(sniffed),
        fileSize=file_path.stat().st_size,
    )


async def download_with_opengraph(source_url: str, target_dir: Path) -> DownloadedMedia:
    headers = {
        "user-agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36"
        ),
        "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    }
    async with httpx.AsyncClient(
        follow_redirects=True,
        timeout=REQUEST_TIMEOUT_SECONDS,
        headers=headers,
    ) as client:
        response = await client.get(source_url)
        response.raise_for_status()
        media_url = extract_og_media_url(response.text)
        if not media_url:
            raise RuntimeError("No OpenGraph image/video URL was found on the page.")
        return await download_direct_media(client, media_url, target_dir)


async def download_facebook_media(source_url: str, target_dir: Path) -> DownloadedMedia:
    try:
        return await asyncio.to_thread(run_ytdlp_download, source_url, target_dir)
    except Exception as ytdlp_error:
        log.warning("yt-dlp download failed: %s", ytdlp_error)
        try:
            return await download_with_opengraph(source_url, target_dir)
        except Exception as opengraph_error:
            raise RuntimeError(
                "Could not resolve Facebook media. "
                f"yt-dlp: {ytdlp_error}; OpenGraph: {opengraph_error}"
            ) from opengraph_error


def generate_video_thumbnail(video_path: Path, target_dir: Path) -> Optional[Path]:
    if not shutil.which("ffmpeg"):
        log.warning("ffmpeg is not installed; skipping Telegram video thumbnail.")
        return None

    thumbnail_path = target_dir / f"{video_path.stem}-thumbnail.jpg"
    cmd = [
        "ffmpeg",
        "-y",
        "-ss",
        "00:00:01",
        "-i",
        str(video_path),
        "-frames:v",
        "1",
        "-vf",
        "scale='min(640,iw)':-2",
        "-q:v",
        "3",
        str(thumbnail_path),
    ]

    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        timeout=60,
        check=False,
    )
    if result.returncode != 0 or not thumbnail_path.exists():
        log.warning(
            "Could not generate video thumbnail for %s: %s",
            video_path.name,
            truncate(result.stderr or result.stdout or "ffmpeg failed", 500),
        )
        return None
    return thumbnail_path


def build_caption(title: Optional[str], caption: Optional[str], channel_name: Optional[str] = None) -> str:
    parts = [part.strip() for part in [title or "", caption or ""] if part.strip()]
    channel_hashtag = build_channel_hashtag(channel_name)
    if channel_hashtag:
        parts.append(channel_hashtag)
    if not parts:
        return ""
    return truncate("\n\n".join(dict.fromkeys(parts)), 1024)


def telegram_method_and_field(media_type: str) -> tuple[str, str]:
    if media_type == "image":
        return "sendPhoto", "photo"
    if media_type == "video":
        return "sendVideo", "video"
    return "sendDocument", "document"


def extract_telegram_file(message: dict, media_type: str, mime_type: str, file_name: str):
    if media_type == "image" and isinstance(message.get("photo"), list):
        photo = max(
            message["photo"],
            key=lambda item: int(item.get("file_size") or 0),
        )
        return {
            "fileId": photo["file_id"],
            "fileUniqueId": photo.get("file_unique_id"),
            "fileType": "image",
            "fileName": file_name,
            "mimeType": "image/jpeg",
            "fileSize": photo.get("file_size"),
            "width": photo.get("width"),
            "height": photo.get("height"),
            "duration": None,
        }

    if media_type == "video" and isinstance(message.get("video"), dict):
        video = message["video"]
        return {
            "fileId": video["file_id"],
            "fileUniqueId": video.get("file_unique_id"),
            "fileType": "video",
            "fileName": video.get("file_name") or file_name,
            "mimeType": video.get("mime_type") or mime_type,
            "fileSize": video.get("file_size"),
            "width": video.get("width"),
            "height": video.get("height"),
            "duration": video.get("duration"),
        }

    document = message.get("document")
    if not isinstance(document, dict):
        raise RuntimeError("Telegram response did not include uploaded file metadata.")

    return {
        "fileId": document["file_id"],
        "fileUniqueId": document.get("file_unique_id"),
        "fileType": "document",
        "fileName": document.get("file_name") or file_name,
        "mimeType": document.get("mime_type") or mime_type,
        "fileSize": document.get("file_size"),
        "width": None,
        "height": None,
        "duration": None,
    }


def extract_telegram_thumbnail(message: dict):
    video = message.get("video")
    if not isinstance(video, dict):
        return None

    thumbnail = video.get("thumbnail") or video.get("thumb")
    if not isinstance(thumbnail, dict) or not thumbnail.get("file_id"):
        return None

    return {
        "fileId": thumbnail["file_id"],
        "fileUniqueId": thumbnail.get("file_unique_id"),
        "fileType": "image",
        "fileName": "video-thumbnail.jpg",
        "mimeType": "image/jpeg",
        "fileSize": thumbnail.get("file_size"),
        "width": thumbnail.get("width"),
        "height": thumbnail.get("height"),
        "duration": None,
    }


async def upload_to_telegram(
    download: DownloadedMedia,
    title: Optional[str],
    caption: Optional[str],
    channel_name: Optional[str],
    thumbnail_path: Optional[Path] = None,
):
    if not TELEGRAM_BOT_TOKEN:
        raise RuntimeError("TELEGRAM_BOT_TOKEN is not configured.")
    if not TELEGRAM_UPLOAD_CHAT_ID:
        raise RuntimeError(
            "TELEGRAM_UPLOAD_CHAT_ID or AL_GHUROBAA_TELEGRAM_CHANNEL_ID is not configured."
        )

    path = Path(download.path)
    mime_type = download.mimeType or sniff_mime(path)
    media_type = media_type_from_mime(mime_type)
    method, field = telegram_method_and_field(media_type)
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/{method}"
    data = {
        "chat_id": TELEGRAM_UPLOAD_CHAT_ID,
        "caption": build_caption(title, caption, channel_name),
    }

    log.info("Uploading %s to Telegram with %s", path.name, method)
    async with httpx.AsyncClient(timeout=None) as client:
        with path.open("rb") as file:
            files = {
                field: (
                    path.name,
                    file,
                    mime_type,
                )
            }
            thumbnail_file = None
            try:
                if method == "sendVideo" and thumbnail_path and thumbnail_path.exists():
                    thumbnail_file = thumbnail_path.open("rb")
                    files["thumbnail"] = (
                        thumbnail_path.name,
                        thumbnail_file,
                        "image/jpeg",
                    )
                response = await client.post(url, data=data, files=files)
            finally:
                if thumbnail_file:
                    thumbnail_file.close()

    try:
        payload = response.json()
    except Exception:
        payload = None

    if not response.is_success or not payload or not payload.get("ok"):
        description = ""
        if isinstance(payload, dict):
            description = str(payload.get("description") or "")
        raise RuntimeError(
            f"Telegram upload failed ({response.status_code}): "
            f"{truncate(description or response.text, 1000)}"
        )

    message = payload["result"]
    file_data = extract_telegram_file(message, media_type, mime_type, path.name)
    return {
        "messageId": message["message_id"],
        "chatId": message.get("chat", {}).get("id", TELEGRAM_UPLOAD_CHAT_ID),
        "file": file_data,
        "thumbnail": extract_telegram_thumbnail(message),
        "raw": {
            "mediaType": media_type,
            "method": method,
        },
    }


@app.get("/health")
async def health():
    return {
        "ok": True,
        "service": "al-ghurobaa-facebook-media-bridge",
        "status": "ready",
        "ytDlpAvailable": has_python_module("yt_dlp")
        or shutil.which("yt-dlp") is not None,
        "ytDlpModuleAvailable": has_python_module("yt_dlp"),
        "ytDlpCommand": get_ytdlp_command_label(),
        "pythonExecutable": sys.executable,
        "pyexpatAvailable": check_pyexpat_ok(),
        "cookiesFromBrowser": COOKIES_FROM_BROWSER,
        "telegramConfigured": bool(TELEGRAM_BOT_TOKEN),
        "channelConfigured": bool(TELEGRAM_UPLOAD_CHAT_ID),
        "maxDownloadMb": MAX_DOWNLOAD_MB,
    }


@app.post("/process")
async def process(request: ProcessRequest):
    target_dir = safe_job_dir(request.blogId, request.sourceUrl, request.channelName)
    try:
        downloaded = await download_facebook_media(request.sourceUrl, target_dir)
        thumbnail_path = (
            generate_video_thumbnail(Path(downloaded.path), target_dir)
            if downloaded.mediaType == "video"
            else None
        )
        telegram = await upload_to_telegram(
            downloaded,
            request.title,
            request.caption,
            request.channelName,
            thumbnail_path,
        )
        return {
            "ok": True,
            "blogId": request.blogId,
            "status": "uploaded",
            "mediaType": downloaded.mediaType,
            "mimeType": downloaded.mimeType,
            "fileName": Path(downloaded.path).name,
            "fileSize": downloaded.fileSize,
            "downloadDir": str(target_dir),
            "telegram": telegram,
            "diagnostics": {
                "downloadMethod": downloaded.method,
                "directUrlResolved": downloaded.directUrl is not None,
                "thumbnailGenerated": thumbnail_path is not None,
            },
        }
    except Exception as exc:
        log.exception("Failed to process Facebook media for blog %s", request.blogId)
        raise HTTPException(status_code=500, detail=str(exc)) from exc
