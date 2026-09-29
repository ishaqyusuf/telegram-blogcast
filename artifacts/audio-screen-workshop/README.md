# Audio screen workshop

Three interactive design candidates for the Android audio screen. Open `index.html`, or serve this folder locally. The active preview is at `http://127.0.0.1:8849/`.

## Directions

1. **Immersive live (selected, revised)** — retain a full-screen transcript-led player, followed by inline Details, Comments, and Books on the same scrolling page.
2. **Reading room** — make the selectable transcript the main screen, with playback in a compact bottom dock. Best suited to reading and annotating while listening.
3. **Lesson workspace** — put transcript, comments, and books behind visible tabs while retaining the lesson and transport above them. Improves discovery of related content at the cost of transcript space.

Direct views: `?option=1`, `?option=2`, and `?option=3`.

## Selected direction revision

The user selected direction 01 and requested another preview with these changes:

- The player and the supporting sections share one outer scroll surface. The transcript keeps its own independent scroll area.
- Tabs appear at the lower edge of the initial full-screen player: **Details · Comments · Books**. Comments is selected by default.
- Selecting a tab scrolls its panel into view with approximately 160 pixels of player context retained above it. Scrolling back up restores the full-screen player.
- Details, Comments, and Books render inline, including comments opened from transport or selected transcript text.
- Saved/Download, Transcribed/Transcribe, and Copy are in Details. The transport sits lower and the transcript gains vertical space.
- The Live transcript heading row is removed. Read is a ghost button on the far left of the bottom transcript action row; flexible space separates it from Live on the far right. Live resumes following after manual transcript scrolling.
- The original three-way comparison remains available at `initial-comparison.html`. Options 02 and 03 remain available in the current comparison.

## Grounding

- User-supplied recording: `WhatsApp Video 2026-09-29 at 20.45.37 (1).mp4`, approximately 74.7 seconds. Visually reviewed through frames sampled every four seconds. The sample shows live transcript, scrolling to details, expanded reading, text selection, and comments.
- `assets/current-audio.png` is a still from that recording.
- Read the current `audio-blog-screen.tsx`, player header, transcript reader, Brain audio feature, active media-controls task, and project design language.
- Source contains Download, full Transcribe, and Copy controls absent from the recording. The workshop retains access to them.
- The Arabic transcript is neutral sample text created for comparing the layouts; it is not a transcription of the lesson.

## Interaction scope

Each phone has independent local state. Play/pause, speed, skips, scrubber, reader, text size, passage selection, timestamped comments, tabs, options, and a local title override are represented. No real audio, API, download, transcription, or comment service is used. Copy uses the browser clipboard only after a user action; Share displays a preview explanation. Reset clears all local state.

The comparison selector shows ready, loading, and missing transcript states. A generated-transcript action simulates a queued/loading state; the selector can show the completed result.

## Verification

- JavaScript syntax checked with `node --check`.
- Rendered and visually inspected all three candidates in the Codex in-app browser.
- Verified play/pause, speed changing to 1.25×, and five-second forward seeking.
- Verified expanded reader, drag selection of Arabic text, a quote/comment draft anchored to the selection start, and local submission retaining the quote and timestamp.
- Verified Comments and Books tabs, missing and loading transcript states, keyboard Reset activation, and the single-direction view.
- Browser console error inspection returned no errors.
- Saved the review image at `assets/comparison.png`.
- The original HTML comparison uses local sample state; native Android behavior is verified separately below.

Revision checks verified the default Comments tab and tab order, inline reveal without a section modal, utility actions in Details, independent transcript scroll, outer-page scrolling, return to the full-screen player, and inline local comment submission. The revised screenshots are `assets/revised-player.png` and `assets/revised-details.png`.

## Preview lifecycle

The local Python preview server was started for this workshop on port 8849 (execution session 15492). Keep it available during review. To restart: `python3 -m http.server 8849 --bind 127.0.0.1 --directory artifacts/audio-screen-workshop` from the repository root. Stop only this preview server after a final choice and implementation verification.

Direction 01 was selected for native implementation. The HTML comparison remains available as the design record.

## Native Android verification

The Expo development build on an Android emulator was checked for the full-screen player, default Comments tab, inline tab reveal with transport context, Details utilities, Books content, return to player, and independent transcript scrolling. The inline comment composer was checked with the software keyboard open; its input remains above the keyboard. Focused ESLint and `git diff --check` passed. No comment was submitted during verification.

The Android Preview update is [published on Expo](https://expo.dev/accounts/ishaqyusuf/projects/alghurobaa/updates/9ea27ce0-e9b7-4e80-a9cf-628f5a9665db) as `2026.09.29.01` for runtime `1.0.111`.

Screenshots: [player](assets/native-player.png), [Comments](assets/native-comments.png), [Details](assets/native-details.png), [Books](assets/native-books.png), and [comment keyboard](assets/native-comment-keyboard.png).
