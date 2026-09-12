# Channel Content Filter Configuration

## Outcome

Settings exposes a channel configuration screen for channels with saved blogs. Each channel can enable an allow-list of text, image, video, audio, and PDF content that is enforced by the shared Home/channel feed query and Search query.

## Implementation

- Store global `contentFilterEnabled` and ordered `contentFilterTypes` values on `Channel`.
- Expose typed channel list/update procedures; enabling requires at least one unique supported type, while disabling retains selections.
- Apply one shared Prisma visibility predicate before pagination and counts in `blog.posts` and `blog.search`.
- Normalize future Telegram PDF/video imports and retain MIME-based query/read compatibility for legacy rows.
- Add the Expo Settings CTA, channel list, switch interaction, simple checkmark summary, RTL copy, and shared floating type-selection sheet.

## Validation

- Focused policy and existing post-visibility tests.
- Prisma generation and schema push.
- API/Expo focused lint plus repository tests.
- Android light/dark and RTL interaction QA.

## Rollout Note

The dry-run legacy normalizer found 318 PDF and 56 video rows. The external-data write was not approved, so those rows remain unchanged; runtime MIME fallback keeps them filterable and renders their effective type.
