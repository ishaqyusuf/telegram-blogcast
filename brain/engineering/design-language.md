# Design Language

## Purpose
Captures the user-experience and visual-language constraints that shape the app surfaces.

## How To Use
- Update when the core theme, directionality, iconography, or shared interaction style changes.
- Keep implementation details in component files; use this doc for durable design rules.
- Reference this before redesigning major mobile or web surfaces.

## Template

### Visual Direction
- Dark Spotify-like theme with backgrounds around `#121212` and surfaces around `#1E1E1E`.
- Primary green accent: `#1DB954`.
- Clean, media-focused presentation across audio, blog, and book experiences.

### Content Direction
- Arabic-first and RTL-aware where content requires it.
- Prefer `writingDirection: "rtl"` and right-aligned text in Arabic reading surfaces.
- Preserve readability for long-form educational content.

### Component-Level Notes
- Icons: `lucide-react-native`.
- Bottom sheets: `@gorhom/bottom-sheet` v5.
- Audio UI uses persistent mini-player patterns and quick transport controls.

### Maintenance Notes
- When theme tokens or interaction patterns change, reflect the update here and in the relevant feature docs.
