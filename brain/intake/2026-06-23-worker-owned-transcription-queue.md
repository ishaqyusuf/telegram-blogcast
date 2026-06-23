# Intake: Worker-Owned Transcription Queue

## Status
Approved

## Created Date
2026-06-23

## Source
- User request: make the local service check the DB/API for queued transcription work, update DB progress, and let mobile stream/observe progress.

## Summary
Move queued transcription execution out of the Expo app and into the local transcriber service. The app remains responsible for enqueueing jobs and observing progress. The API owns job claiming, progress persistence, retries, completion, and transcript saving.

## Selected Plan
- `brain/plans/2026-06-23-feature-worker-owned-transcription-queue.md`

## Readiness
- Implementation scope is clear: Yes
- File boundaries are clear: Yes
- Acceptance criteria are observable: Yes
- Ready for handoff: Yes

