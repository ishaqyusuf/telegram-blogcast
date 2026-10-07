# Release assurance runbook

## Operational releases

Use `bun release status|plan --preview` and `bun release --preview` for the shared operational flow. Main defaults to Production. `--only api,web,mobile-android` scopes a release without claiming other components were deployed. Prepare and commit `UPDATE_VERSION` before execution. The standalone API command is `bun run api:deploy --revision <full HEAD SHA>`; Preview uses `api:preview:deploy`. Both require a clean tree and preserve the root web link. Protected Preview health checks use `vercel curl`; Production also checks its public API origin. Mobile device/emulator testing is excluded for the October 7 task at the user's request.

Database and jobs currently have no isolated Preview targets. Preview mobile continues to share production data; API/web preview deployments do not establish end-to-end isolation.

## Before assurance activation

1. Create protected GitHub `preview` and `production` environments with
   separate `ALGHUROBAA_RELEASE_EVIDENCE_ENVELOPE` and HMAC-key secrets.
2. Require `release-assurance-preview` on pull requests to `main` and protect
   the Production environment from unreviewed execution.
3. Install a trusted collector that reads PostgreSQL schema state, Vercel,
   Expo, and Trigger through authenticated provider APIs and signs one fresh,
   exact-revision envelope. Never hand-author provider claims.
4. Provision an isolated Preview database/web origin and update the Expo
   Preview profile away from `https://alghurobaa.vercel.app` before claiming
   end-to-end Preview isolation.
5. Configure a Vercel promotion hold for Production candidates that require a
   database push.
6. Provision a distinct Trigger Preview worker, or approve a protected,
   exact-revision, short-lived waiver. Never use the Production worker as
   Preview proof.
7. Keep `eas-cli` pinned in the repository so native fingerprints are
   reproducible. Add iOS to the provider platforms only when an owned iOS
   build/update path is operational.

## Operator flow

```bash
bun run release:status --env preview
# perform listed effects through the existing guarded project commands
bun run release:check --env preview
```

Repeat for Production after merge. `release:check` verifies outcomes; it does
not run `db:push`, deploy Vercel, publish EAS, or deploy Trigger.

## Failure interpretation

- Missing baseline: every target is conservatively required.
- Native fingerprint unknown or changed: build a new Android binary.
- Native fingerprint equal with JS-only changes: publish a compatible OTA.
- Missing/stale/wrong-revision signature: do not release.
- Database proof missing: web and jobs cannot pass.
- Vercel domain not serving the claimed deployment: hold promotion.
- Preview jobs unsupported: provision isolation or obtain the protected waiver.
