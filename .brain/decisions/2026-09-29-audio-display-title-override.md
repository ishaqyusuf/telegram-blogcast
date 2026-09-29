# Audio Display Title Override

- Date: 2026-09-29
- Status: Accepted

## Context

Audio needs a user-editable name while preserving the imported or original media title and making the edited name searchable outside JSON metadata.

## Decision

Store the editable name in nullable `Media.titleOverride`. Display it ahead of `Media.title` and `File.fileName`; clearing it restores the existing fallback. Search both the override and original fields. The rename API only accepts audio media.

## Consequences

The database change is additive and existing audio keeps its current name. Feed, album, detail, and web readers should apply the same precedence. The current blog router uses public procedures, so scoped rename authorization requires a separate API auth change.
