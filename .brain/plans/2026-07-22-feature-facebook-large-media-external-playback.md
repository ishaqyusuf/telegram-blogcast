# Oversized Facebook Media External Playback

## Outcome

Facebook video and audio imports respect the hosted Telegram Bot API limits without repeatedly retrying inaccessible media. Every resolved post remains a single durable blog item with a thumbnail and a usable playback destination.

## Delivery rules

- `<= 20 MiB`: download, upload to Telegram, and play in app through the existing Telegram proxy.
- `> 20 MiB` and `<= 50 MiB`: upload the full file to Telegram, keep a thumbnail in app, and open the Telegram message on tap.
- `> 50 MiB`: skip the full media download/upload, keep a thumbnail when available, and open the original Facebook post on tap.

## Implementation

1. Probe Facebook media metadata before download and hard-cap any fallback download at 50 MiB.
2. Return a normalized bridge result with `accessMode`, destination, reason, external URL, media metadata, Telegram message metadata, and thumbnail metadata.
3. Persist external results as terminal `Blog.meta.facebook.mediaDownload.status = "external"`; exclude them from bulk retry while allowing forced per-item Recheck.
4. Normalize legacy and current rows through shared helpers in API feed/search output and Expo detail/card surfaces.
5. Provide a dry-run-first DB command for marking already-imported Facebook media above 20 MiB as external.

Run `bun --cwd packages/db mark-facebook-external-media` to preview the backfill, then add `--execute` only after reviewing the listed blog IDs.

## Verification

- Boundary tests cover exactly 20 MiB, above 20 MiB, and above 50 MiB.
- API visibility tests ensure terminal external Facebook posts remain visible without full media.
- Focused mobile lint covers import, feed, search, cards, and detail screens.
- No Prisma migration is required; existing `Blog.meta`, `Media`, `File`, and `Thumbnail` storage is reused.
