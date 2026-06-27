# Brain Intake: Album Blog Audio Polish

## Status
Approved

## Created Date
2026-06-27

## Last Updated
2026-06-27

## Raw Input
User requested a batch of album, blog post, audio, comments, search, sharing, and scroll behavior fixes: blog posts unique by album and most-recent display; channel-based album suggestion screen and add flows; old/flat audio comments UI with timestamp playback; audio bar timestamp index; floating blog menu; app-opening share links with caption previews in comments; large-screen scroll-to-top button; streaming search keyword suggestions; floating/sorted add-to-album modal; hide bottom player on album scroll and all screens; new album/edit album/album suggest keyboard avoidance with floating rounded footer; Tracks/Add album tabs with suggestions and reorder action; simple toast after adding to album; transcript auto-highlight bug in audio/read mode; double-click transcript playback; comment read mode text selection and inline edit; album search; search result blog cards showing add-album actions and album badge; audio screen showing album membership instead of another plus action.

## Generated Plans
- [x] Channel-Based Album Suggestions And Bulk Add - `brain/plans/2026-06-27-feature-channel-based-album-suggestions-bulk-add.md` - Status: Done
- [x] Album Screens Search Tabs And Sheet Polish - `brain/plans/2026-06-27-ux-ui-album-screens-search-tabs-sheet-polish.md` - Status: Done
- [x] Album-Aware Blog Lists And Cards - `brain/plans/2026-06-27-feature-album-aware-blog-lists-cards.md` - Status: Done
- [x] Flat Audio Comments And Timestamp Playback Polish - `brain/plans/2026-06-27-ux-ui-flat-audio-comments-timestamp-playback.md` - Status: Done
- [x] Fix Transcript Highlighting And Play Interactions - `brain/plans/2026-06-27-bug-fix-transcript-highlighting-play-interactions.md` - Status: Done
- [x] Comment Read Mode Inline Selection And Editing - `brain/plans/2026-06-27-ux-ui-comment-read-mode-inline-selection-editing.md` - Status: Done
- [x] Share Links And Comment Link Previews - `brain/plans/2026-06-27-feature-share-links-comment-link-previews.md` - Status: Done
- [x] Streaming Search Keyword Suggestions - `brain/plans/2026-06-27-feature-streaming-search-keyword-suggestions.md` - Status: Done
- [x] Universal Scroll-To-Top And Player Hide Behavior - `brain/plans/2026-06-27-ux-ui-scroll-to-top-player-hide-behavior.md` - Status: Done

## Recommended Execution Order
1. Channel-Based Album Suggestions And Bulk Add - establishes the album suggestion and channel-membership contract needed by later album UI polish.
2. Album Screens Search Tabs And Sheet Polish - builds on the suggestion contract and fixes the album-specific workflows.
3. Album-Aware Blog Lists And Cards - depends on album membership data being exposed consistently to list/detail cards.
4. Flat Audio Comments And Timestamp Playback Polish - restores the requested audio/comment interaction surface before transcript-specific fixes.
5. Fix Transcript Highlighting And Play Interactions - isolates the playback/highlight regression after the audio screen shape is stable.
6. Comment Read Mode Inline Selection And Editing - separate read-mode text behavior that can be verified independently.
7. Share Links And Comment Link Previews - adds linking behavior across app and comment surfaces.
8. Streaming Search Keyword Suggestions - independent search UX work.
9. Universal Scroll-To-Top And Player Hide Behavior - cross-screen polish best done after the main touched screens settle.

## Agent Recommendations
- Channel-Based Album Suggestions And Bulk Add: open-code - API and mobile state changes need precise contract work.
- Album Screens Search Tabs And Sheet Polish: antigravity - interaction-heavy UI work benefits from visual QA.
- Album-Aware Blog Lists And Cards: open-code - likely crosses API queries and card data models.
- Flat Audio Comments And Timestamp Playback Polish: antigravity - visual and keyboard behavior need device QA.
- Fix Transcript Highlighting And Play Interactions: open-code - playback state and transcript synchronization bug.
- Comment Read Mode Inline Selection And Editing: antigravity - text selection/editing ergonomics need visual QA.
- Share Links And Comment Link Previews: open-code - deep-linking and comment parsing are contract-heavy.
- Streaming Search Keyword Suggestions: open-code - data flow and debounced/streaming search behavior.
- Universal Scroll-To-Top And Player Hide Behavior: antigravity - cross-screen gesture/scroll polish needs visual QA.

## Merged Items
- Album suggest screen, suggest keyword lookup, channel-based suggestion, check/uncheck/mark all, add to respective album, Tracks/Add tab, Add tab suggestions, and track-tab reorder action were merged into the channel-based album suggestions plan because they share the same album suggestion/add workflow.
- Add-to-album floating modal, sorted album list, new album keyboard avoidance, edit album sheet keyboard avoidance, album suggest input keyboard avoidance, simple added-toast, and albums search were merged into the album screens polish plan.
- Blog posts unique by album, search result blog card album actions/badge, and audio screen album membership display were merged into the album-aware blog lists/cards plan.
- Old audio screen comments UI, flat comments, timestamp click-to-play, text blog comment input touch-up, and audio bar timestamp index were merged into the flat audio comments plan.
- Transcript auto-highlight stuck in audio/read mode and double-click-to-play transcript were merged into one transcript bug-fix plan.
- Large scrollable scroll-to-top button and hide bottom player on album/all-screen scroll were merged into one universal scroll/player behavior plan.

## Duplicate Or Existing Items
- Album same-channel add rules already exist in `brain/plans/2026-06-15-feature-album-add-flow-same-channel.md`; new plans focus on suggestion UI, keyword matching, album membership display, and sheet polish.
- Timestamped quick audio comments already exist in `brain/plans/2026-06-15-ux-ui-timestamped-quick-audio-comments.md`; new plan focuses on restoring/flattening the desired UI and timestamp playback polish.
- Persisted audio transcription already exists in `brain/plans/2026-06-15-feature-persisted-audio-transcription-flow.md`; new transcript plan is a playback/highlighting regression fix, not persistence.
- Premium audio/albums redesign already exists in `brain/plans/2026-06-16-ux-ui-audio-playback-albums-playlists.md`; new plans are narrower actionable fixes.

## Needs Clarification
- "Personal coding sync to brain" needs clarification: which personal coding rules or external source should be synchronized, and should the target be `brain/engineering/coding-standards.md`, `brain/AI_PROMPT_RULES.md`, or another Brain document?

## Skipped Items
- Personal coding sync to brain was not turned into a handoff-ready plan because the desired source and target are unspecified.

## Approval Notes
- Approved all nine handoff-ready generated plans on 2026-06-27 after the user said "proceed."
- Implemented all nine generated plans on 2026-06-27 after the user said "implement all."

## Handoff Notes
- Use `brain-batch-handoff` to convert approved plans into handoffs and queue items.
