# Release assurance source integration

## Status

Done locally — hosted activation pending.

## Delivered

- Pinned shared release-only toolkit snapshot and checksum lock.
- Four-target Preview/Production manifest for database, combined web/API,
  Android mobile, and jobs.
- Repository-pinned EAS CLI for reproducible native fingerprints.
- Advisory local plan/status commands and fail-closed signed-evidence check.
- Protected verification-only GitHub workflow for pull requests and `main`.
- Focused ordering, OTA/build classification, signed-evidence, Preview waiver,
  and Production verification tests.
- ADR, feature, architecture, coding-standard, runbook, and progress docs.

## Validation

- `bun test scripts/release-assurance.test.ts`
- Scoped strict TypeScript for integration files
- Scoped Biome check
- GitHub workflow YAML parse
- Preview and Production `release:status`
- Missing-key fail-closed `release:check`
- Scoped diff hygiene

The repository-local EAS 20.2.0 fingerprint command reached the provider
client but could not complete its read-only GraphQL lookup in this environment.
Live provider collection therefore remains part of hosted activation; the
fingerprint contract and classification behavior are covered by focused tests.

`bun run check-deps` continues to report 32 pre-existing workspace dependency
mismatches outside this integration. The new pinned `eas-cli` dependency is not
among them.

No database push, Vercel deployment/promotion, Expo build/update, Trigger
deployment, provider setting, secret, or GitHub setting changed.
