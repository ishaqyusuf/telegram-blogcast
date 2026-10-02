# Transcript Copy Arabic Vowels

- Status: Done — committed, pushed, and Android Preview OTA published
- Created: 2026-10-02
- Updated: 2026-10-02

## Scope and result

Full transcript Copy fetched saved source segments directly and skipped the Arabic vowels transformation used by the audio player and reader. When the toggle is enabled, Copy now awaits the existing cached on-device diacritizer for every saved segment before building the full flowing document and writing the clipboard. The shared action covers both Details and Read, including transcript segments outside the current display window. With the toggle disabled, Copy retains saved source text. Selected-text Copy already uses the displayed selection.

The existing pending state covers the transformation. Errors use the existing error toast and leave the clipboard untouched; no partially transformed document is copied.

## Verification and Brain impact

Tests, typechecks, lint, and UI testing are skipped at the user's explicit request. Source inspection confirms the existing transformation and error handling are reused. Preview bundling/publication is requested delivery work.

Updated the Audio feature. No API, database, native dependency, or architecture changes; no ADR is needed for this bug fix.

## Delivery

- Source and OTA version committed and pushed to `main` as `412bcd99b9f64020e04b11dca0b85a4977148a30`.
- Android Preview OTA `2026.10.02`: [EAS group `44ce243c-dfe1-422f-8742-4680fd0b3f9f`](https://expo.dev/accounts/ishaqyusuf/projects/alghurobaa/updates/44ce243c-dfe1-422f-8742-4680fd0b3f9f); Android update `01a0fe9f-d026-7b6a-882f-b8377a852920`; runtime `1.0.111`.
- Android export and publication succeeded with pinned EAS CLI `20.2.0` and the EAS Preview environment. Provider readback confirms the source commit, Preview branch, Android platform, and runtime. Installed-client uptake and clipboard behavior were not tested, as requested.
- The active Expo session belonged to another account; the existing repository account runner authenticated the configured project owner before publication. No native rebuild or backend deployment was needed.
