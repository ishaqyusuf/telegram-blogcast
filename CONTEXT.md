# Al Ghurobaa

Al Ghurobaa organizes imported and derived learning content into playable, searchable blogs and collections.

## Audio chapters

**Parent Audio Blog**:
The canonical audio blog whose media supplies the source timeline for one or more chapter blogs.
_Avoid_: Source chapter, original chunk

**Chapter Blog**:
A first-class audio blog representing one titled, non-overlapping range of a parent audio blog.
_Avoid_: Audio comment, search-only chapter, chapter pseudo-item

**Chapter Definition**:
The chapter blog's canonical title and half-open time range on its parent media, whether or not a separate audio file has been produced.
_Avoid_: Timestamp comment, clip metadata

**Materialized Chapter**:
A chapter blog whose defined range has been cut into its own audio file and published to Telegram.
_Avoid_: Chunkified blog, detached audio

**Local Media Gateway**:
The Local Services component that prepares, caches, and streams Telegram media which the hosted Bot API cannot download directly.
_Avoid_: Locator service, large-audio server
