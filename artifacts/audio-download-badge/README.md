# Audio download badge verification — 2026-09-30

The user requested that downloaded audio use only the existing blue play/pause state, without a completed-download check mark. Unsaved audio retains the small download action beside Play.

Native Android checks used the existing Pixel 3a development binary against the public API. Feed and album rows showed independent unsaved download buttons. Tapping Download on lesson 25 in `منهج السالكين ٢` displayed progress, completed without starting playback, changed Play to blue, and removed the badge. The previously saved `٣٥ - كتاب الحج` also showed blue Play with no badge. Both saved controls retained `Play track — Downloaded, available offline` accessibility labels and rendered correctly in Light and Dark.

- [Unsaved feed audio](feed-unsaved.png)
- [Saved album controls in Light](album-saved-light.png)
- [Saved album controls in Dark](album-saved-dark.png)

Focused ESLint, Biome lint, and the existing downloaded-audio tests passed (2 tests, 3 assertions). No native, API, or database change was needed. The temporary development API override was removed after verification.
