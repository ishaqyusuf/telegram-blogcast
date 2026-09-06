# Separate Shamela Page And Chapter Capture

Status: Accepted
Date: 2026-09-06

## Context
Shamela page sidebars can omit descendant lists until expanded. Requiring a complete sidebar before saving a page couples content import to unreliable lazy navigation state.

## Decision
Save the page first using existing staging/promotion. Treat TOC capture as a separate explicit action on the matching book root. Parse `.betaka-index` preferentially and support `.s-nav`; validate recursively loaded descendants and write the hierarchy atomically. Keep the saved page available if chapter capture fails or is cancelled.

## Consequences
New and incomplete books require a second capture action; complete books go directly to the reader. Chapter capture cannot alter existing page content, metadata, highlights, or comments. No new database fields are required, but the existing TOC schema must be deployed.

## Alternatives
Automatically expanding the page sidebar before importing was rejected because page saving should not depend on chapter loading. Assuming all hidden branches are already populated was rejected because absent descendants are not represented by a hidden list.
