# Mobile Build Variants

## Purpose
Tracks Expo/EAS build-variant behavior for the Al-Ghurobaa mobile app.

## Current Behavior
- `apps/expo-app/eas.json` sets `APP_VARIANT=development` for development builds and `APP_VARIANT=preview` for preview builds.
- Development builds use `Al-Ghurobaa Dev`, `alghurobaa-dev`, `com.alghurobaa.podcast.dev`, and the existing dev-branded icon/splash assets.
- Preview builds use `Al-Ghurobaa Preview`, `alghurobaa-preview`, and `com.alghurobaa.podcast.preview`.
- Production-style builds keep the canonical name, scheme, and native identity: `Al-Ghurobaa`, `alghurobaa`, and `com.alghurobaa.podcast`.
- Preview and production currently share the standard launcher and splash artwork.
- Development silently tries the current Expo host, the last successful Local
  Services IP, and deduplicated successful history.
- Preview uses the production-backed ngrok discovery lease and does not persist
  tunnel URLs or expose manual-IP entry. If discovery or health validation
  fails, the app stays usable and local-only screens offer a simple retry.
- Production does not use preview gateway discovery.
- The home header always exposes connected, checking, or offline state beside
  Search. Development retains the saved-address and manual IPv4 sheet.
- Local-service routes and background observers become available only after the selected gateway returns the expected Al-Ghurobaa `/health` identity.

## Key Files
- `apps/expo-app/app.config.ts`
- `apps/expo-app/eas.json`
- `apps/expo-app/src/lib/local-gateway-discovery.ts`
- `apps/expo-app/src/components/local-services/use-local-services-connection.ts`
- `apps/expo-app/assets/icons/*`

## Notes
- Keep native package and bundle identifiers unique for side-by-side installs.
- Expo/EAS update checks are independent from the local-services session choice.
- Automatic and manual OTA reloads persist the focused stable Expo Router
  destination, consume it once after the running update identity changes, and
  restore it after navigation is ready. Unsaved forms, imports, overlays, and
  WebView workflows fall back to the nearest stable screen; a new external
  deep link takes precedence.
- OTA route restoration is enabled by default and can be disabled with
  `EXPO_PUBLIC_RESTORE_ROUTE_AFTER_OTA_UPDATE=false`.

## OTA Route Restoration Files
- `apps/expo-app/src/lib/ota-route-restoration.ts`
- `apps/expo-app/src/components/ota-route-restoration-provider.tsx`
- `apps/expo-app/src/hooks/use-launch-auto-update.ts`
- `apps/expo-app/src/screens/updates-screen.tsx`
