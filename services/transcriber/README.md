# Al-Ghurobaa Local Arabic Transcriber

Local-only Arabic audio transcription service using MLX Whisper on Apple Silicon.

## Requirements

- **Mac with Apple Silicon** (M1/M2/M3/M4)
- **Python 3.11** recommended for MLX/PyTorch native packages
- **ffmpeg** (`brew install ffmpeg`)

## Install

```bash
cd services/transcriber
python3.11 -m venv .venv311
source .venv311/bin/activate
pip install -r requirements.txt
```

Root dev uses `.venv311` by default. The first run will download the configured Whisper model. The dev script defaults to `mlx-community/whisper-tiny` for fast smoke tests; set `WHISPER_MODEL=mlx-community/whisper-large-v3-turbo` when you want the larger model.

## Run

```bash
source .venv311/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8787 --reload
```

Or use the root project script:

```bash
bun run transcriber:dev
# or, for the larger model:
WHISPER_MODEL=mlx-community/whisper-large-v3-turbo bun run transcriber:dev
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
    "language": "ar",
    "wordTimestamps": true
  }'
```

## API

### `GET /health`

```json
{
  "ok": true,
  "service": "al-ghurobaa-local-transcriber",
  "model": "mlx-community/whisper-tiny",
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
  "wordTimestamps": true
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
  "model": "mlx-community/whisper-tiny",
  "text": "النص العربي هنا...",
  "segments": [
    {
      "start": 0.0,
      "end": 8.4,
      "text": "...",
      "words": [
        { "word": "...", "start": 0.0, "end": 0.4 }
      ]
    }
  ],
  "durationSeconds": 300,
  "processingSeconds": 42.1
}
```

## Caching

Audio files, trimmed clips, and transcript JSON are cached in `cache/`. The cache key is a SHA256 hash of (audioUrl, from, to, language, model, wordTimestamps). Identical requests return instantly with `"cached": true`.

## App Integration

- Web/API on the same Mac should use `http://127.0.0.1:8787`.
- Expo/device builds should use the Mac LAN IP, for example `http://192.168.1.20:8787`.
- Audio transcript chunks use this local service only. Start it before transcribing with `bun run transcriber:dev`.
- Chunk requests should set `"wordTimestamps": true`; the app uses returned word timings for active word highlighting and falls back to approximate word timings only when the local model omits words.

## Troubleshooting

### "Connection refused" from Expo/device
- Use your Mac's LAN IP (not `localhost` or `127.0.0.1`)
- Find it with: `ipconfig getifaddr en0`
- Make sure your phone and Mac are on the same WiFi network

### macOS firewall prompt
- Allow Python/uvicorn incoming connections when prompted
- Or disable firewall temporarily: System Settings → Network → Firewall

### First request is slow
- The first request downloads the configured Whisper model. `mlx-community/whisper-tiny` is fast for smoke tests; `mlx-community/whisper-large-v3-turbo` is much larger (~1.6 GB) and slower to download.

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
