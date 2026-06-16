# Al-Ghurobaa Local Arabic Transcriber

Local-only Arabic audio transcription service using MLX Whisper on Apple Silicon.

## Requirements

- **Mac with Apple Silicon** (M1/M2/M3/M4)
- **Python 3.10+**
- **ffmpeg** (`brew install ffmpeg`)

## Install

```bash
cd services/transcriber
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

The first run will download the Whisper model (~1.5 GB). This happens automatically on the first transcription request.

## Run

```bash
source .venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8787 --reload
```

Or use the root project script:

```bash
bun run transcriber:dev
```

## Find Your Mac LAN IP

```bash
ipconfig getifaddr en0
```

Common output: `192.168.1.20` or `192.168.0.10`.

## Configure Expo App

Add to `apps/expo-app/.env`:

```env
EXPO_PUBLIC_TRANSCRIBER_URL=http://YOUR_MAC_LAN_IP:8787
```

## Test

```bash
# Health check
curl http://localhost:8787/health

# Transcribe
curl -X POST http://localhost:8787/transcribe \
  -H "Content-Type: application/json" \
  -d '{
    "audioUrl": "https://example.com/lesson.mp3",
    "from": 0,
    "to": 120,
    "language": "ar"
  }'
```

## API

### `GET /health`

```json
{
  "ok": true,
  "service": "al-ghurobaa-local-transcriber",
  "model": "mlx-community/whisper-large-v3-turbo",
  "device": "apple-silicon-local"
}
```

### `POST /transcribe`

Request:

```json
{
  "audioUrl": "https://example.com/audio.mp3",
  "from": 0,
  "to": 300,
  "language": "ar",
  "force": false,
  "wordTimestamps": false
}
```

Response:

```json
{
  "ok": true,
  "cached": false,
  "cacheKey": "abc123...",
  "audioUrl": "https://example.com/audio.mp3",
  "from": 0,
  "to": 300,
  "language": "ar",
  "model": "mlx-community/whisper-large-v3-turbo",
  "text": "النص العربي هنا...",
  "segments": [
    { "start": 0.0, "end": 8.4, "text": "..." }
  ],
  "durationSeconds": 300,
  "processingSeconds": 42.1
}
```

## Caching

Audio files, trimmed clips, and transcript JSON are cached in `cache/`. The cache key is a SHA256 hash of (audioUrl, from, to, language, model, wordTimestamps). Identical requests return instantly with `"cached": true`.

## Troubleshooting

### "Connection refused" from Expo/device
- Use your Mac's LAN IP (not `localhost` or `127.0.0.1`)
- Find it with: `ipconfig getifaddr en0`
- Make sure your phone and Mac are on the same WiFi network

### macOS firewall prompt
- Allow Python/uvicorn incoming connections when prompted
- Or disable firewall temporarily: System Settings → Network → Firewall

### First request is slow
- The first request downloads the Whisper model (~1.5 GB). Subsequent requests are faster.

### High RAM usage
- `whisper-large-v3-turbo` uses significant RAM. With 16GB RAM, transcription should work but close memory-heavy apps.

### Poor Arabic transcription quality
- Ensure audio is clear Arabic speech
- Background noise, music, or mixed languages degrade quality
- Use `from`/`to` to transcribe only the relevant section

### "ffmpeg not found"
```bash
brew install ffmpeg
```
