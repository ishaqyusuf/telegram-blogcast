# Al-Ghurobaa Facebook Media Bridge

Local service for importing saved Facebook media into Telegram-backed blog media.

The API owns the import job and durable DB status. This bridge does the work
that needs a local authenticated browser session:

1. Resolve the Facebook post URL with `yt-dlp --cookies-from-browser`.
2. Download the image/video to local cache.
3. Upload it to the configured Telegram bot channel.
4. Return Telegram `file_id` and `file_unique_id` to the API.

The short-lived Facebook CDN URL is not stored.

## Requirements

- `yt-dlp`
- A logged-in local browser profile for Facebook, usually Chrome
- `TELEGRAM_BOT_TOKEN`
- `AL_GHUROBAA_TELEGRAM_CHANNEL_ID` or `TELEGRAM_UPLOAD_CHAT_ID`

Install `yt-dlp` if needed:

```bash
brew install yt-dlp
```

## Install

```bash
cd services/facebook-media-bridge
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Or from the repo root:

```bash
bun run facebook-media-bridge:install
```

## Run

```bash
export TELEGRAM_BOT_TOKEN=...
export AL_GHUROBAA_TELEGRAM_CHANNEL_ID=@your_channel_or_numeric_id
source services/facebook-media-bridge/.venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8790
```

Or from the repo root:

```bash
TELEGRAM_BOT_TOKEN=... AL_GHUROBAA_TELEGRAM_CHANNEL_ID=... bun run facebook-media-bridge:dev
```

The bridge also auto-loads `.env`, `apps/api/.env`, `apps/www/.env`, and
`services/facebook-media-bridge/.env` without overriding already-exported
environment variables.

If the API is not on the same Mac, set:

```env
FACEBOOK_MEDIA_BRIDGE_BASE_URL=http://YOUR_MAC_LAN_IP:8790
```

## Browser Cookies

The default resolver uses:

```bash
yt-dlp --cookies-from-browser chrome
```

To use a different browser:

```env
FACEBOOK_COOKIES_FROM_BROWSER=safari
```

## API

### `GET /health`

Returns bridge readiness, `yt-dlp` availability, and whether Telegram env is set.

### `POST /process`

Request:

```json
{
  "blogId": 123,
  "sourceUrl": "https://www.facebook.com/...",
  "sourceId": "https://www.facebook.com/...",
  "title": "Saved post title",
  "caption": "Blog caption"
}
```

Response:

```json
{
  "ok": true,
  "blogId": 123,
  "status": "uploaded",
  "mediaType": "video",
  "mimeType": "video/mp4",
  "fileName": "12345.mp4",
  "fileSize": 12345678,
  "telegram": {
    "messageId": 456,
    "chatId": "@channel",
    "file": {
      "fileId": "BAAC...",
      "fileUniqueId": "AgAD...",
      "fileType": "video",
      "fileName": "12345.mp4",
      "mimeType": "video/mp4",
      "fileSize": 12345678,
      "width": 720,
      "height": 1280,
      "duration": 37
    }
  }
}
```

## Notes

- The bridge keeps downloads in `services/facebook-media-bridge/cache`.
- If Facebook blocks the request, open Facebook in the configured browser and
  make sure the saved post is visible in that session.
- The fallback OpenGraph resolver can handle some public image posts, but
  `yt-dlp` with browser cookies is the primary path.
