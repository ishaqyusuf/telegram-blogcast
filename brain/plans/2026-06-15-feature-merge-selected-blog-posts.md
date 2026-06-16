# Plan: Merge Selected Blog Posts

## Type
Feature

## Status
Implemented

## Created Date
2026-06-15

## Last Updated
2026-06-15

## Completion Notes
- Added `blog.mergeBlogs` to move media, tags, and comment links into a canonical blog in one transaction.
- The merge rejects same-blog, missing/deleted, and cross-channel selections.
- Channel chat exposes a merge action when exactly two posts are selected and clears selection after success.
- Secondary blogs are soft-deleted and merge metadata is written to both source records.

## Intake
- Intake File: brain/intake/2026-06-15-blog-audio-organization-import.md
- Intake Item: Select two blogs and merge media plus text.

## Goal Or Problem
Allow a user to select exactly two blog posts from a channel chat and merge a media post with a text/caption post into one canonical blog record without losing media, tags, comments, or source metadata.

## Current Context
Channel chat already has multi-select state and a context menu entry labelled "Merge Selected" in `apps/expo-app/src/screens/channel-chat-screen.tsx`. The API has `blog.getBlog`, `blog.updateBlog`, `blog.deleteBlog`, comments, tags, and media relations in `apps/api/src/trpc/routers/blog.routes.ts`, but no merge mutation. `Blog` owns `Media[]`, `BlogTags`, and comment links through `BlogComments`.

## Proposed Approach
Add a transactional `blog.mergeBlogs` tRPC mutation. The mutation should validate both blogs, choose a canonical blog, move media/tags/comments from the secondary blog to the canonical blog, merge text content deterministically, mark the secondary blog as deleted, and record merge metadata. Add a small mobile confirmation UI that appears only when exactly two posts are selected.

## Implementation Steps
- Add a zod input schema for `blog.mergeBlogs` with `primaryBlogId`, `secondaryBlogId`, and optional `contentStrategy`.
- In the mutation, load both blogs with media, tags, comments, channel, and metadata.
- Reject missing/deleted blogs and cross-channel merges unless a future explicit override is added.
- Choose canonical content using `contentStrategy`, defaulting to media blog as primary when one post has media and the other has text.
- Move secondary `Media` rows to the primary blog where not already attached.
- Copy missing tags from secondary to primary and preserve existing tag links.
- Repoint or copy comments from secondary to primary, preserving order when possible.
- Soft-delete secondary blog and store merge metadata on both records.
- Add mobile selection bar action "Merge" when exactly two posts are selected.
- Add a confirmation modal showing the two selected posts, the canonical result, and a merge button.
- Invalidate `blog.posts`, `blog.getBlog`, and channel post queries after merge.

## Affected Files Or Areas
- `apps/api/src/trpc/routers/blog.routes.ts`
- `packages/db/src/schema/blogs.schema.prisma`
- `packages/db/src/schema/media.schema.prisma`
- `apps/expo-app/src/screens/channel-chat-screen.tsx`
- `apps/expo-app/src/components/blog-card`
- `brain/features/blog.md`
- TODO: Add focused API tests if the repo has a preferred tRPC test harness.

## Acceptance Criteria
- Selecting exactly two channel posts exposes a merge action.
- Merging one text post and one media/audio post produces one visible post with both text/caption and media.
- The secondary blog no longer appears in channel listing after merge.
- Tags and comments from both source blogs remain accessible on the merged blog.
- Cross-channel merges are rejected with a clear error.

## Test Plan
- Run `bun --filter @acme/api typecheck`.
- Run `bun --filter @acme/expo-app typecheck` if available, otherwise the repo-level typecheck command.
- Manually test in Expo: select two posts in `/channels/[channelId]`, confirm merge, verify listing and detail.
- Manually test rejection with posts from different channels if a fixture exists.

## Brain Update Requirements
- Update `brain/features/blog.md` with merge behavior and source metadata rules.
- Update `brain/api/contracts.md` with the `blog.mergeBlogs` contract.
- Update `brain/progress.md` if present; otherwise no progress doc update is required.

## Lower-Agent Readiness
- Implementation scope is clear: Yes
- File boundaries are clear: Yes
- Acceptance criteria are observable: Yes
- Required checks are listed: Yes
- Brain update requirements are listed: Yes
- Ready for handoff: Yes

## Completion Report Requirements
Lower agent must report:
- Changed files
- Checks run
- Brain docs updated
- Unresolved issues
- Any skipped acceptance criteria

## Risks / Edge Cases
- Duplicate media or tags may appear if merge is not idempotent.
- Comments can lose intended ordering if both posts have existing comment order values.
- Merge metadata shape should be simple JSON and not require a schema migration unless product later needs audit querying.

## Open Questions
- TODO: Confirm whether first selected post should always be primary, or whether media post should be primary by default.

## Linked Task
- Task Title: Merge Selected Blog Posts
- Task File: brain/tasks/roadmap.md
