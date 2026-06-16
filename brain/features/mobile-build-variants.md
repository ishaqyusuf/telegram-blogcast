# Mobile Build Variants

## Purpose
Tracks Expo/EAS build-variant behavior for the Al-Ghurobaa mobile app.

## Current Behavior
- `apps/expo-app/eas.json` sets `APP_VARIANT=development` for development builds and `APP_VARIANT=preview` for preview builds.
- Development builds use `Al-Ghurobaa Dev`, `alghurobaa-dev`, `com.alghurobaa.podcast.dev`, and the existing dev-branded icon/splash assets.
- Preview builds use `Al-Ghurobaa Preview`, `alghurobaa-preview`, and `com.alghurobaa.podcast.preview`.
- Production-style builds keep the canonical name, scheme, and native identity: `Al-Ghurobaa`, `alghurobaa`, and `com.alghurobaa.podcast`.
- Preview and production currently share the standard launcher and splash artwork.

## Key Files
- `apps/expo-app/app.config.ts`
- `apps/expo-app/eas.json`
- `apps/expo-app/assets/icons/*`

## Notes
- Keep native package and bundle identifiers unique for side-by-side installs.
