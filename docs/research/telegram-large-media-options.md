# Telegram large-media delivery options

Research date: 2026-08-05

## Implemented project decision

The first repository implementation uses the same gateway contract described
below, backed by the existing **server-side GramJS/MTProto session**. This avoids
migrating the bot away from Telegram's hosted Bot API and fits the project's
optional local-services model: the gateway resolves a stable `mediaId` to its
source channel/message, prepares it into a size-bounded local cache, and serves
signed HTTP byte ranges. The Expo client never receives Telegram credentials and
keeps the original-source fallback while the gateway is offline.

The local Bot API recommendation remains the preferred always-on deployment
alternative if the project later operates a dedicated media host and is willing
to migrate all Bot API traffic for that bot. The client-facing API does not need
to change when swapping the backend.

## Recommendation

Use a **project-owned media gateway backed first by Telegram's official local
Bot API server in `--local` mode**. Keep Telegram credentials entirely on the
service machine. The app should request a short-lived, signed stream URL for a
stable application `mediaId`; the gateway should map that ID to the Telegram
`file_id`, ask the local Bot API server to materialize the file, cache it on
disk, and serve the cached file with HTTP byte-range responses.

This is the best first implementation for this repository because it preserves
the existing Bot API `file_id` database model and the existing 20 MiB/50 MiB
Facebook-import workflow while removing both hosted Bot API limits. Telegram's
official local server documents downloads without a size limit and uploads up
to 2000 MB. It also returns an absolute local `file_path`, which is exactly the
handoff point a small range-serving gateway needs. [Bot API local-server
documentation](https://core.telegram.org/bots/api#using-a-local-bot-api-server),
[official server README](https://github.com/tdlib/telegram-bot-api#usage).

Do not make Expo or the web app a Telegram client for this feature. A direct
client would either expose a bot token (full control of the bot) or introduce a
Telegram user-login/session into every app installation. Telegram explicitly
says that anyone with a bot token has full control of the bot. [Telegram bot
documentation](https://core.telegram.org/bots#how-do-i-create-a-bot).

MTProto/TDLib remains a good second backend for the same gateway, especially if
the product later needs Premium-account 4 GB uploads or wants to fetch directly
from a source channel message. It should not be the client-facing contract.

## Current constraints verified from Telegram

| Path | Download | New upload | Important behavior |
| --- | ---: | ---: | --- |
| Hosted Bot API (`api.telegram.org`) | 20 MB | 50 MB for ordinary audio/video/documents; 10 MB photos | `getFile` links are guaranteed for at least one hour; existing Telegram `file_id` reuse has no re-upload limit. |
| Self-hosted Bot API with `--local` | No documented size limit | 2000 MB | `getFile.file_path` is an absolute local filesystem path; the official server itself accepts HTTP, so remote access needs TLS termination. |
| MTProto user client | Telegram files (currently up to 2 GB default / 4 GB Premium) | 2 GB default / 4 GB Premium | File transfers are chunked; user authorization binds the auth key to the user's identity. |

Sources:

- The hosted `getFile` maximum is 20 MB and its generated link is valid for at
  least one hour. [Bot API `File` and
  `getFile`](https://core.telegram.org/bots/api#getfile).
- Hosted multipart uploads are 10 MB for photos and 50 MB for other files;
  `sendAudio`, `sendDocument`, `sendVideo`, and `sendVoice` also state a 50 MB
  limit. [Bot API “Sending
  Files”](https://core.telegram.org/bots/api#sending-files).
- The official local Bot API server documents unlimited-size downloads, uploads
  up to 2000 MB, absolute local paths, and the HTTP/TLS constraint. [Official
  server README](https://github.com/tdlib/telegram-bot-api#usage).
- MTProto currently exposes `upload_max_fileparts_default = 4000` and
  `upload_max_fileparts_premium = 8000`; the largest part is 512 KiB. This
  yields 2000 MiB and 4000 MiB respectively. [Telegram client
  configuration](https://core.telegram.org/api/config#upload-max-fileparts-default),
  [file upload rules](https://core.telegram.org/api/files#uploading-files).
- Telegram describes MTProto as supporting files up to 4 GB. [Telegram's
  technical FAQ](https://core.telegram.org/techfaq#q-why-did-you-go-for-a-custom-protocol).

Telegram uses “MB” in the Bot API documentation; the current repository's
thresholds use MiB (`20 * 1024 * 1024`, `50 * 1024 * 1024`). Keep the existing
threshold constants unless an integration test against Telegram proves a
different byte boundary.

## Why a proxy alone cannot solve it

The current web route forwards a client's `Range` header and relays
`Content-Range`, but it first calls the hosted Bot API `getFile`. Therefore it
cannot obtain a `file_path` for a file above 20 MB. See
[`apps/www/src/app/api/telegram/file/[fileId]/route.ts`](../../apps/www/src/app/api/telegram/file/%5BfileId%5D/route.ts).

A cache/proxy is still the right **delivery boundary**, but it needs a source
that can retrieve the large file:

1. local Bot API server (recommended first), or
2. MTProto/TDLib (recommended alternate/second backend), or
3. non-Telegram object storage populated during ingestion.

Merely moving the existing hosted `getFile` request into another local process
does not change the 20 MB restriction.

## Proposed architecture

```text
Expo / web player
    | app auth -> request signed playback URL for mediaId
    v
normal API / local gateway discovery
    | short-lived opaque URL, no Telegram credential
    v
telegram-media-gateway (always-on or optional local machine)
    |-- authorization + mediaId-to-file mapping
    |-- local disk cache + eviction
    |-- HEAD and HTTP Range (206/416) serving
    v
official telegram-bot-api --local
    | getFile(file_id) -> absolute local file_path
    v
Telegram cloud
```

The gateway can be online only when the developer's/local server is online,
matching the proposed UX. For a reliable production player, the same design
should run on an always-on VM/container with persistent disk and HTTPS rather
than on an ephemeral serverless function.

### Player availability contract

Do not enable the play button from a generic `/health` check alone. The
application should classify media as:

- `hosted`: playable through the normal production path (currently up to the
  hosted 20 MB download limit);
- `gateway-required`: larger Telegram media with enough source metadata;
- `external-only`: media not actually present in Telegram or the cache.

For `gateway-required`, ask the gateway for that specific `mediaId`. Enable play
only when it returns `ready` or `fetchable`. Use a loading state while the first
full local-Bot-API download is materialized. If the service is offline, retain
the Telegram-message/original-source fallback and show “Local media service is
offline” rather than presenting a broken player.

The repository already has LAN-IP selection, preview ngrok discovery, and a
three-minute gateway lease. The accepted ADR currently says normal media stays
on production and local endpoints remain minimal, so routing large media over
that tunnel is a conscious expansion that needs authenticated stream URLs and
bandwidth testing. See
[`brain/decisions/2026-07-30-production-backed-local-gateway-discovery.md`](../../brain/decisions/2026-07-30-production-backed-local-gateway-discovery.md).

### Range-serving requirements

For native and browser seeking, the gateway should serve a cached local file
without buffering it into process memory:

- support `HEAD`;
- advertise `Accept-Ranges: bytes`;
- parse a single `Range: bytes=start-end` request;
- return `206`, `Content-Range`, the selected `Content-Length`, and the media
  `Content-Type`;
- return `416` for an unsatisfiable range;
- stream only the selected filesystem segment;
- use `ETag` or `Last-Modified` so repeated player requests are cacheable.

These are standard HTTP range semantics. [RFC 9110, Range
Requests](https://www.rfc-editor.org/rfc/rfc9110.html#name-range-requests).

The local Bot API server's documented local-mode contract is an **absolute file
path**, not a public, credential-free media URL. The range endpoint is therefore
project code layered above the official server, not something mobile/web should
call directly.

### Cache identity and lifecycle

Expose only the application's stable `mediaId`. Internally, cache by
`file_unique_id` when present plus the relevant Telegram account/bot namespace,
and retain `file_id`/message references for re-resolution. Telegram states that
`file_unique_id` is stable across time and bots but cannot be used to download,
while a `file_id` is bot-specific and a file can have multiple valid IDs.
[Bot API `File`](https://core.telegram.org/bots/api#file), [Bot API sending-file
notes](https://core.telegram.org/bots/api#sending-files).

Use a configurable disk quota, LRU eviction, atomic temporary-file rename, one
in-flight download per cache key, and validation against the database's expected
size/MIME type. Do not treat a cached absolute `file_path` as permanent; call
`getFile` again when it is absent.

## Option comparison

### 1. Official local Bot API server + project range gateway — recommended now

**Fit:** highest. The database and import pipeline already store Bot API
`file_id` values. Existing 20–50 MiB imports are already in Telegram and become
playable without rewriting media identity. Future Facebook media can be
uploaded up to the local server's 2000 MB bot limit.

**Costs:** run the official C++ server plus the small gateway on an always-on
machine for production; allocate disk and bandwidth; wait for a cache miss to
download. The bot must be moved correctly: Telegram requires calling `logOut`
on the cloud Bot API before launching it locally, otherwise update delivery is
not guaranteed. All Bot API calls for that bot—not just `getFile`—should then
use the configured local base URL. [Official migration
instructions](https://github.com/tdlib/telegram-bot-api#moving-a-bot-to-a-local-server),
[Bot API `logOut`](https://core.telegram.org/bots/api#logout).

This repo's Bot API resolver currently deletes/restores the hosted webhook and
uses hosted `getUpdates`; those calls must share one configurable Bot API base
URL during a migration.

### 2. Server-side MTProto/TDLib gateway — good long-term alternative

**Fit:** technically strong. The repository already has a server-side GramJS
client and Telegram string session in
[`packages/telegram/src/telegram-client.ts`](../../packages/telegram/src/telegram-client.ts),
and stores source channel/message IDs. MTProto can fetch a document in chunks;
Telegram's `upload.getFile` exposes byte offsets/limits, while TDLib's
`downloadFile` exposes `offset` and `limit`. [MTProto file
downloads](https://core.telegram.org/api/files#downloading-files), [TDLib
`downloadFile`](https://core.telegram.org/tdlib/docs/classtd_1_1td__api_1_1download_file.html).

**Costs:** materially more media-state logic. Raw MTProto must handle DC
migration, CDN redirects, expired `file_reference` values, flood waits, and
chunk constraints. Telegram recommends separate sessions/connections for large
file transfers. TDLib handles more of that, but adds a native runtime and local
database. [Telegram file-transfer general
considerations](https://core.telegram.org/api/files#general-considerations).

The user-session credential is also more privileged than a bot token. Telegram
states that authorization binds the `auth_key_id` to the user and subsequent
calls execute as that user. Store it as a production secret, encrypt/persist it
with strict permissions, and never return it to a client. [Telegram user
authorization](https://core.telegram.org/api/auth#we-are-authorized). TDLib
supports a caller-provided database encryption key. [TDLib initialization
parameters](https://core.telegram.org/tdlib/docs/classtd_1_1td__api_1_1set_tdlib_parameters.html).

Choose this first only if avoiding Bot API migration is more important than
preserving the simple `file_id -> local path` flow, or if 4 GB Premium uploads
are an actual requirement.

### 3. Direct Telegram connection from Expo/web — not recommended

A direct Bot API call exposes the token in the application binary, network URL,
and logs. This repository currently has a bot token hard-coded in
[`apps/expo-app/src/lib/get-telegram-file.ts`](../../apps/expo-app/src/lib/get-telegram-file.ts);
it should be revoked/rotated and removed from the client as an immediate
security fix.

A direct TDLib client is legitimate only if each end user is intentionally
signing into **their own** Telegram account. It entails phone/QR authorization,
2FA, an encrypted local TDLib database, native mobile integration, and a
separate web implementation. It should not distribute the project's shared
archive account/session.

## Delivery plan

1. **Security first:** revoke/rotate the exposed bot token; make every client
   use an application media endpoint, never a Telegram token URL.
2. **Introduce the gateway contract:** stable `mediaId`, authenticated metadata
   request, short-lived signed playback URL, per-media availability, `HEAD`, and
   byte-range tests using a large fixture.
3. **Run the official Bot API server in `--local`:** configure `api_id`,
   `api_hash`, bot API base URL, persistent working/cache directories, and TLS
   at the reverse proxy. Migrate the bot with `logOut` in a maintenance window.
4. **Wire ingestion:** raise the local Facebook bridge policy to the configured
   2000 MB ceiling only when the local backend is healthy; keep source fallback
   metadata on failure.
5. **Wire the UX:** hosted small media always plays; large media plays when the
   specific gateway item is ready/fetchable; offline retains an external
   Telegram/Facebook action.
6. **Validate deployment:** concurrent seeks, cold-cache latency, cache
   eviction, interrupted downloads, ngrok/tunnel throughput, mobile background
   playback, and authorization expiry.
7. **Re-evaluate MTProto/TDLib later:** add it behind the same gateway interface
   if source-message downloads, 4 GB Premium uploads, or multi-account access
   justify the extra privilege and complexity.

## Existing-content caveat

- Telegram media above 20 MB that still has a valid bot `file_id` can be
  recovered by the local Bot API backend.
- Facebook media from 20–50 MiB that this repository already uploaded to
  Telegram can likewise become playable.
- Facebook items above 50 MiB were intentionally not downloaded/uploaded by the
  current bridge. No Telegram transport can recover bytes that were never put
  there; those items require re-import from Facebook or another durable source.
