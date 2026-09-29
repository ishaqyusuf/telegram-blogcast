# Plan: Blog Rich Text Editor

- Status: Proposed; investigation and plan complete, implementation not started.
- Created / updated: 2026-09-29
- Task: [Blog rich text editor](../tasks/2026-09-29-blog-rich-text-editor.md)
- Scope: Expo New Blog and Edit Blog, shared document support, persistence, and reading compatibility.

## Recommendation

Reuse the TenTap editor already used by Books. Extract a shared mobile editor and toolbar, retain a Book-specific wrapper, and add a Blog-specific wrapper. Keep the existing `@acme/document` package as the application document boundary. Complete its supported formatting and persistence contract before enabling rich blog publishing.

This is more than a textarea replacement: formatting must survive editing, save, reload, reading, and post merging. Keep `Blog.content` as a server-derived plain-text projection for search, previews, tags, copying, sharing, and older readers. Store the validated rich document in a namespaced part of the existing `Blog.meta` JSON field. No Prisma change or data backfill is expected for this approach.

## Verified current implementation

| Area | Current behavior / evidence |
| --- | --- |
| Entry point | `components/blog-home/blog-home-fab.tsx` opens `/blog-form`; `app/blog-form.tsx` mounts `screens/blog-compose-screen.tsx`. |
| New/Edit Blog | `StyledContentInput` uses a multiline React Native `TextInput`. Blur switches to a colored text preview. `parseBlogContent` parses Telegram-style hashtags, links, and timestamps; it is not a formatting editor. |
| Blog saving | Compose submits `content`, tags, status, and media uploads to `blog.createBlog` / `blog.updateBlog`. There is no rich-document input. Creation permits media-only content; update currently requires a nonempty string. Creation limits body text to 20,000 characters; update does not apply the same bound. |
| Books | `components/book/book-rich-editor.tsx` uses TenTap and a native footer. Exposed commands include bold, italic, underline, highlight, quote, bullets, undo, and redo. Headings and numbered lists are not exposed in this wrapper. |
| Existing dependency | Expo manifest declares TenTap `^0.7.4`; `bun.lock` resolves `0.7.4`. React Native WebView and keyboard-controller are already installed. |
| Existing document model | `packages/document` provides `RichDocument`, rich marks, HTML conversion, plain-text conversion, and render blocks. This is a custom format, not Tiptap JSON; the two must not be cast interchangeably. |
| Read surface | `text-blog-screen.tsx` supplies only `blog.content` to `RichContent`, although `RichContent` can accept a document. Its current rendering applies inline marks but no heading/list/quote layout. |
| Web reuse | `packages/ui/src/components/editor` already wraps Tiptap for web. It cannot be mounted directly as a native component. A future web composer can use the same document adapters. |

### Gaps to fix or account for

- The current HTML converter does not recognize heading tags or ordered lists. It drops empty blocks, and its nested paragraph handling can flatten list/quote structure. Some attribute-bearing closing marks can leak into later text. It is not a general-purpose HTML sanitizer.
- `RenderBlock` drops block attributes; the native renderer therefore cannot receive heading levels or list metadata through that path.
- Book editor CSS hardcodes dark text, RTL, and an 18px font on all elements. It needs theme tokens and explicit heading styles before Blog reuse.
- The Book wrapper emits changes after a 220ms debounce and exposes only `exec()`. Publishing from the last React state value can miss recent typing. It also swallows bridge read errors.
- Blog merge concatenates plain text and preserves primary metadata. After adding rich metadata, this would leave the displayed document stale unless merge is updated.
- Create/update are currently `publicProcedure`. This feature must validate all document input server-side; it must not claim existing ownership authorization. Broader authentication policy is a separate product/security decision.

These are code findings; no device interaction or runtime compatibility testing was performed during planning.

## Open-source comparison

Sources checked 2026-09-29. Suitability judgments below are specific to this repository.

| Option | Fit | Decision |
| --- | --- | --- |
| [TenTap](https://github.com/10play/10tap-editor) | MIT React Native editor built on Tiptap/ProseMirror, with a native toolbar and configurable styling. Already integrated into Books. | Recommended mobile engine. |
| [Tiptap](https://github.com/ueberdosis/tiptap) | Extensible web editor already present in `packages/ui`. | Reuse for future web authoring; share the content contract rather than native UI. |
| [React Native Pell Rich Editor](https://github.com/wxik/react-native-rich-editor) | MIT HTML-oriented mobile editor with common toolbar actions and WebView integration. | Viable alternative, but adds another editor and an HTML conversion path without a demonstrated project benefit. |
| [Lexical](https://github.com/facebook/lexical) | MIT editor framework with React bindings, JSON serialization, and rich-content plugins. | More integration work here: a different document engine and mobile embedding/bridge strategy. No present need to replace TenTap. |

[TenTap's bridge API](https://10play.github.io/10tap-editor/docs/api/EditorBridge) exposes JSON, HTML, text, heading, list, and formatting operations. [Tiptap recommends JSON persistence](https://tiptap.dev/docs/editor/core-concepts/persistence). Adopt that principle through our existing application document model, with explicit adapters.

[Upstream releases](https://github.com/10play/10tap-editor/releases) currently list 1.0.1, including Tiptap v3 history and keyboard fixes. The project is on 0.7.4/Tiptap v2. Do not silently combine a major editor upgrade with extraction: first prove the locked version supports the required subset on Expo 54 / RN 0.81.5, then make any necessary upgrade a separately verified step. Check installed APIs, not only latest documentation.

## First-release experience

Keep `/blog-form` as a full-screen writing surface. Preserve tags, attachments, Save Draft, and Publish.

| Control | Behavior |
| --- | --- |
| Paragraph / H1 / H2 / H3 | A compact block-style menu changes the current block. Returning to Paragraph removes the heading. |
| Bold / Italic / Underline | Toggle the selected text or subsequent typing; active state follows the selection. |
| Bullets / Numbers | Single-level lists in the first release. Correct Enter, empty-item exit, and undo behavior. |
| Quote | Visually distinct block with direction-aware border and padding. |
| Link | Add, edit, or remove a safe web link through the shared compact bottom sheet. |
| Undo / Redo | Disabled when unavailable. |
| Spacing | Enter creates a paragraph with consistent spacing. Preserve intentional empty paragraphs and soft line breaks. Use a fixed readable line height; arbitrary line-height/margin controls are deferred. |

Use a keyboard-aware toolbar above the software keyboard. Put less frequent block/link actions in a compact secondary menu. Keep 44-point targets, translated accessibility labels, haptics through shared pressables, and visible selected/disabled states. Avoid copying the existing Book footer's styling exceptions.

Arabic RTL is the default writing direction; offer an explicit LTR/RTL block direction option for English and mixed-language posts. Apply the same direction and spacing in editor and reader. Support light/dark theme updates without remounting the editor or resetting the cursor/history.

First release excludes nested lists, tables, inline image uploads, collaboration, AI writing, arbitrary fonts/colors, and page-layout controls. Existing media remains in the attachment workflow. Highlight stays available in Books; enabling it for Blog is optional after the basic contract is verified.

## Content and API contract

Proposed storage:

```ts
Blog.content = getDocumentPlainText(validatedDocument);
Blog.meta.richText = {
  schemaVersion: 1,
  document: validatedDocument, // application RichDocument, not raw Tiptap JSON
};
```

Keep one authoritative rich document. Do not maintain independently editable HTML, JSON, and plain text. HTML needed by Books or web rendering is derived, not a second Blog source of truth.

Extend the existing model with strictly validated block attributes: heading level, list kind/group/order, and direction. Preserve blank paragraphs and hard breaks. Retain existing Book v1 document compatibility; if an incompatible shape is required during implementation, introduce an explicit new version and a read adapter instead of relabeling existing data.

Add shared `fromTiptapJSON` / `toTiptapJSON` adapters for the supported subset. Disable unsupported editor extensions. Nested pasted structures need an explicit deterministic normalization rule, such as flattening to supported list items while retaining all text; never silently discard text. Keep unsupported stored document versions readable via `content`, but disable editing rather than overwrite them.

Create/update accept an optional validated document alongside the existing legacy string contract. When a document is present, the server derives text and auto-tags and persists both in one transaction. Preserve unrelated metadata including title, media source, import provenance, and merge history. Define legacy `title` handling once: include it in canonical content during creation when supplied, without duplicating it on later edits.

Validation must include:

- A common visible-text limit of 20,000 characters for create/update, with an additional proposed 256 KiB serialized-document bound and bounded blocks/runs. Confirm those structural bounds against representative long posts before release.
- Allowed nodes/marks/attributes only; heading levels 1–3; flat lists only; validated direction values.
- Normalized safe link protocols: HTTP/HTTPS initially. Reject script/data URLs. Validate before storage and before opening links. Keep existing auto-detected links/hashtags/timestamps working.
- Semantic empty-content checks, permitting media-only creation and editing when existing or newly attached media is present.
- Document/text consistency is server-owned; do not trust client-supplied plain text as the authoritative projection.

For a legacy client updating a rich post without a document: allow an unchanged plain-text body to preserve rich metadata; reject a changed body with a clear update-required error. Do not silently strip formatting or retain a mismatched document. Existing plain posts remain fully editable.

Audit every body writer and consumer: manual create/update, merge, import/update paths, any comment path that can address the same Blog rows, detail response mapping, cached query serialization, search, sharing, and feed previews. Merging a rich and plain post converts the plain part into paragraphs, combines canonical blocks in the requested order, generates unique block IDs/list groups, and derives new text. Deduplicate only equivalent documents rather than differently formatted bodies with equal plain text.

## Implementation sequence

### 1. Validate the existing engine and define document fixtures

- Add an inert development fixture for the installed TenTap version: Arabic/English, headings, lists, soft breaks, blank paragraphs, bold, italic, underline, and links.
- Prove JSON round trips and selection retention while tapping a native toolbar or opening a sheet. Verify Android keyboard behavior first, then iOS.
- Confirm the flat-list and direction bridges/extensions supported by the locked version. Resolve any required extension or upgrade before building the persistence path.
- Record the chosen schema/adapter contract in an ADR once implementation begins.

Exit: an exact list of supported document structures and fixture evidence; no production publishing required.

### 2. Complete the shared document layer

- Work in `packages/document/src/types.ts`, `document.ts`, `render.ts`, and `blog/`; add isolated Tiptap adapters and validation.
- Carry block attributes through render models. Preserve meaningful whitespace without using the current trimming plain-text constructor for rich documents.
- Repair HTML helpers where they remain used by Books, using the existing `htmlparser2` dependency where suitable rather than expanding the regex tokenizer. Keep imported Book parsing behavior covered separately.
- Test semantic round trips, not byte-identical HTML; stable block IDs must survive normal edits where Book annotations depend on them.

Exit: every advertised formatting option survives document → editor → document and document → read model.

### 3. Add persistence and backward compatibility

- Add a dedicated blog-content service/helper used by `apps/api/src/trpc/routers/blog.routes.ts` for validation, derivation, metadata updates, and merge behavior.
- Extend create/update/detail contracts; preserve legacy plain posts and media-only behavior.
- Add rich/legacy merge handling and old-client protection before any rich document can be written.
- Ensure API errors preserve the editor and give actionable inline feedback. Keep existing permission behavior explicit in Brain.

Exit: API integration fixtures prove create → get → update → get and merge preserve formatting and unrelated metadata.

### 4. Extract the shared mobile editor and connect Blog

- Proposed folder: `apps/expo-app/src/components/rich-text/` for the editor host and toolbar. Keep feature submission and media logic outside it.
- Expose readiness, selected marks/block type, history availability, `exec`, and an async `getSnapshot`/flush operation.
- Read one current editor JSON snapshot for Save Draft/Publish; derive all other values from that snapshot. Wait for pending composition/bridge work, prevent double submit, and show a retryable error if extraction fails.
- Guard callbacks with a generation/sequence token advanced when changes occur; ignore stale bridge reads after newer edits, document switches, or unmount. A delayed request must not overwrite newer content.
- Mount existing-post editing only after query/draft initialization. Background refetches must not reset dirty text or cursor position.
- Replace `StyledContentInput` in `blog-compose-screen.tsx`. Use theme/locale configuration and a Book wrapper to preserve Book behavior while sharing the engine.
- Give the editor one intentional scrolling/keyboard owner; avoid nested unconstrained WebView/ScrollView scrolling. Keep tags, attachments, toolbar, and actions reachable with the keyboard open.
- Use shared floating sheets for compact link/direction controls and unsaved-exit confirmation. Keep content on failed saves; do not treat a failed write as saved.

Exit: writing, selecting, formatting, editing, immediate saving, and attachment workflows work on device.

### 5. Connect reading, previews, and caches

- Resolve supported rich metadata in `text-blog-screen.tsx`; fall back to legacy plain text when absent or unsupported.
- Extend `components/rich-content/rich-content.tsx` with headings, lists, quote borders, direction, and paragraph spacing while preserving native text selection and link/tag behavior.
- Feed/search snippets and share/copy continue using derived plain text. Full-body surfaces should resolve the rich document consistently; audit audio captions and channel detail usage.
- Invalidate/update detail, feed, search, and channel caches on create/update. Ensure persisted detail queries retain the rich document under the existing bounded cache policy.
- Preserve old cached entries through plain-text fallback. Test offline reopening after a successful online save.

Exit: Publish → read → reopen editor retains all supported formatting, including after an app restart.

### 6. Verify, document, and release

- Ship server compatibility before the new composer. Gate rich writing until server capability is present; retain rich reading during rollback. A rolled-back plain editor must not overwrite rich content.
- Run focused document/API tests, package typechecks, and Expo lint/typecheck as appropriate. Separate pre-existing failures from regressions; do not claim full checks passed when blocked.
- Perform real native QA in light/dark, Arabic/English, keyboard-open, large-text, and long-post states. Confirm Book editing and imported read-only Books remain unchanged in behavior.
- Update the feature, API contract/endpoints, database metadata convention, ADR, and task ledger. Update Books documentation if the shared editor affects its behavior.

## Acceptance checklist

- [ ] New Blog visibly offers the promised formatting; no markup knowledge is required.
- [ ] Bold, italic, underline, H1–H3, lists, quotes, links, spacing, and direction survive publish, fetch, edit, and republish.
- [ ] Typing immediately before Publish/Save Draft cannot lose the last characters.
- [ ] Existing plain Telegram/Facebook/manual posts render as before and acquire rich storage only on explicit rich editing.
- [ ] Media-only edits work; tags, attachments, upload retry, and draft/published status are preserved.
- [ ] Empty formatted documents are treated as empty; oversized or unsafe content is rejected predictably.
- [ ] Rich/plain and rich/rich merges retain formatting, metadata, and correct plain-text search content.
- [ ] Older clients cannot silently flatten rich posts; unsupported versions remain readable.
- [ ] Dark mode, RTL/LTR, selection, keyboard avoidance, link sheets, undo/redo, and native accessibility are verified.
- [ ] Failed saves retain the document; back navigation offers a clear unsaved-work choice.
- [ ] Offline reading after save and cache refresh after editing show the correct content.
- [ ] Books passes regression coverage, including saved drafts, selection, and read-only imported books.

Automatic crash-recovery drafts can follow as a separate increment; the existing explicit Save Draft path is included here. If added, use a versioned user/environment/post-scoped local store and distinguish local recovery from a confirmed server save.

## Planning completion and Brain impact

This change records a proposal only. No editor, API, database, dependency, or runtime behavior was changed. The Blog feature document links this proposal without advertising rich authoring as shipped. Current contract/schema documents and an accepted ADR should change when implementation establishes those decisions.
