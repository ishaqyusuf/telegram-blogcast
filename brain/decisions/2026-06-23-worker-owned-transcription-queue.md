# ADR: Worker-Owned Transcription Queue

## Title
- Decision: Move queued transcription execution out of Expo and into the local transcriber/API worker path.

## Status
- Accepted

## Context
- Queued transcription previously depended on the mobile app staying open and calling the local Whisper service itself.
- That made progress state local/optimistic, could reload media from the audio screen, and prevented a service from processing queued jobs while mobile simply observed.
- The requested architecture is DB-backed: the local service should claim queued jobs when online, update persisted progress, save transcript segments, and let mobile stream or poll the status.

## Decision
- `TranscriptionJob` owns queue state in the database, including progress percentage, stage, worker ownership, lock time, heartbeat, chunk counters, retry count, and error state.
- The API exposes internal worker endpoints for claim, progress, complete, and fail.
- Shared worker operations live in `apps/api/src/transcription-worker.ts` so HTTP routes and smoke tests exercise the same DB logic.
- The local Python transcriber runs an optional background queue worker when `TRANSCRIPTION_QUEUE_API_BASE_URL` is configured.
- Expo enqueue flows resolve Telegram file IDs into reachable URLs where possible, then mobile observes queue rows through `blog.getTranscriptionJobs`; it no longer downloads media or calls Whisper for queued jobs.

## Consequences
- Benefits:
  - Queued transcription can continue while mobile is only an observer.
  - Queue progress and failures survive app restarts because they are DB-backed.
  - Worker ownership/heartbeat fields make stale running jobs reclaimable.
  - Disposable smoke scripts can verify the shared worker operations and HTTP routes without touching user transcript data.
- Tradeoffs:
  - Existing queued Telegram-only jobs still need a reachable `audioUrl` before a worker can process them.
  - Current worker processing transcribes each requested job range as one unit; true long-audio chunking is deferred.
  - The internal worker endpoints should be protected with `TRANSCRIPTION_WORKER_TOKEN` outside trusted local development.
- Follow-up work:
  - Run a full service-level smoke with API, local transcriber, and a short real audio URL.
  - Resolve unrelated package typecheck blockers so API/Expo package checks can become stronger release gates.
  - Create/approve the formal Brain review item for this implemented plan.

