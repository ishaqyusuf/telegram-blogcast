# Production-Backed ngrok Gateway Discovery

## Status
Implemented; the production database and shared token are configured. Vercel
deployment, publisher verification, and the preview release remain.

## Created Date
2026-07-30

## Objective
Let Expo preview builds find one active local API through a short-lived,
production-backed ngrok lease while keeping normal application traffic on the
production Vercel origin.

## Behavior
- Development retains automatic Expo/LAN discovery and saved IP history.
- Preview fetches
  `https://alghurobaa.vercel.app/api/local-services/discovery`, validates the
  lease, health-checks the ngrok origin, and enables local-only features only
  while that gateway is reachable.
- Preview never persists ngrok URLs or opens the manual-IP sheet. Missing,
  expired, or unreachable leases silently disable local-only features and leave
  the rest of the app available.
- Production does not use remote gateway discovery.
- Preview retries during startup, app foregrounding, network changes, explicit
  retry actions, bounded offline retry intervals, and one-minute online
  revalidation.

## Server Contract
- `GET /api/local-services/discovery` is public and returns either
  `{ url, expiresAt }` or `{ url: null, expiresAt: null }`.
- `PUT` and `DELETE` require
  `Authorization: Bearer $LOCAL_SERVICES_DISCOVERY_TOKEN`.
- Published URLs must be origin-only HTTPS hosts below
  `*.ngrok-free.app`.
- The singleton `LocalGatewayLease` uses key `preview-local-gateway` and expires
  three minutes after its latest renewal.
- Every response uses `Cache-Control: no-store`.

## Publisher
- The existing `@acme/www#dev` runner starts ngrok for port `3501`, reports the
  public URL in its TUI output, waits for the expected `/health` identity, then
  publishes immediately.
- The publisher renews every 60 seconds and attempts deletion during graceful
  shutdown. Publication failures remain non-fatal and crashes rely on lease
  expiry.
- Preview transcription is queued through the tunneled local tRPC API; direct
  device-to-worker transcription stays limited to LAN development.

## Verification
- Focused tests cover URL joining, ngrok validation, authentication, lease
  expiry/removal, publisher health waiting, heartbeat, shutdown, non-fatal
  configuration failure, preview lease parsing, unreachable gateways, LAN URL
  preservation, and gateway-scoped local query state.
