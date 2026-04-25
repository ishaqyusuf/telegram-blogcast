# Design Language

## Purpose
Captures the user-experience and visual-language constraints that shape the app surfaces.

## How To Use
- Update when the core theme, directionality, iconography, or shared interaction style changes.
- Keep implementation details in component files; use this doc for durable design rules.
- Reference this before redesigning major mobile or web surfaces.

## Template

### Visual Direction
- GND Expo-inspired token system: light surfaces use slate-50/white with slate foreground; dark surfaces use slate-900/slate-800 with slate-200 foreground.
- Primary accent is blue (`rgb(30, 64, 175)` light, `rgb(96, 165, 250)` dark); avoid hard-coded Spotify green/black surface colors.
- Use NativeWind semantic tokens (`bg-background`, `bg-card`, `border-border`, `text-foreground`, `text-muted-foreground`, `bg-primary`) across app surfaces.
- Clean, media-focused presentation across audio, blog, and book experiences, with accent swatches drawn from the GND-compatible blue/teal/amber/indigo/rose palette.

### Content Direction
- Arabic-first and RTL-aware where content requires it.
- Prefer `writingDirection: "rtl"` and right-aligned text in Arabic reading surfaces.
- Preserve readability for long-form educational content.

### Component-Level Notes
- Icons: Hugeicons via the shared `Icon` wrapper; icon color resolution must respect the active NativeWind color scheme.
- Bottom sheets: `@gorhom/bottom-sheet` v5.
- Audio UI uses persistent mini-player patterns and quick transport controls.

### Maintenance Notes
- When theme tokens or interaction patterns change, reflect the update here and in the relevant feature docs.
