# AI Plan Map

> Canonical planning document for AI-assisted work in this repo.
> Keep this file updated continuously.

---

## 1) Current Objective
- Goal: Update code-culture with `Table.Provider` list-view pattern using `data.map` (no `<Table>` render).
- Owner: Codex
- Start date: 2026-02-24
- Target date: 2026-02-24
- Status: `done`

## 2) Scope Map
- In scope:
  - Add a canonical list-view example that keeps `Table.Provider` but removes `<Table>`.
  - Document explicit rules for `data.map` rendering inside Provider.
- Out of scope:
  - Runtime feature changes in app pages.
- Dependencies:
  - `ai/code-culture-1.1.md`

## 3) Execution Plan
| Step | Task | Owner | Status | ETA | Notes |
|---|---|---|---|---|---|
| 1 | Replace Data Table example with List View under `Table.Provider` | Codex | completed | Today | Removed `<Table>` usage from example |
| 2 | Add explicit list-view rules section | Codex | completed | Today | Rules clarify when to use `data.map` |
| 3 | Keep existing provider/batch/load-more guidance intact | Codex | completed | Today | No behavioral ambiguity |

## 4) Progress Log
| Date | Update | Impact | Next |
|---|---|---|---|
| YYYY-MM-DD |  |  |  |
| 2026-02-24 | Unwrapped `params` before access/logging in `/api/telegram/file/[fileId]`; updated handler type to Promise-based params. | Resolved runtime error for sync access of dynamic API params. | Restart dev server and verify stream requests. |
| 2026-02-24 | Started blog search/filter implementation planning and scope mapping. | Clear implementation path aligned with coding culture. | Implement DB filtering + UI controls. |
| 2026-02-24 | Implemented blog search input + type filter (`all/text/image/audio`) with URL query params and server-side Prisma filtering. | Blog page now supports fast discoverability without client-only filtering. | Validate UX on dev server and tune filter options if needed. |
| 2026-02-24 | Refactored blog filters to Nuqs hook + filter area component; removed Apply button. | Filters now update URL/state using code-culture Nuqs pattern while keeping server fetch filtering. | Verify UX responsiveness and query URL behavior. |
| 2026-02-24 | Updated code-culture with `Table.Provider` + `data.map` list-view example (no `<Table>`). | Standardized list-view implementation guidance for table provider features. | Apply this pattern in feature pages that use card/list UI. |

## 5) Blockers & Risks
| Type | Description | Severity | Mitigation | Owner |
|---|---|---|---|---|
| blocker/risk |  | low/med/high |  |  |

## 6) Decisions
| Date | Decision | Reason | Tradeoff |
|---|---|---|---|
| YYYY-MM-DD |  |  |  |
| 2026-02-24 | Use URL query params (`q`, `type`) and server-side filtering in page query. | Keeps filtering shareable/bookmarkable and avoids client-side data overfetch. | Adds Prisma `OR` filters on each request. |
| 2026-02-24 | Use `useQueryStates` + `createLoader` for blog filters. | Aligns with documented repo code-culture filter architecture. | Introduces a small client filter component/hook split. |
| 2026-02-24 | Prefer `Table.Provider` with custom list rendering via `data.map` for non-tabular screens. | Reuses provider ecosystem while matching list/card UX requirements. | Loses built-in table header/body primitives intentionally. |

## 7) Roadmap
### Now (0-2 weeks)
- Add optional channel/date filters if needed after user validation.

### Next (2-6 weeks)
- 

### Later (6+ weeks)
- 

## 8) Definition of Done
- [x] Feature implemented
- [ ] Tests and verification completed
- [x] Docs updated
- [ ] Rollout notes captured

## 9) Change Log
- YYYY-MM-DD: initialized `ai/plan.md`
- 2026-02-24: logged Telegram file route params fix.
- 2026-02-24: added blog search/filter task plan and progress entry.
- 2026-02-24: completed blog search/filter implementation and logged decision/progress.
- 2026-02-24: refactored blog filters to Nuqs pattern and removed Apply button.
- 2026-02-24: added `Table.Provider` list-view example (without `<Table>`) to code-culture.
