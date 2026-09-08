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
- No native dependency change is required. User subsequently authorized committing all current code, pushing main, and publishing Android EAS preview 2026.09.08.03; release evidence will be recorded after publication.
