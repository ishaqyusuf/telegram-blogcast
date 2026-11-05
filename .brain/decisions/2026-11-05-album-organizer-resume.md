# Album Organizer Scan And Review Progress

- Date: 2026-11-05
- Status: Accepted
- Workshop revision: `5c2f930a-7f3b-47b6-9548-e97bb7481ca3`

## Decision

Keep discovery coverage and album review progress in separate, versioned sections of `AlbumAutoIndexRun.inputJson`. Reuse the existing run and normalized suggestion tables. New scans use an ordered Media ID cursor and a fixed upper bound within each run, while excluding previously inspected identities across saved runs. Coverage includes unmatched tracks and successful legacy snapshots. This also discovers older IDs that become eligible after a later import commit. Source dates remain display and within-album sorting metadata.

Process up to 50 eligible tracks per request. A short channel advisory lock claims an expiring lease before the AI request, which runs outside the database transaction with a 90-second timeout. Save normalized suggestions, unmatched IDs, raw/parsed provider output and the cursor atomically after every successful batch. A failed batch retains its previous cursor. Existing saved legacy runs retain their review behavior, and their recorded chunk media IDs are excluded when creating new scan coverage. No-new-audio discovery reuses the saved run.

Store the current review suggestion and per-suggestion drafts independently of scan coverage. Drafts contain explicit selected IDs and an existing-album destination or a proposed name. Exits flush queued draft writes and remain on the screen when saving fails. Initialize the native review only after a fresh run fetch and update cached review state after every successful save, preventing cached defaults from overwriting a persisted draft.

Apply album creation, live track validation, membership/index changes and approval status in one transaction. The channel lock serializes approvals and draft writes. Membership uses album and ordered media row locks and rejects a track moved into another album after discovery. Approval retries reuse the applied destination. Unchecked tracks become dismissed suggestions and can be restored.

Two groups may be approved into the same destination. Because the legacy schema has a unique `(runId, albumId)` pair, the second group keeps a null relational destination and records its applied destination in `review.targets`. The run read contract hydrates that recorded destination. No DDL or data migration is needed.

## Consequences

The mobile screen drives successive requests and may pause between batches. Closing the app preserves completed batches. Reopening and continuing starts from the saved checkpoint. Raw and parsed AI responses remain inspectable on their run. A future durable worker can use the same start/continue contract.

Native rendering follows the selected interaction and the app's current semantic theme tokens. Tracks use a virtualized, keyboard-aware list. The per-album Save action stays visible while reviewing, with space reserved for the existing audio player.
