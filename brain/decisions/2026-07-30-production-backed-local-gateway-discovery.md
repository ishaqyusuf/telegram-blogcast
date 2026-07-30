# ADR: Production-Backed Local Gateway Discovery

## Title
- Decision: Use a short-lived production lease to connect Expo preview builds
  to one local ngrok gateway.

## Status
- Accepted

## Context
- Compiled preview builds cannot reliably reach a developer computer through
  the LAN IP discovery that works in development.
- Normal application traffic must stay on the production Vercel API, while a
  small set of operational features still needs the local Next API,
  transcriber, and Facebook bridge.
- Free ngrok URLs can change between runs, so baking or persisting a tunnel URL
  in the app would quickly become stale.

## Decision
- The production database owns one `LocalGatewayLease`, renewed by the local web
  runner every minute and treated as expired after three minutes.
- Public clients may read the current lease. Only a constant-time-checked
  bearer token can publish or delete it, and published values are restricted to
  origin-only HTTPS `*.ngrok-free.app` URLs.
- Expo preview discovers and health-checks the lease but never persists it.
  Development keeps LAN-IP discovery; production does not use preview
  discovery.
- Only local-service tRPC calls use the tunnel. Preview transcription is queued
  through that local API, while direct device-to-worker transcription remains a
  LAN development feature. Main authentication, content, media, and production
  tRPC traffic remains on Vercel.
- Missing discovery, publisher failures, and unreachable tunnels fail closed
  for local-only features without blocking normal app startup.

## Consequences
- Benefits:
  - Preview builds require no manual IP configuration.
  - A crashed publisher self-heals through a short expiry.
  - URL validation and authenticated writes constrain endpoint hijacking.
  - The existing web runner remains the single local-service entrypoint and TUI
    surface.
- Tradeoffs:
  - The free ngrok domain changes across sessions and depends on the local
    runner remaining online.
  - The discovery read and tunneled local tRPC surface are public; their scope
    must remain minimal and input validation strict.
  - Preview local-only features can be unavailable while normal production
    features continue working.
- Follow-up work:
  - Monitor whether ngrok rate/interstitial behavior warrants a reserved domain
    or another tunnel provider.
  - Rotate `LOCAL_SERVICES_DISCOVERY_TOKEN` if publisher credentials are ever
    exposed.
