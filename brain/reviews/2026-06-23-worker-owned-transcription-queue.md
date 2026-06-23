# Review: Worker-Owned Transcription Queue

## Status
Approved

## Review Date
2026-06-23

## Scope
- Plan: `brain/plans/2026-06-23-feature-worker-owned-transcription-queue.md`
- Intake: `brain/intake/2026-06-23-worker-owned-transcription-queue.md`
- ADR: `brain/decisions/2026-06-23-worker-owned-transcription-queue.md`

## Requirements Reviewed
- Local service can claim queued, failed retryable, or stale running transcription jobs.
- Worker progress, stage, worker ownership, heartbeat, retry/error state, and completion are persisted on `TranscriptionJob`.
- Completion writes `Transcript` and `TranscriptSegment` rows.
- Mobile queue no longer downloads media or invokes Whisper for queued jobs.
- Queue UI observes DB-backed progress/stage and supports manual refresh/pull-to-refresh.
- Brain docs reflect API, database, feature, and architecture changes.

## Evidence
- Prisma schema validation passed with `node_modules/.bin/prisma validate --schema packages/db/src/schema/schema.prisma`.
- Prisma client generation passed with `bun --filter @acme/db prisma-generate`.
- Database schema apply passed with `bun --filter @acme/db push` against the configured Supabase Postgres database.
- Python syntax check passed with `PYTHONDONTWRITEBYTECODE=1 /opt/homebrew/bin/python3 -c "import ast, pathlib; ast.parse(pathlib.Path('services/transcriber/main.py').read_text())"`.
- Shared worker-operation smoke passed with `bun scripts/smoke-transcription-worker.mjs`.
- Internal HTTP route smoke passed with `bun scripts/smoke-transcription-worker-routes.mjs`.
- Smoke cleanup verification returned `{"jobs":0,"blogs":0}`.
- Source audit of `apps/expo-app/src/hooks/use-transcription-queue.ts`, `apps/expo-app/src/screens/transcribe-queue-screen.tsx`, and `apps/expo-app/src/app/_layout.tsx` found no queued-worker calls to `transcribeAudio`, `getTelegramFileUrl`, `saveTranscript`, `updateTranscriptionJob`, or `runJob`.
- `git diff --check` passed on the touched implementation, smoke, and Brain files.

## Typecheck Notes
- `bun --filter @acme/api typecheck` currently fails on existing unrelated issues: `src/queries/posts.ts`, auth middleware missing `src-copy`, existing merge-blog JSON typing, missing query-response type, and `packages/telegram` typing issues.
- `bun --cwd apps/expo-app tsc --noEmit` currently fails on broad existing app/API/example issues including missing `@telegram/*` path modules, app config/toast/view/demo issues, and older job/order/audio example code.
- These failures are not accepted as proof of release readiness for the whole repo, but they do not contradict the queue-specific smoke evidence above.

## Findings
- No blocking issues found in the worker-owned transcription queue implementation.

## Approval
- Approved for the Brain scope represented by `brain/plans/2026-06-23-feature-worker-owned-transcription-queue.md`.
- Remaining optional follow-up: run a full end-to-end service smoke with a real short audio URL through the local Python transcriber.

