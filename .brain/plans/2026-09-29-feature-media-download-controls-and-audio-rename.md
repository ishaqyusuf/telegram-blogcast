# Plan: Media Download Controls and Audio Rename

## Status
In progress. See [task](../tasks/2026-09-29-media-download-controls-and-audio-rename.md).

## Goal
Give audio, PDF, and video a visible download-only action. Audio Play should start playback and an offline download together. Allow each audio item to have a searchable renamed title while preserving its original title.

## Current implementation
- Expo feed audio controls (`components/blog-card/card-footer.tsx`) and album track rows (`screens/album-detail-screen.tsx`) show Play and an offline color state. Android `store/audio-store.ts` streams and starts `cacheMedia` in parallel. iOS `store/audio-store.ios.ts` also downloads during playback but writes directly to its final path and needs the same completion checks as Android.
- `lib/media-cache.ts` already supports audio, video, and document storage with partial-file promotion. `lib/downloaded-audio.ts` resolves a completed audio by media ID. The PDF screen uses `storePdf` and the video screen uses `cacheMedia` as soon as each reader opens. Neither exposes a separate Download action.
- `Media.title` is the existing title and `File.fileName` is source metadata. There is no separate rename/override column. `blog.routes.ts` and `album.routes.ts` search `Media.title` and filename. Album rows and the post serializer (`apps/api/src/queries/posts.ts`) have separate title fallbacks.
- Album track options and audio detail options already use bottom sheets. Existing album/blog mutation routes are `publicProcedure`; a new write route must have an explicit authorization decision before release.

## Feature 1: Explicit downloads
1. Define a shared mobile download action around the existing `cacheMedia` and `storePdf` paths. Resolve by stable media ID, source URL, filename and expected size; keep the same cache identity whether Play/Open or Download starts first. Expose idle, downloading with progress, completed, and retry states. Deduplicate concurrent requests and notify visible cards when a file completes.
2. Add a small, independently pressable download badge at the lower edge of the Play control on feed audio cards and album track rows, following the supplied reference. Its hit target and accessibility label must be separate from Play. Add an explicit Download action in the audio player/options sheet. Download alone must not load, replace, pause, or start the active track.
3. Keep audio Play behavior: use a valid local file first; otherwise start remote playback and download in parallel. Make the iOS path use verified, atomic storage and media-ID identity, as on Android. A failed background download must not stop successful streaming; show an actionable retry. The completed indicator must appear only after file validation.
4. Add Download controls to the PDF and video viewers (and their feed cards where the media action appears). PDF Open may still download to render; video Open may still prepare a full local copy. Explicit Download must save without opening or playing. Reuse the same cached file when the viewer opens later. Show progress, success, and retry; do not duplicate downloads.
5. Resolve Telegram-hosted, Blob, and local-gateway media through the existing source helpers. For external-only Facebook media and unavailable/oversized Telegram files, hide or disable Download with the existing source explanation. Do not promise offline availability until the device file exists.

## Feature 2: Searchable audio rename
1. Add nullable `Media.titleOverride String?` in `packages/db/src/schema/media.schema.prisma`. Keep `Media.title` and `File.fileName` intact, and never put the override in `Blog.meta`. No backfill is needed. Resolve the visible audio title as `titleOverride` (nonempty), then the existing title, filename, caption, and final fallback in the current order for each surface. When an override exists, show it as the title rather than prepending the caption or filename; keep the caption as separate supporting text. Clearing the rename writes `null` and restores the existing fallback.
2. Add an audio-only `updateMediaTitleOverride` tRPC mutation with a media ID and a trimmed, length-limited `titleOverride` (or `null`). Validate that the media is audio and exists. Enforce an authenticated editor/owner role or an explicitly documented trusted-local write boundary before exposing this new persistent write.
3. Add Rename to each audio track's album options and to the audio-detail options sheet. Open a prefilled, keyboard-aware editor with Save and Reset to original. Show pending and error states; on success update/invalidate album, blog detail, feed, search, queue, and player metadata so every visible title agrees. Preserve playback and cache identity; renaming must not change the stored filename or trigger a redownload.
4. Include `titleOverride` in the album track query, playback queue, blog/detail/post serialization, and relevant web display contracts. Use one title resolver for audio card, album row, queue, player, share/accessibility labels, and options header. Do not confuse the new field with the existing post DTO's derived `displayName`.
5. Add `titleOverride` to album track search and blog/global search predicates. Include it in local filtering/highlighting and any audio suggestion/index text used for discovery. Keep original title/filename searchable as source terms unless product requirements change; display the override on results. Verify a rename is searchable after persistence and after an offline metadata refresh.

## Feature 3: Direct transcript actions
1. Put a compact Transcribe action in the audio screen's transcript area. A tap queues one full-range transcription job through the existing local-service queue without opening the transcription page. Repeated taps while queued/running must not create another job. Show spinner/progress for queued/running, a green completed state only after the full transcript is saved, and a retry state on failure. Keep the existing options workflow for advanced controls.
2. Add Copy transcript beside the direct action. Fetch all persisted segments through `blog.getTranscript`, order them by start time, and concatenate their text with natural separators. Copy the complete result to the system clipboard, independent of the currently loaded transcript windows or selection. Disable the action until saved text exists; after copying show confirmation. The copy action must never start transcription.

## Order and verification
1. Implement and verify the shared download states, then add audio, PDF, and video controls.
2. Apply the additive Prisma change, generate the client, implement the mutation and queries, then the rename UI and search. Follow root `AGENTS.md`: because both root scripts exist, run `bun db:migrate` and `bun db:push` after the schema change; do not hand-create migrations. Confirm the target database and rollout sequence before running them.
3. Test audio Play plus download and Download alone on Android and iOS; switching tracks mid-download; duplicate taps; app restart; missing URL; failed/partial download; PDF and video open after explicit download; large gateway media; and no network with a valid local file.
4. Test rename, reset, empty/long/RTL titles, two tracks in one blog, search by override and original term, stale cached queries, and preservation across Telegram re-import and app restart. Check API authorization for the mutation.
5. Update Brain feature, database, API contract/permission, and task documents with the implemented behavior. Add an ADR if the permission boundary or storage architecture changes durably.

## Acceptance criteria
- Download on an audio card or album row stores a complete offline file without starting playback; Play starts playback and a download when needed.
- Download controls on PDF and video store their media without opening/playing, and the viewers reuse that file.
- A downloaded state means a verified file exists; failure exposes retry; simultaneous requests use one transfer.
- Rename appears for each audio item, is persisted separately from its original title, appears across audio surfaces, and is found by global and album search. Clearing it restores the previous title.
- The rename mutation has a documented, enforced write boundary.
