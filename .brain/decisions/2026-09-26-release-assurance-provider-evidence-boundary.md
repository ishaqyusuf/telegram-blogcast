# Release assurance provider-evidence boundary

## Status

Accepted for source integration; hosted activation pending.

## Context

Alghurobaa ships through four owned release surfaces: PostgreSQL/Prisma, one
Vercel project rooted at `apps/www` that also hosts the API boundary, Expo
mobile, and Trigger jobs. The repository has Preview and Production Expo
profiles, but the operational build/update wrappers currently publish Android
only. Preview mobile points at the Production web origin, and the existing
Trigger Preview configuration shares the Production worker.

## Decision

Pin the shared release-only toolkit at
`ec653d87eb0b65bbac9235680d85eed6fdfd20a1` and keep the project manifest,
launcher, signed provider adapter, and workflow in this repository. Local
planning is advisory. Protected CI accepts only a fresh HMAC-signed provider
snapshot bound to `alghurobaa`, the requested environment, and exact Git SHA.

Database changes precede and propagate to web and jobs. Mobile JavaScript-only
changes may use an OTA only when the Android native fingerprint and runtime are
compatible; native inputs require a new Android build. The web deployment must
match Vercel project `prj_hzQU6ksZjPzQe2x5Gvf7zlVYrKki`, the mobile evidence
must match Expo project `9d8a8cd8-d310-4724-8a61-db39e6b56c9a`, and jobs must
match Trigger project `proj_ryiraaguagaettphjklm`.

## Consequences

The workflow performs no database push, web deployment, Expo publication, or
Trigger deployment. Missing/stale provider evidence fails closed. Preview jobs
require a distinct worker or a protected, expiring, exact-revision waiver;
Production jobs must never substitute as Preview proof. Preview mobile/backend
is not considered isolated while it points at the Production web origin. iOS
becomes a required platform only after the repository owns an iOS build/update
release path and the manifest/provider configuration is expanded accordingly.
