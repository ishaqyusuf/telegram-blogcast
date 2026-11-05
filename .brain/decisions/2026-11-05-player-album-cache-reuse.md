# Reuse Album Detail Data For Player Browsing

- Date: 2026-11-05
- Status: Accepted

## Context

The audio player’s album header navigated to a separate page. That page waited for a track query, and revealing later tracks required sequential pagination even though `album.getAlbum` already returned the complete ordered media list.

## Decision

Mount the existing album query on every album-backed audio player, using the established five-minute stale and thirty-minute inactive retention policy. Render the same result in a virtualized floating sheet and reuse its ordered media list for the unfiltered full-screen album. Keep server pagination for search. Do not create a second persisted cache or change API contracts, transcript storage, or existing cache bounds.

Apply successful rename responses directly to the existing audio query caches before background reconciliation. Cancel older in-flight requests first so they cannot restore the old title. Share this path between album, player and feed actions, and use a semantic custom-title foreground separate from active playback color.

## Consequences

Warm sheet and full-screen navigation share data, including tracks after the first page. A first-ever request still requires connectivity; the sheet keeps the viewed track available with loading/retry feedback. Existing complete album responses may contain transcripts, so the established persisted-cache compaction still applies. Streaming and download state remain separate; neither a cache download nor its failure should replace Pause.
