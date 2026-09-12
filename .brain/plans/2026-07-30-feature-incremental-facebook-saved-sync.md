# Incremental Facebook Saved-Post Sync

## Status

Implemented

## Goal

Sync newly saved Facebook posts without repeatedly crawling the full saved
history. Support both a Codex prompt using the desktop in-app browser and a
direct Expo mobile WebView action.

## Architecture

Both capture surfaces use the shared identity, card-merging, and incremental
boundary rules from `@acme/blog/facebook-saved`.

```text
Codex prompt → in-app browser ┐
                              ├→ completed capture → local API sync service
Expo mobile → Facebook WebView┘                       ↓
                                         canonical JSON + Blog rows
```

The sync service is local-only, imports only missing posts, preserves existing
JSON entries and `blogId` values, and writes the merged export atomically after
database import. Facebook media resolution and Telegram upload remain a
separate workflow.

## Behavior

- Stable Facebook identities match watch/reel and common post URL variants.
- Duplicate DOM cards merge into one richer saved-post item.
- Incremental capture stops after 20 consecutive known posts, eight no-growth
  passes at a valid end, or a 250-pass safety cap.
- Incomplete, authentication-blocked, or no-known-overlap captures fail closed.
- `exports/facebook-saved.json` is the stable canonical export.
- `facebookImport.getSavedSyncState` returns known identities to local capture
  clients.
- `facebookImport.syncSavedPosts` validates, imports, and atomically persists a
  completed capture.
- The repository skill `.agents/skills/facebook-saved-sync` owns prompt-driven
  desktop orchestration.
- Expo `/facebook-saved-sync` owns direct mobile capture and is reachable from
  the existing Facebook Import screen.

## Verification

- Shared identity/collector tests.
- Service merge/import/idempotence tests.
- Blog package typecheck and focused API/mobile lint.
- Skill validation.
- Canonical export count and `blogId` preservation check.
- Live desktop dry-run and mobile interaction checks when authenticated
  surfaces are available.
