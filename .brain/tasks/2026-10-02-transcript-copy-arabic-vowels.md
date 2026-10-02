# Transcript Copy Arabic Vowels

- Status: In Progress — implementation complete; commit, push, and Preview OTA pending
- Created: 2026-10-02
- Updated: 2026-10-02

## Scope and result

Full transcript Copy fetched saved source segments directly and skipped the Arabic vowels transformation used by the audio player and reader. When the toggle is enabled, Copy now awaits the existing cached on-device diacritizer for every saved segment before building the full flowing document and writing the clipboard. The shared action covers both Details and Read, including transcript segments outside the current display window. With the toggle disabled, Copy retains saved source text. Selected-text Copy already uses the displayed selection.

The existing pending state covers the transformation. Errors use the existing error toast and leave the clipboard untouched; no partially transformed document is copied.

## Verification and Brain impact

Tests, typechecks, lint, and UI testing are skipped at the user's explicit request. Source inspection confirms the existing transformation and error handling are reused. Preview bundling/publication is requested delivery work.

Updated the Audio feature. No API, database, native dependency, or architecture changes; no ADR is needed for this bug fix.

## Delivery

Commit, push, and Android Preview OTA publication pending.
