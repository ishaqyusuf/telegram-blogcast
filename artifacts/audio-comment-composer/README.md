# Audio comment keyboard composer

Task: [Brain task](../../.brain/tasks/2026-10-01-audio-comment-keyboard-composer.md).

The selected reference is Ewatrade's existing Add Option interaction in `apps/mobile/src/components/mobile/keyboard-inline-composer.tsx`. The user explicitly requested that same interaction, then requested removal of the inline comment input and conversion of the separate timestamp pill into an input prefix. The final editor keeps a handle, title, rounded input, and right-side action. The optional timestamp has no prefix padding and cannot increase the input height.

## Android captures

- [Before refinement: inline input and FAB](before-scrolled.png).
- [Player top: FAB hidden](player.png).
- [Final Comments tab: FAB and no inline input](scrolled-fab.png).
- [Empty keyboard editor: Send disabled](keyboard-empty.png).
- [Typed editor: timestamp prefix and Send enabled](keyboard-typed.png).
- [Timestamp disabled: timer-only prefix](timestamp-off.png).
- [Reopened editor: text and timestamp choice retained](draft-reopened.png).

## Verification manifest

Tested the production components on the Pixel 3a API 34 Android emulator using the existing development build and Metro on port 8085. The lesson route was `/blog-view-2/1827`; the configured LAN API was unreachable from this emulator, so metadata remained unloaded. No real comment was posted.

Verified outer scroll → FAB, no inline input, autofocus/IME placement, blank send disabled, nonempty send enabled, timestamp toggle without losing input focus, close dismissal, draft and timestamp-choice retention, Android Back dismissal, and FAB hidden at the player top. Native accessibility trees confirmed input bounds `[252,930][836,1062]` when timestamp-enabled and `[156,930][836,1062]` when disabled: both are 132 pixels / 48 points tall. All new panel colors come from the audio screen's scoped palette.

Focused Biome lint, whitespace validation, and seven player visibility/registry tests pass. Full Expo typechecking retains unrelated existing workspace errors with no diagnostics in the changed files. Server submission, pending/failure UI, iOS, and large-text behavior were not exercised. Android Preview OTA `2026.10.01.01` is published for runtime `1.0.111`.

## Preview delivery

Source commit `d2ac3b5b1409738e23958e202d589e269a6cf229` was pushed to `main`. [Android Preview update](https://expo.dev/accounts/ishaqyusuf/projects/alghurobaa/updates/355225e9-9ed7-46c9-adea-c67dd3f0cac8) published successfully with version `2026.10.01.01`, runtime `1.0.111`, and Android update ID `01a0f84e-6586-74a0-94ec-fae5730c6dc4`. [Provider readback](preview-release-readback.json) confirms the channel, source revision, clean source tree, runtime, and Preview variant/version. Android export and publication passed. Installed-client uptake was not verified.
