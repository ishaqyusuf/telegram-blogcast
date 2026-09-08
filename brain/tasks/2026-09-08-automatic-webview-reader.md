# Automatic WebView Reader

## Status
Done — implemented and checked on the Android emulator; platform limitations recorded below.

## Source
User approved the detailed implementation plan and explicitly selected a concealed mobile WebView. Direct HTTP source fetching is excluded. CAPTCHA must reveal the same WebView and automatically resume extraction after verification. Acceptance book: https://shamela.ws/book/11250/50.

## Checklist
- [x] Shared foreground WebView controller, request identity, bounded readiness, automatic capture and promotion.
- [x] Same-instance verification reveal, cancellation, source recovery, and accessibility isolation.
- [x] Reader skeleton route for pasted links and chapter taps; swipe and missing-page integration.
- [x] One adjacent-page prefetch, navigation priority, consumer cancellation, app/network pause and recovery.
- [x] Independent chapter capture; no schema/API changes or HTTP source fallback.
- [x] Complete focused validation and emulator acceptance using the requested book.
- [x] Record final evidence and limitations.

## Validation
- Initial emulator run: missing Shamela 23833/110 automatically captured behind the native skeleton and opened formatted reader content (printed page 87) without opening the source or pressing Extract.
- Final suite: 69 tests passed, 226 assertions, eight focused files. Scoped ESLint has zero errors and three pre-existing warnings. No changed production-file type diagnostics; full Expo typecheck retains unrelated project errors and missing Bun test declarations. Diff whitespace check passed.
- User's book 11250/50 automatically captured and opened as printed page 52 without waiting for chapters. Next opened source page 51 / printed page 53. Final restored implementation reopened page 50 successfully and horizontal swipe opened page 51.
- Native simulated challenge revealed the same WebView; completing it automatically resumed capture and hid the WebView. The temporary staging override rejected all fixture writes, and both test-only source modifications were restored before final checks. Real CAPTCHA and iOS behavior remain unverified.
- Screenshots and full validation notes: [acceptance report](../../artifacts/book-qa/automatic-reader/README.md).

## Boundaries
- Foreground acquisition only. Resume re-resolves work after app/network interruption; closed-app extraction is not guaranteed.
- Session metadata and staged IDs are bounded in memory. Existing server records survive process death; an interrupted unsaved capture can be reacquired on reopening.
- Existing full-book offline storage is unchanged; the new loader uses the reader query cache and saved server pages.
- No native dependency change is required.

## Release — 2026-09-08
- User authorized committing all current code, pushing main, and updating EAS preview.
- Code snapshot committed and pushed to main: `8084f8ce3391c1a9c1bc2681d528eabd8f94eef5`. It also includes the then-present portable book-cache format and its nine passing tests from concurrent work. Later edits from that task are outside this release.
- Published Android preview `2026.09.08.03`, runtime `1.0.111`, from an isolated checkout of that commit. Android export succeeded; EAS update metadata confirms the source commit and runtime.
- Update group: `deca8137-6bcc-44cb-9573-f944d8068d9c`; Android update: `01a08298-c018-7ca2-88f0-32481e8e5874`.
- [EAS dashboard](https://expo.dev/accounts/ishaqyusuf/projects/alghurobaa/updates/deca8137-6bcc-44cb-9573-f944d8068d9c). Sentry source-map auto-upload was disabled, consistent with the prior preview release.
- Publication verified; installation of this OTA on a preview device was not checked.
