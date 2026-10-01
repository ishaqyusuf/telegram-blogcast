# Audio Comment Keyboard Composer

- Status: Done — Android Preview OTA published
- Created: 2026-10-01
- Updated: 2026-10-01
- Evidence: [Native screenshots and verification](../../artifacts/audio-comment-composer/README.md)
- Reference: Ewatrade mobile `components/mobile/keyboard-inline-composer.tsx`, used by catalog Add Option.

## Scope and result

The user requested Ewatrade's keyboard-entry interaction for audio comments, with a FAB appearing after scrolling. The final refinement removes the Comments-tab inline input and moves time from a separate pill into a compact, padding-free prefix inside the keyboard input. The prefix toggles timestamp inclusion without changing the 48-point input height. The panel retains its handle, title, close control, autofocus, and right-side send action.

Comment entry shares the existing mutation through `useCommentDraft`. New drafts capture the viewed lesson's timestamp; zero is preserved and another playing lesson cannot supply the timestamp. Draft text and timestamp choice survive Close and Android Back. Pending and blank sends are disabled; failures retain the text and show inline feedback. Persistent footers yield through the existing sheet registry. The removed inline composer no longer drives outer-page keyboard scrolling.

## Verification

- Android Pixel 3a API 34 emulator: FAB appears after outer-page scrolling; Comments has no inline input; opening focuses the keyboard panel directly above the IME; empty Send is disabled and typing enables it.
- Native accessibility tree: toggling the prefix changes selected state while text-input height stays 132 pixels / 48 points and focus remains true. Reopening retains `A test comment` and the disabled timestamp choice. Close and Android Back dismiss the panel; returning to the player top hides the FAB.
- Focused Biome lint on the composer, shared draft hook, existing CommentInput, and player-layering test passes; `git diff --check` passes. Seven player visibility/registry tests pass. The layering test now checks the current visibility-policy wiring instead of the removed inline negation.
- Full Expo TypeScript check still reports existing workspace/API/Bun type errors; no diagnostic names the changed audio screen, composer, CommentInput, or draft hook. The existing screen also has pre-existing Biome violations.
- The emulator's configured LAN API did not load lesson metadata. No real comment was posted during UI QA; server submission, pending/failure rendering, and iOS remain unverified. Submission uses the existing API mutation and invalidation behavior.

## Brain impact

Updated the Audio feature and inline lesson layout ADR. No API, auth, database, or native dependency changes. The user requested commit, push, and Android Preview OTA publication. Android Preview OTA `2026.10.01.01` is published on existing runtime `1.0.111`.

## Delivery

- Source and OTA version bump committed and pushed to `main` as `d2ac3b5b1409738e23958e202d589e269a6cf229`.
- Android Preview OTA `2026.10.01.01`: [EAS group `355225e9-9ed7-46c9-adea-c67dd3f0cac8`](https://expo.dev/accounts/ishaqyusuf/projects/alghurobaa/updates/355225e9-9ed7-46c9-adea-c67dd3f0cac8); Android update `01a0f84e-6586-74a0-94ec-fae5730c6dc4`; runtime `1.0.111`.
- Android export and EAS publication passed. Exported source maps include the new composer and shared draft hook. Preview channel readback confirmed the exact source commit, clean working tree, Android platform, runtime, Preview app variant, and update version. [Readback evidence](../../artifacts/audio-comment-composer/preview-release-readback.json).
- Used pinned EAS CLI `20.2.0`, the EAS Preview environment, and the existing disabled Sentry automatic source-map upload setting. No native rebuild or backend deployment was needed for this UI change. Installed-client uptake remains unverified.
