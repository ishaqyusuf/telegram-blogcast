# Plan: Worker-Owned Transcription Queue

## Type
Feature

## Status
Done

## Created Date
2026-06-23

## Intake
- Intake File: `brain/intake/2026-06-23-worker-owned-transcription-queue.md`

## Goal Or Problem
Queued transcription should not depend on the mobile app staying open or doing the Whisper work. When the local transcriber service is online, it should claim queued jobs, process them, update progress in the database, and save transcript segments through the API.

## Current Context
- `TranscriptionJob` already stores queued work.
- Mobile can enqueue jobs and display a queue screen.
- The previous queue hook processed jobs on-device by calling the local transcriber, which makes the phone act as the worker and gives only fake progress.
- The local Python service already downloads/caches source media, clips requested ranges with ffmpeg, and transcribes with MLX Whisper.

## Proposed Approach
- Add DB-backed worker progress fields to `TranscriptionJob`.
- Add internal API endpoints for local workers to claim jobs, heartbeat progress, complete jobs, and fail jobs.
- Start a Python background loop when `TRANSCRIPTION_QUEUE_API_BASE_URL` is configured.
- Have mobile enqueue worker-ready jobs with reachable audio URLs and poll tRPC queue rows for progress.

## Acceptance Criteria
- Local service can claim one queued/failed/stale job at a time.
- Worker progress and stage are persisted on `TranscriptionJob`.
- Completion writes `Transcript`/`TranscriptSegment` rows and marks the job completed.
- Failure records an error and increments retry count.
- Mobile queue no longer downloads media or calls Whisper for queued jobs.
- Queue UI shows DB-backed progress/stage and supports manual refresh/pull-to-refresh.

## Test Plan
- Recommended: run Prisma generation/DB push for the new fields.
- Recommended: run API package typecheck.
- Recommended: start API and transcriber with `TRANSCRIPTION_QUEUE_API_BASE_URL`, enqueue a short job, and watch progress in the mobile queue.

## Brain Update Requirements
- Update `brain/features/audio.md`.
- Update `brain/api/contracts.md`.
- Update `brain/api/endpoints.md`.
- Update `brain/database/schema.md`.
- Add an ADR for the worker-owned queue architecture.

## Risks / Edge Cases
- Telegram-only jobs must be resolved into a reachable HTTP(S) URL before the worker claims them.
- The first worker run may block while the Whisper model prepares.
- Jobs are full requested-range transcriptions; true server-side chunking is not implemented yet.

## Implementation Notes
- Added internal worker endpoints in `apps/api/src/index.ts` for claim, progress, completion, and failure.
- Added `TranscriptionJob` progress, stage, worker ownership, heartbeat, lock, and chunk counter fields in `packages/db/src/schema/transcript.schema.prisma`.
- Updated `blog.getTranscriptionJobs` to include media title/file/blog fallback metadata and `blog.enqueueTranscriptionJob` to initialize queue progress fields.
- Updated `services/transcriber/main.py` with an optional background queue worker controlled by `TRANSCRIPTION_QUEUE_API_BASE_URL`.
- Updated mobile queue behavior so Expo observes and refreshes queue state instead of downloading media or calling Whisper for queued jobs.
- Updated blog/audio enqueue paths to resolve Telegram file IDs into reachable URLs before saving queue jobs.

## Verification Notes
- `node_modules/.bin/prisma validate --schema packages/db/src/schema/schema.prisma` passed.
- `bun --filter @acme/db prisma-generate` passed and generated Prisma Client from `packages/db/src/schema`.
- Generated client/schema evidence includes `TranscriptionJob.progressPercent`, `workerId`, `heartbeatAt`, and `currentChunk` in `node_modules/.prisma/client/schema.prisma` and `node_modules/.prisma/client/index.d.ts`.
- `bun --filter @acme/db push` passed and reported the Supabase Postgres database was in sync with the Prisma schema.
- `PYTHONDONTWRITEBYTECODE=1 /opt/homebrew/bin/python3 -c "import ast, pathlib; ast.parse(pathlib.Path('services/transcriber/main.py').read_text())"` passed.
- `git diff --check` passed on the touched queue, transcriber, Prisma, and Brain files.
- `bun --filter @acme/api typecheck` ran but failed on existing unrelated errors in `src/queries/posts.ts`, auth middleware missing `src-copy`, JSON typing in existing merge-blog code, missing query-response type, and `packages/telegram` typing issues. No reported error pointed at the new worker queue endpoints.
- `bun --cwd apps/expo-app tsc --noEmit` ran but failed on broad existing app/API issues including missing `@telegram/*` path modules, existing API type errors, app config/toast/view/demo issues, and older job/order/audio example code. No reported error pointed at the new transcription queue hook/screen files.
- A read-only DB column query through the runtime DB package was attempted after the successful DB push, but the command was killed while waiting on the connection. The successful Prisma DB push remains the database-apply evidence for this turn.
- `bun scripts/smoke-transcription-worker.mjs` passed against the configured Supabase database. It created disposable blog/media/job rows, exercised the shared worker operations for claim, progress, fail, second claim, complete, and transcript segment persistence, then cleaned up its rows.
- `bun scripts/smoke-transcription-worker-routes.mjs` passed against the configured Supabase database. It used `app.fetch()` to exercise the internal HTTP worker endpoints for claim, progress, fail, second claim, complete, and transcript segment persistence with disposable job IDs, then cleaned up its rows.
- Smoke cleanup verification returned `{"jobs":0,"blogs":0}` for smoke worker/job data.
- Added accepted ADR: `brain/decisions/2026-06-23-worker-owned-transcription-queue.md`.
- Review approved in `brain/reviews/2026-06-23-worker-owned-transcription-queue.md`.
- An earlier file-level Prisma generate command was found to be the wrong verification path for this multi-file schema repo; package-level generation is the authoritative check.

## Completion Notes
- Existing package-level API/Expo typecheck blockers are documented in the review artifact and do not point at the queue-specific implementation.
- Full end-to-end service smoke with API plus local transcriber and a real short audio URL remains optional follow-up; the shared DB worker operations and internal HTTP worker endpoints are covered by disposable smoke tests.
- Brain review for this repo-local plan is approved.
