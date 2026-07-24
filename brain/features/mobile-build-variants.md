# Mobile Build Variants

## Purpose
Tracks Expo/EAS build-variant behavior for the Al-Ghurobaa mobile app.

## Current Behavior
- `apps/expo-app/eas.json` sets `APP_VARIANT=development` for development builds and `APP_VARIANT=preview` for preview builds.
- Development builds use `Al-Ghurobaa Dev`, `alghurobaa-dev`, `com.alghurobaa.podcast.dev`, and the existing dev-branded icon/splash assets.
- Preview builds use `Al-Ghurobaa Preview`, `alghurobaa-preview`, and `com.alghurobaa.podcast.preview`.
- Production-style builds keep the canonical name, scheme, and native identity: `Al-Ghurobaa`, `alghurobaa`, and `com.alghurobaa.podcast`.
- Preview and production currently share the standard launcher and splash artwork.
- All build variants silently try the last successful Local Services IP first, then deduplicated successful history. Development may additionally fall back to the current Expo host.
- Preview and production no longer block cold launch with an IP sheet. If discovery fails, the app stays usable and the home header reports Local Services as offline.
- The home header always exposes connected, checking, or offline state beside Search. Its floating bottom sheet supports saved-address discovery, explicit health-check feedback, and manual IPv4 entry.
- Development builds retain Expo-host discovery while sharing the same saved-history fallback and status UI.
- Local-service routes and background observers become available only after the selected gateway returns the expected Al-Ghurobaa `/health` identity.

## Key Files
- `apps/expo-app/app.config.ts`
- `apps/expo-app/eas.json`
- `apps/expo-app/assets/icons/*`

## Notes
- Keep native package and bundle identifiers unique for side-by-side installs.
- Expo/EAS update checks are independent from the local-services session choice.
