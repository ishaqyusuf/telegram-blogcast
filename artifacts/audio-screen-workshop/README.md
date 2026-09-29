# Audio screen workshop

Three interactive design candidates for the Android audio screen. Open `index.html`, or serve this folder locally. The active preview is at `http://127.0.0.1:8849/`.

## Directions

1. **Immersive live** — evolve the current transcript-led player with a stable title, explicit Read action, blue transport, and visible destinations for details, books, and comments. Recommended starting point because it retains the current listening hierarchy.
2. **Reading room** — make the selectable transcript the main screen, with playback in a compact bottom dock. Best suited to reading and annotating while listening.
3. **Lesson workspace** — put transcript, comments, and books behind visible tabs while retaining the lesson and transport above them. Improves discovery of related content at the cost of transcript space.

Direct views: `?option=1`, `?option=2`, and `?option=3`.

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
- Native Android behavior and real media services are outside this HTML workshop's validation.

## Preview lifecycle

The local Python preview server was started for this workshop on port 8849 (execution session 15492). Keep it available during review. To restart: `python3 -m http.server 8849 --bind 127.0.0.1 --directory artifacts/audio-screen-workshop` from the repository root. Stop only this preview server after a final choice and implementation verification.

No design has been selected for production. Follow-up feedback should refine or combine these numbered candidates.
