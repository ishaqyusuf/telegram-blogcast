# Plan: Persisted Audio Transcription Flow

## Type
Feature

## Status
Implemented

## Created Date
2026-06-15

## Last Updated
2026-06-15

## Completion Notes
- `blog.transcribeRange` accepts `mediaId` and persists returned segments when provided.
- Mobile server-provider options now match the API provider schema (`openai`, `gemini`).
- Local LAN transcription checks service health, transcribes through the local service, then saves segments with `blog.saveTranscript`.
- Persisted transcripts continue to be read through `blog.getTranscript`.

## Intake
- Intake File: brain/intake/2026-06-15-blog-audio-organization-import.md
- Intake Item: Audio transcribe feature.

## Goal Or Problem
Make audio transcription reliable and persistent across local and server transcription paths so generated transcript segments are saved and reused.

## Current Context
Transcript models exist in `packages/db/src/schema/transcript.schema.prisma`. API procedures `blog.getTranscript`, `blog.saveTranscript`, and `blog.transcribeRange` exist. Mobile `AudioTranscript` can call `transcribeRange`, and `LocalTranscribe` can call the LAN transcriber through `apps/expo-app/src/lib/transcribe.ts`. Provider options are aligned to `openai` and `gemini`, and `transcribeRange` persists segments when a `mediaId` is provided.

## Proposed Approach
Normalize transcription provider options and ensure every successful transcription writes to `Transcript` and `TranscriptSegment`. Support two execution paths: server API transcription for Telegram-backed audio and local LAN transcription for development/private local use. Add local transcriber health checks and clear error states.

## Implementation Steps
- Keep mobile provider options aligned with API provider schema.
- Decide whether `blog.transcribeRange` should save transcript segments itself or mobile should call `blog.saveTranscript` after success; prefer server-side save for consistency.
- Map returned transcription segments to `{ startSec, endSec, text }` and persist them.
- Make local transcriber results call `blog.saveTranscript` when a `mediaId` is known.
- Add a `/health` check in mobile local transcriber flow using `EXPO_PUBLIC_TRANSCRIBER_URL`.
- Show clear states for no local transcriber URL, service offline, provider missing key, file too large, and no segments found.
- Ensure transcript display reads persisted transcript before offering generation.
- Document provider and local transcriber setup.

## Affected Files Or Areas
- `apps/api/src/trpc/routers/blog.routes.ts`
- `apps/api/src/queries/blog.ts`
- `packages/db/src/schema/transcript.schema.prisma`
- `apps/expo-app/src/components/audio-blog-view/audio-transcript.tsx`
- `apps/expo-app/src/components/audio-blog-view/local-transcribe.tsx`
- `apps/expo-app/src/lib/transcribe.ts`
- `services/transcriber/main.py`
- `services/transcriber/README.md`
- `brain/features/audio.md`
- `brain/api/contracts.md`

## Acceptance Criteria
- Generating a transcript persists segments to the database.
- Returning to the same audio blog shows the saved transcript without retranscribing.
- Mobile provider options match implemented server providers.
- Local transcriber unavailable state explains how to run/configure it.
- Transcript segment order is stable by `startSec`.

## Test Plan
- Run `bun --filter @acme/api typecheck`.
- Run Expo app typecheck if configured.
- Manually generate a short transcript range and refresh/reopen the audio blog.
- Manually test missing local transcriber URL and offline service states.
- If Python service is available, run `curl http://localhost:8787/health`.

## Brain Update Requirements
- Update `brain/features/audio.md` with persisted transcript behavior.
- Update `brain/api/contracts.md` with transcription provider and persistence expectations.

## Lower-Agent Readiness
- Implementation scope is clear: Yes
- File boundaries are clear: Yes
- Acceptance criteria are observable: Yes
- Required checks are listed: Yes
- Brain update requirements are listed: Yes
- Ready for handoff: Yes

## Completion Report Requirements
Lower agent must report:
- Changed files
- Checks run
- Brain docs updated
- Unresolved issues
- Any skipped acceptance criteria

## Risks / Edge Cases
- Large Telegram audio files may exceed provider upload limits.
- Local transcriber may only be available on Apple Silicon and should remain optional.
- Persisting range transcripts can overwrite full transcripts if replacement behavior is not scoped carefully.

## Open Questions
- TODO: Decide whether range transcription should append/merge segments or replace the full transcript.

## Linked Task
- Task Title: Persisted Audio Transcription Flow
- Task File: brain/tasks/roadmap.md
