# Task: Audio Screen Design Workshop

- Status: Done — native UI fidelity revision published
- Created: 2026-09-29
- Updated: 2026-09-30
- Artifact: [Audio screen comparison](../../artifacts/audio-screen-workshop/index.html)
- Notes and verification: [Workshop README](../../artifacts/audio-screen-workshop/README.md)
- Related work: [Media download controls and audio rename](2026-09-29-media-download-controls-and-audio-rename.md)

## Scope

Use the user's recording of the current Android audio experience and the latest source to compare three concrete directions for listening, transcript reading, and discussion.

## Progress

The 2026-09-29 Preview did not fully match direction 01. The user reopened the task on 2026-09-30, specifically identifying the Read screen and requesting Android screenshots for review. The revised title position, reader controls, dark inline sections, and removal of the stray floating player were implemented and verified on Android. Source and screenshots were pushed as `3d74d449`; that revision is now included in Android Preview OTA `2026.09.30.01`, published with the [audio download badge refinement](2026-09-30-audio-download-badge.md).

- [x] Review the recording's key visual states and relevant audio source/Brain context.
- [x] Build three interactive candidates: Immersive live, Reading room, and Lesson workspace.
- [x] Verify the rendered layouts and central local interactions in the in-app browser.
- [x] Capture the user's selection of direction 01 and refine the HTML preview.
- [x] Receive user approval to implement direction 01 in the native audio screen.
- [x] Implement the inline player, tabs, Details actions, and transcript footer in Expo.
- [x] Verify player, tabs, transcript scroll, and keyboard composer on Android emulator.
- [x] Commit, push, and publish the Android EAS Preview update.

## Accepted refinements

- Direction 01 retains the full-screen player at the top of a continuous scrolling page.
- Scroll gestures outside the transcript move the lesson page. Transcript gestures scroll its text independently.
- Inline tabs below the player are ordered **Details · Comments · Books**, with Comments selected by default. They do not open section modals.
- Tapping a tab from the player scrolls the inline section into view while retaining some transport context. Continuing to scroll moves through the content; scrolling back to the top restores the full-screen player.
- Saved/Download, Transcribed/Transcribe, and Copy move into Details, freeing space for the transcript and lowering the transport controls.
- Remove the Live transcript header row. Place Read as a ghost button at the far left of the transcript's bottom action row, with flexible space before Live at the far right. Live retains its return-to-follow behavior after manual transcript scrolling.

The original comparison is preserved in `artifacts/audio-screen-workshop/initial-comparison.html`. The active preview is `index.html?option=1`.

## Revision verification

Browser checks covered default tab/order, tab-triggered inline reveal, Details actions, independent transcript scrolling, outer-page scrolling, restoration of the full-screen player, and local comment submission without a section modal. Android emulator checks then verified the native player, default Comments tab, Details actions, Books tab, inline composer above the keyboard, independent transcript scrolling, and return to the player. Screenshots and the detailed scope are recorded in the artifact README.

The 2026-09-30 Android pass also verified the dark Read screen, text-size change, transcript scrolling, selection actions, reader Comment shortcut, and that no light floating player covers the inline tabs. Six revised native captures are linked in the artifact README. Focused Biome lint passed on the eight supporting files; `git diff --check` passed. The full Expo TypeScript check still reports repository-wide pre-existing errors, including the unchanged `opaque` WebView prop type error; no new error was reported in the changed screen or helpers.

## Brain impact

The native UX behavior is documented in `.brain/features/audio.md` and the inline-audio-lesson ADR. No API or database contract changed.

## Release

- Implementation commit `f7d3c66dae0c41632794fe35e00141d0992de437` was pushed to `origin/main`.
- Android EAS Preview update `2026.09.29.01` was published to the preview branch on runtime `1.0.111`: group `9ea27ce0-e9b7-4e80-a9cf-628f5a9665db`, Android update `01a0ef09-e2e1-744e-8395-43c93f69dea4`.
- Channel readback confirmed `preview` points to that branch and update, with the expected commit and update version. Sentry automatic source-map upload was disabled during OTA publication.
- Revision source `3d74d449` and Android screenshots were pushed on 2026-09-30. Android Preview OTA `2026.09.30.01` now includes this revision plus the download badge refinement, published from `64ce644c` on runtime `1.0.111` as [EAS group `bcfb0e29-1cf0-42f2-b4d1-b1b8840984d1`](https://expo.dev/accounts/ishaqyusuf/projects/alghurobaa/updates/bcfb0e29-1cf0-42f2-b4d1-b1b8840984d1). Channel readback confirmed its source and update version after the user's explicit OTA request.
