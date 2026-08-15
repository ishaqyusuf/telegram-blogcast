# ADR: Floating Sheets Suppress Persistent Footers

## Title
- Decision: Shared floating bottom sheets register presentation state so persistent footers yield while a sheet is visible.

## Status
- Accepted

## Context
- The global audio footer is rendered by a high-priority portal layer and could cover detached bottom-sheet actions, including transcription queue item options.
- Individual screens cannot safely save and restore one global hidden boolean because sheets may overlap or hand off to another sheet during dismissal.
- Every affected surface already uses the shared `FloatingBottomSheet` primitive.

## Decision
- Keep an id-based registry beside the shared floating-bottom-sheet primitive.
- Register a sheet before presentation and unregister it only after dismissal completes or the component unmounts.
- Let persistent global footer consumers derive suppression from whether the registry contains any open sheet.
- Keep explicit screen-level footer hiding separate for non-sheet workflows such as focused readers or full-screen routes.

## Consequences
- Benefits:
  - Every existing and future shared floating sheet automatically appears without the global audio footer covering its content.
  - Idempotent IDs support overlapping sheets and prevent one dismissal from revealing the footer while another sheet remains open.
  - Screens no longer duplicate fragile save/restore logic for this interaction.
- Tradeoffs:
  - The shared sheet primitive now publishes a small global presentation signal.
  - Custom modals that do not use `FloatingBottomSheet` must continue to manage footer visibility explicitly when needed.
- Follow-up work:
  - Validate presentation/dismissal transitions on Android and iOS when changing the shared bottom-sheet library or portal host.
