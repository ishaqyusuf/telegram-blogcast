---
name: facebook-saved-sync
description: Incrementally capture newly saved Facebook posts through the Codex in-app browser and import them into Al-Ghurobaa's canonical Facebook JSON export and Blog database rows. Use for prompts such as "sync my Facebook saved posts", "fetch my latest Facebook saves", "update the Facebook saved export", or "import newly saved Facebook posts".
---

# Facebook Saved Sync

Sync only posts saved since the previous successful run. Keep saved-post
discovery separate from the existing Facebook media-download pipeline.

## Workflow

1. Resolve the Al-Ghurobaa repository root and verify these files exist:
   - `exports/facebook-saved.json`
   - `scripts/facebook-saved/browser-export.mjs`
   - `scripts/facebook-saved/sync.ts`
2. Read and follow `browser:control-in-app-browser`. Use the Codex in-app
   browser; do not substitute Chrome, inspect session storage, or read cookies.
3. Reuse an open Facebook Saved tab when available. Otherwise open
   `https://www.facebook.com/saved/?cref=28`.
4. Verify the tab is on Facebook Saved. If Facebook requires authentication,
   keep the tab as a handoff, ask the user to sign in there, and stop without
   writing files or database rows.
5. In the persistent browser-control JavaScript session:
   - Read the canonical export.
   - Import `packages/blog/src/facebook-saved.mjs`.
   - Convert every existing item URL to a known identity.
   - Import `scripts/facebook-saved/browser-export.mjs`.
   - Create a collector with a 20-known-item boundary, eight no-growth passes,
     and a 250-pass safety cap.
6. Run `collectBatch` repeatedly against the same tab and collector. Report
   concise progress during long runs. Stop only when it returns `done: true`.
7. If `complete` is false, report the stop reason and do not run the sync
   command.
8. Create a unique temporary directory, then call
   `writeFacebookSavedExport` with the completed collector, final snapshot, and
   a capture path inside that directory.
9. From the repository root run:

   ```text
   bun run facebook-saved:sync -- --capture <temporary-capture-path> --file exports/facebook-saved.json
   ```

10. Parse the final JSON result and report scanned, new, imported, existing,
    invalid, and stop-reason counts.
11. Finalize browser tabs. Keep a Facebook tab only when the user must finish
    signing in.

## Guardrails

- Never start `facebookImport.startMediaImport` or the Facebook media bridge.
- Never commit an incomplete, safety-capped, or no-known-overlap capture.
- Preserve existing JSON item order, fields, and `blogId` values.
- Rely on the service and database uniqueness guard for idempotence; do not
  manually delete or rewrite existing Blog rows.
- Use `/facebook-saved-sync` in the Expo app when the user explicitly asks to
  perform the capture on mobile instead of through the Codex in-app browser.
