# Inline Audio Lesson Layout

- Date: 2026-09-29
- Status: Accepted
- Task: [Audio screen workshop](../tasks/2026-09-29-audio-screen-workshop.md)

## Context

The audio detail screen gave the transcript limited space and opened comments as a separate full-screen view. The user selected workshop direction 01 after reviewing the current Android recording and interactive comparisons.

## Decision

Keep the player as the first full-screen section of one vertical lesson page. The transcript has its own scroll surface; gestures outside it move the lesson page. Place inline tabs directly below the player in the order Details, Comments, Books, with Comments selected by default. A tab tap reveals the selected section while leaving part of the transport visible. Scrolling up returns to the full-screen player. Comments opened from the audio options or an `openComments=1` link use this inline section.

Move Download/Saved, full Transcribe/Transcribed, and Copy to Details. Put Read as a transparent ghost button at the far left of the transcript footer and Live at the far right, separated by flexible space. Live resumes transcript follow after manual scrolling when the viewed audio is active. Keep the existing full-screen selectable read mode and existing book-reference behavior.

## Consequences

The player has more transcript space and a lower transport. Comments and books remain part of the same scroll journey. The inline comment composer must scroll above the software keyboard. The layout does not change media, transcription, comment, or book APIs.
