# Legacy Tasks Snapshot

## Purpose
Preserved copy of the original single-file `brain/tasks.md` tracker that existed before the full Brain task directory was initialized.

## How To Use
- Use this as historical reference only.
- Put new active task tracking in the other files under `brain/tasks/`.
- Keep the original content intact unless you intentionally migrate items elsewhere.

## Template

### Original Content
# Tasks

## In Progress

- [ ] Phase 6: Validation and rollout checks

## Done

- [x] Replaced Expo app-level `Pressable` and `PressableLink` usage with the shared `components/ui/pressable` wrapper
- [x] Fixed `packages/db` book Prisma models to use `@id` primary keys so Prisma can validate book-author many-to-many relations
- [x] Expo app query hooks now use an app-local `src/lib/react-query` bridge instead of `@acme/ui`
- [x] Rich-text authoring for blog form with markup toolbar, preview, and shared renderer
- [x] Phase 1: Data/API contracts for search history, reactions, channel timeline actions, album workflows
- [x] Phase 2: Audio continuity and player controls (pause/play + seek back 3s)
- [x] Phase 3: Search screen with recent queries
- [x] Phase 4: Channel timeline UI and gestures
- [x] Phase 5: Dashboard home premium redesign
