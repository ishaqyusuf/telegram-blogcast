# Automatic reader acceptance — 2026-09-08

Target: https://shamela.ws/book/11250/50. Android emulator `emulator-5556`, installed development client with current Metro JavaScript and deployed existing API. No OTA was published.

## Evidence
- `01-reader-skeleton.png`: selected page captured invisibly; native skeleton remains during saving.
- `02-book-11250-page50.png`: formatted Arabic reader, source page 50 / printed page 52. Incomplete chapters did not block reading.
- `03-adjacent-page51.png`: Next opened source page 51 / printed page 53 without a browser or Extract action.
- `04-simulated-verification.png`: a temporary DOM challenge fixture revealed the mounted WebView and native verification controls.
- `05-verification-resumed.png`: completing the fixture automatically invoked capture and hid the WebView. The harness deliberately rejected staging before any API write, producing the visible test message. This proves handoff, not a real Cloudflare solve.

The temporary fixture and staging override were removed before final checks and the app was reloaded into the production implementation. No fixture content was saved. A real CAPTCHA was not presented by Shamela during this run. iOS and physical-device behavior remain unverified.

Final restored-bundle horizontal swipe also opened source page 51 / printed page 53; see `06-final-swipe-next.png`.

## Automated checks
69 tests passed / 226 assertions across eight focused files, covering capture readiness, verification resumption, request races, prefetch priority, pause/resume, staged retries, chapter capture, navigation, reader positioning and saved items.

Scoped ESLint: zero errors, three pre-existing warnings. Full Expo typecheck remains unsuccessful due to existing project errors and missing Bun test declarations; no changed production-file diagnostics remain. `git diff --check` passed.
