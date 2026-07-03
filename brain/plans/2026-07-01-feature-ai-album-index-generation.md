# Plan: AI Automatic Album Index Generation

## Type
Feature

## Status
Done

## Created Date
2026-07-01

## Last Updated
2026-07-02

## Intake
- Intake File: brain/intake/2026-07-01-album-search-audio-ai-followups.md
- Intake Item: Auto album feature: click channel option "Automatic album index"; dump all media title, id, and currently created albums in that channel to AI (DeepSeek) so it indexes all media that should be in album and returns JSON index response. Save this index JSON to DB.

## Goal Or Problem
Users need an AI-assisted way to generate a proposed album-to-media index for a channel using existing media titles/ids and existing albums, with the raw AI JSON persisted for review.

## Current Context
Albums are channel-aware and media additions enforce same-channel rules. Existing AI helpers are embedded in `book.routes.ts` for Shamela extraction and currently document Anthropic/OpenAI/Gemini providers; no DeepSeek integration was found during intake. Album routes already compute suggestions from keywords, but this request asks for a larger channel-level AI indexing pass that persists a reviewable JSON result. As of the official DeepSeek API docs checked on 2026-07-01, `deepseek-v4-flash` is the lower-cost capable model, supports JSON output, has 1M context, and works through an OpenAI-compatible base URL with `DEEPSEEK_API_KEY`.

## Proposed Approach
Add an album auto-index generation backend flow. From a selected channel, gather all audio media in that channel with ids, titles, file names, blog captions, existing album ids/names/keywords, and current membership. Send a bounded prompt to DeepSeek `deepseek-v4-flash` requesting strict JSON with proposed memberships for existing albums only. Validate the JSON with zod, persist the raw and normalized response to new DB records, and expose a query for pending/generated index runs.

## Implementation Steps
- Define a strict JSON response schema for album index suggestions, including existing album id/name, existing media ids, confidence, and reason fields.
- Add DeepSeek provider support using `DEEPSEEK_API_KEY`, base URL `https://api.deepseek.com`, and default model `deepseek-v4-flash`.
- Use DeepSeek JSON Output by setting `response_format: { type: "json_object" }`, including the word "json" in the prompt, and giving an example response shape.
- Add DB models for album auto-index runs and suggested album/media assignments, or a JSON-backed run model plus normalized child rows if needed for review UI.
- Add a migration for the new persistence model.
- Add album/channel route mutation such as `album.generateAutomaticIndex({ channelId })`.
- In the mutation, gather bounded channel media data and existing channel albums.
- Prompt DeepSeek to return strict JSON only for existing album ids; validate and reject malformed output or unknown album/media ids with a useful error.
- Persist raw request metadata, raw AI response JSON, parsed normalized suggestions, provider/model, status, and errors.
- Add query endpoints to list index runs and get a run by id for review.
- Do not mutate actual album memberships during generation.

## Affected Files Or Areas
- `packages/db/src/schema/audio.schema.prisma`
- `packages/db/src/schema/media.schema.prisma`
- New Prisma schema/migration files if models are added
- `apps/api/src/trpc/routers/album.routes.ts`
- AI helper code in `apps/api/src/trpc/routers/book.routes.ts` or a shared API AI helper module
- `apps/api/src/trpc/routers/channel.route.ts`
- `brain/features/audio.md`
- `brain/api/contracts.md`
- `brain/database/schema.md`

## Acceptance Criteria
- A channel-level automatic album index generation mutation exists.
- The mutation sends only bounded, same-channel media and existing channel album data to DeepSeek.
- The default model is `deepseek-v4-flash`, using `DEEPSEEK_API_KEY` and the OpenAI-compatible DeepSeek API.
- The AI response is required to be strict JSON and is validated before being marked usable.
- Suggestions only target existing album ids and existing media ids from the selected channel.
- Raw AI response JSON and normalized suggestions are saved to the database.
- Generation does not add or remove media from albums.
- Failed AI calls or malformed JSON leave a persisted failed run with useful error details.
- Review UI can fetch generated runs and suggestion details by id.

## Test Plan
- Run Prisma validation/generation for the DB package.
- Run `bun --filter @acme/api typecheck`.
- Unit or smoke test JSON validation with valid and malformed AI responses.
- Manually run generation against a small channel with a mocked or real DeepSeek response.
- Verify no album memberships change until review approval.

## Brain Update Requirements
- Update `brain/features/audio.md` with automatic album index generation behavior.
- Update `brain/api/contracts.md` with generation/review endpoint contracts.
- Update `brain/database/schema.md` and `brain/database/relationships.md` for new models.
- Update `brain/tasks/done.md` after implementation.

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
- Large channels may exceed prompt limits; implementation should batch or cap input and surface truncation.
- AI may suggest media already in other albums or nonexistent ids; validator/reviewer must handle this.
- DeepSeek provider support should not break existing book AI provider flows.
- Persisted raw AI JSON may contain unexpected text; store it safely and render only validated normalized fields in UI.
- DeepSeek pricing and model names can change; keep the model configurable even though `deepseek-v4-flash` is the default.

## Open Questions
- None.

## Linked Task
- Task Title: AI Automatic Album Index Generation
- Task File: brain/tasks/roadmap.md

## Completion Notes
- Added `AlbumAutoIndexRun`, `AlbumAutoIndexAlbumSuggestion`, and `AlbumAutoIndexMediaSuggestion` persistence for generated runs, album-level suggestions, and suggested media rows.
- Added `apps/api/src/services/album-auto-index.ts` for bounded prompt snapshots, DeepSeek JSON calls, fenced JSON parsing, zod validation, and existing-ID normalization.
- Added `album.generateAutomaticIndex`, `album.getAutomaticIndexRuns`, and `album.getAutomaticIndexRun`.
- Generation stores request snapshot, raw AI response JSON, parsed response JSON, provider/model, status, counts, and failure errors. It does not mutate actual album memberships.
- Validation passed: `bun --cwd packages/db prisma-generate`; `bunx biome check apps/api/src/services/album-auto-index.ts apps/api/src/trpc/routers/album.routes.ts`; no-network Bun smoke test for `normalizeAlbumIndexResponse`.
- Validation limitation: full `bun --cwd apps/api typecheck` still fails on unrelated existing issues in `src/queries/posts.ts`, `src/trpc/middleware/auth-permission.ts`, `src/trpc/routers/blog.routes.ts`, and `src/utils/query-response.ts`.
