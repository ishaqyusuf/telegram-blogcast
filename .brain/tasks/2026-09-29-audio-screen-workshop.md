# Task: Audio Screen Design Workshop

- Status: Native implementation verified on Android — Preview publication pending
- Created: 2026-09-29
- Updated: 2026-09-29
- Artifact: [Audio screen comparison](../../artifacts/audio-screen-workshop/index.html)
- Notes and verification: [Workshop README](../../artifacts/audio-screen-workshop/README.md)
- Related work: [Media download controls and audio rename](2026-09-29-media-download-controls-and-audio-rename.md)

## Scope

Use the user's recording of the current Android audio experience and the latest source to compare three concrete directions for listening, transcript reading, and discussion.

## Progress

- [x] Review the recording's key visual states and relevant audio source/Brain context.
- [x] Build three interactive candidates: Immersive live, Reading room, and Lesson workspace.
- [x] Verify the rendered layouts and central local interactions in the in-app browser.
- [x] Capture the user's selection of direction 01 and refine the HTML preview.
- [x] Receive user approval to implement direction 01 in the native audio screen.
- [x] Implement the inline player, tabs, Details actions, and transcript footer in Expo.
- [x] Verify player, tabs, transcript scroll, and keyboard composer on Android emulator.
- [ ] Commit, push, and publish the Android EAS Preview update.

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

## Brain impact

The native UX behavior is documented in `.brain/features/audio.md` and the inline-audio-lesson ADR. No API or database contract changed.
