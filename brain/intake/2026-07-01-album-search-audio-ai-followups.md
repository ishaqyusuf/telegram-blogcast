# Brain Intake: Album Search Audio AI Followups

## Status
Partially Complete

## Created Date
2026-07-01

## Last Updated
2026-07-02

## Raw Input
User requested a follow-up batch for Alghurobaa covering audio seek flicker and replay reset, album author/book management, keyboard-safe add-to-album and album suggestion inputs, stackable floating bottom footer content, richer album suggestion footer actions, channel-aware search input behavior, search result type badge pills, album-aware bottom player/play modes, album track playback indicators, preserving current playback when opening another audio screen, and a DeepSeek-powered automatic album index workflow with review and approval.

Update: transcript read mode freezes briefly when opened, likely because the screen eagerly loads or renders the full transcript before first paint. Treat this as a React Native performance regression and follow the `react-native-best-practices` workflow: measure the read-mode open interaction, optimize the specific heavy path, re-measure, and validate on a long transcript.

## Generated Plans
- [x] Fix Audio Scrub Flicker And Ended Replay Reset - `brain/plans/2026-07-01-bug-fix-audio-scrub-flicker-replay-reset.md` - Status: Done
- [x] Prevent Audio Detail From Stealing Current Playback - `brain/plans/2026-07-01-bug-fix-audio-detail-does-not-steal-playback.md` - Status: Done
- [x] Album Track Playback Indicators And Row Controls - `brain/plans/2026-07-01-ux-ui-album-track-playing-controls.md` - Status: Done
- [x] Album-Aware Player Queue And Play Modes - `brain/plans/2026-07-01-feature-album-aware-player-modes.md` - Status: Done
- [x] Keyboard-Safe Add-To-Album And Album Suggestion Inputs - `brain/plans/2026-07-01-bug-fix-keyboard-safe-album-modals.md` - Status: Done
- [x] Stackable Floating Bottom Footer Registry - `brain/plans/2026-07-01-refactor-stackable-floating-bottom-footer.md` - Status: Done
- [x] Album Suggestion Selection Footer Actions - `brain/plans/2026-07-01-ux-ui-album-suggestion-selection-footer.md` - Status: Done
- [x] Album Author Management From Track Authors - `brain/plans/2026-07-01-feature-album-author-management.md` - Status: Done
- [x] Album Book Attachment Management - `brain/plans/2026-07-01-feature-album-book-attachments.md` - Status: Done
- [x] Search Input Channel Picker And Removable Channel Badge - `brain/plans/2026-07-01-feature-search-channel-picker-badge-query.md` - Status: Done
- [x] Search Result Blog Type Badge Pills - `brain/plans/2026-07-01-ux-ui-search-result-type-badge-pills.md` - Status: Done
- [x] AI Automatic Album Index Generation - `brain/plans/2026-07-01-feature-ai-album-index-generation.md` - Status: Done
- [x] AI Album Index Review And Approval - `brain/plans/2026-07-01-feature-ai-album-index-review.md` - Status: Done
- [x] Transcript Read Mode Performance Freeze - Status: Done

## Recommended Execution Order
1. Prevent Audio Detail From Stealing Current Playback - protects the global playback contract before adding album queue behavior.
2. Fix Audio Scrub Flicker And Ended Replay Reset - isolated playback bug work that should be verified early.
3. Album Track Playback Indicators And Row Controls - exposes correct play/pause state in album detail before richer play modes.
4. Album-Aware Player Queue And Play Modes - builds on stable album track/current-playback state.
5. Keyboard-Safe Add-To-Album And Album Suggestion Inputs - fixes reported regressions in existing album flows.
6. Stackable Floating Bottom Footer Registry - provides shared footer positioning for later floating controls.
7. Album Suggestion Selection Footer Actions - uses the shared footer behavior for album suggestion bulk actions.
8. Album Author Management From Track Authors - completes existing Author/Album author behavior in album detail.
9. Album Book Attachment Management - completes the already-modeled AlbumBookReference UI flow.
10. Search Input Channel Picker And Removable Channel Badge - updates the search input empty/typing state and URL filter contract.
11. Search Result Blog Type Badge Pills - visual search-result filtering/presentation that can follow the channel contract.
12. AI Automatic Album Index Generation - backend/DB work for generated album index JSON.
13. AI Album Index Review And Approval - review UI depends on persisted generated index runs.
14. Transcript Read Mode Performance Freeze - can be planned next as a focused performance regression; prefer it before broad Expo performance work if transcript reading is currently painful.

## Agent Recommendations
- Fix Audio Scrub Flicker And Ended Replay Reset: open-code - playback state and seek synchronization need careful store/event work.
- Prevent Audio Detail From Stealing Current Playback: open-code - behavior depends on route lifecycle and audio store ownership.
- Album Track Playback Indicators And Row Controls: antigravity - album row controls need visual/device QA.
- Album-Aware Player Queue And Play Modes: open-code - queue/play-mode state crosses store, TrackPlayer, and album APIs.
- Keyboard-Safe Add-To-Album And Album Suggestion Inputs: antigravity - keyboard/safe-area regressions need device QA.
- Stackable Floating Bottom Footer Registry: open-code - shared layout infrastructure should be implemented carefully.
- Album Suggestion Selection Footer Actions: antigravity - interaction-heavy footer controls need visual QA.
- Album Author Management From Track Authors: open-code - touches schema-backed author relations and album APIs.
- Album Book Attachment Management: open-code - existing API relations need UI completion and invalidation.
- Search Input Channel Picker And Removable Channel Badge: open-code - query params, API searchChannels behavior, and UI state must stay aligned.
- Search Result Blog Type Badge Pills: antigravity - mostly visual search-result polish.
- AI Automatic Album Index Generation: open-code - AI provider, JSON validation, DB persistence, and API contract work.
- AI Album Index Review And Approval: antigravity - review workflow is UI-heavy with approval/removal interactions.
- Transcript Read Mode Performance Freeze: open-code - profile the read-mode transition and replace eager full-transcript rendering/loading with the measured best fit, likely virtualized transcript rows or incremental chunk rendering rather than mounting all text at once.

## Intake Update Details
- Transcript read mode currently freezes for a while after tapping it before the reader appears.
- Suspected cause: the app is loading, transforming, or rendering the entire transcript synchronously during the transition.
- Best-practice direction: measure first with React Native DevTools/profiler or manual FPS/jank observation, then address the measured bottleneck. For long transcript UI, prefer a virtualized list (`FlatList`, `FlashList`, or existing app list primitive) or chunked/incremental rendering over a full `ScrollView`/single-text mount.
- Preserve transcript behavior: timestamp navigation, current segment highlighting, search/selection behavior, and playback interactions must continue to work.
- Acceptance target: opening read mode on a long transcript shows the screen quickly without a visible JS-thread freeze, renders additional transcript content progressively/virtually, and keeps scroll/playback interactions responsive.
- Completion: read mode now uses a virtualized `FlatList` of transcript segment rows, computes highlight spans per mounted segment instead of for the whole transcript, and keeps selection/comment support through per-row selection inputs instead of one full-transcript overlay.

## Merged Items
- Audio minute bar flicker and ended-track replay reset were merged into one playback bug plan because they share progress/seek/end-state handling.
- Album current-track indication and track-row play/pause icons were merged into one album track controls plan.
- Bottom player album display, repeat/play-next behavior, and album-context playback sequencing were merged into one album-aware player modes plan.
- Add-to-album modal keyboard hiding and album suggestion keyboard hiding were merged into one keyboard-safe album modal regression plan.
- Floating footer registration/stacking was separated from the album suggestion footer so shared infrastructure can be reused by multiple screens.
- Search input channel listing/filtering, channelId query behavior, and removable channel badge were merged into one search channel picker plan.
- DeepSeek album indexing was split into generation/persistence and review/approval because backend/AI and review UI can ship independently.

## Duplicate Or Existing Items
- Audio seek bar work exists in `brain/tasks/done.md` as "Audio seek bar"; the new plan is a regression/follow-up focused on remaining drag flicker.
- Album keyboard-safe sheet work exists in `brain/plans/2026-06-27-ux-ui-album-screens-search-tabs-sheet-polish.md`; the new plan treats the reported keyboard hiding as a regression.
- Channel-based album suggestion and mark-all behavior exists in `brain/plans/2026-06-27-feature-channel-based-album-suggestions-bulk-add.md`; the new plan focuses on the requested floating footer action layout and long-press behavior.
- Streaming search suggestions exist in `brain/plans/2026-06-27-feature-streaming-search-keyword-suggestions.md`; the new search plan focuses on channels in the input state, `channelId` query behavior, and removable channel badges.
- Search result album badges/add-to-album behavior exists in `brain/plans/2026-06-27-feature-album-aware-blog-lists-cards.md`; the new search badge plan focuses on blog type badge pills.
- Album/book relations already exist in `brain/features/audio.md`, `brain/features/books.md`, and `AlbumBookReference`; the new plan focuses on completing the album UI workflow.

## Needs Clarification
- None after 2026-07-01 clarifications.
- Clarified album authors: one album author is enough; when no album author is set, each track falls back to its own author.
- Clarified album suggestion delete icon: delete means delete the selected blog item and must show a floating bottom confirmation modal before deletion.
- Clarified album player modes: implement the complete play-mode set, including off/default, repeat one, repeat album, play next/album sequence, and shuffle album.
- Clarified DeepSeek model recommendation: use `deepseek-v4-flash` as the low-cost capable default, through the OpenAI-compatible DeepSeek API with `DEEPSEEK_API_KEY`.

## Skipped Items
- None.

## Approval Notes
- None.

## Handoff Notes
- Use `brain-batch-handoff` to convert approved plans into handoffs and queue items.
