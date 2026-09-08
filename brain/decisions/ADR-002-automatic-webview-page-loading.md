# Automatic WebView Page Loading

Status: Accepted
Date: 2026-09-08

## Context
Mobile reading previously required opening a browser and explicitly capturing each missing page. The user approved automatic acquisition with a reader skeleton, and explicitly rejected direct HTTP fetching due to past source challenges.

## Decision
Own a single concealed, mounted WebView above reader routes. Reading requests resolve saved pages first, then acquire missing source HTML in the device session. Observe stable `.nass` content and invoke existing staging/promotion. Interactive verification reveals the same native instance; successful capture conceals it again without an Extract action. A source-based loading route exists before internal IDs are known, and seeds canonical reader data before replacing the route.

Use request generations, bounded source/save deadlines, one transient retry, shared consumer leases, and one low-priority adjacent prefetch. Source navigation pauses on app/network backgrounding. Existing server saves may finish after the user navigates away, but cannot navigate the user back.

## Page/Chapter Boundary
Retain ADR-001's separate explicit chapter capture. Automatic page loading returns immediately to the saved reader even when the chapter index is incomplete. No source HTTP fast path or server-side browser is introduced.

## Consequences
- Ordinary page reading requires no visible browser or extraction button.
- Verification remains interactive and may be unsupported by a source WebView challenge.
- Full background execution after app termination is outside this implementation.
- Existing chapter workflow, server parsers, annotation remapping and persistence remain authoritative.
