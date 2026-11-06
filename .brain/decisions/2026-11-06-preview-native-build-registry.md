# Preview native-build registry and OTA-compatible installation handoff

- Status: Accepted — API, updater OTA and registered Preview build 28 released
- Date: 2026-11-06

The user requested an EwaTrade/GND-style in-app APK update flow, with a native build started immediately and the updater delivered later through OTA. Existing API/project/URL/database connection settings must stay unchanged.

Use a dedicated `MobileBuildRelease` primary-key record containing validated public release metadata, optimistic revision and update time. Keep authenticated publication in the existing operator CLI rather than adding a publicly reachable mutation or new deployment secret. Advisory transaction locking also protects first publication; repeat publication is idempotent and lower build numbers are rejected.

The client compares native application identity and Android build number rather than OTA app version, and uses EwaTrade's browser installation fallback. This avoids introducing a native installer dependency into the already-started binary. Android remains responsible for installation permission and package/signature compatibility. The app revalidates registry availability before handoff, and suppresses expired artifacts.

Normal Preview builds register automatically only after provider and downloaded-APK verification. Publication failure is distinct from build failure and supplies a registration-only retry. Future native runtime changes still require a new build; this registry does not make incompatible OTA bundles eligible.

The November 6 Prisma diff adds only the registry table. Existing migration-history drift prevents `migrate dev` without a reset; no reset is permitted or performed. `db:push` applies the additive schema change, with settings and existing data preserved. No hand-authored migration is introduced.
