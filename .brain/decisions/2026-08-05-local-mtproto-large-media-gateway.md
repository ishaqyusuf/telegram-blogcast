# ADR: Local MTProto Large-Media Gateway

## Status

Accepted

## Context

- Telegram's hosted Bot API cannot download files above 20 MB, leaving larger
  synchronized audio and video without in-app playback.
- The repository already has an authorized server-side GramJS session and an
  optional local Next gateway exposed to preview builds through a short-lived
  ngrok discovery lease.
- Telegram credentials must never be shipped to Expo, and normal production
  content/media traffic must remain usable while local services are offline.

## Decision

- Extend the optional local Next gateway with a server-side MTProto media
  backend. Resolve the application's stable `mediaId` to a source Telegram
  channel/message and download through the existing authorized GramJS session.
- Production (or local development) issues a time-limited, HMAC-signed bearer
  ticket bound to one media ID. Ticket requests require a stable installation
  identifier and are rate-limited; the local gateway independently rate-limits
  preparation and serializes downloads.
- Store completed files in a bounded local disk cache. Remove stale/failed
  partial files, reject files above the configured quota, evict by recent stream
  access, and serve only completed entries.
- Serve media with single-range HTTP semantics (`HEAD`, `200`, `206`, and
  `416`) and Unicode-safe content disposition. Expo prepares only media above
  the hosted download limit, shows progress/recovery states, and uses the
  signed local stream URL when ready.
- Preserve a Telegram/Facebook original-source action whenever the gateway is
  offline, unavailable, or fails. Small media continues through the existing
  hosted Bot API proxy.

## Consequences

- No Telegram credential or bot token is present in the mobile client.
- Large playback depends on the operator's local machine, authorized Telegram
  session, cache capacity, and tunnel availability; it is intentionally not an
  always-on production guarantee.
- The shared signing secret must match between the deployed and local web
  environments. Tickets are bearer capabilities and must not be logged or
  exposed beyond their playback URL.
- The current single-download queue favors predictable disk and Telegram rate
  usage over parallel preparation throughput.
- A future always-on service can retain the same client contract while swapping
  the backend to Telegram's local Bot API server or object storage.
