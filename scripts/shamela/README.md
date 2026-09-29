# Shamela archive extraction experiment

Tested 2026-09-27. This is a local source acquisition tool. It does not publish
books or modify the app's PostgreSQL or Android cache databases.

## Reproduce the successful sample

Requirements: Python 3.10+, curl, and a Java 21+ JDK. Dependencies are downloaded
from Apache Lucene's Maven coordinates and checked against their SHA-512 files.
On this Mac the script selects the existing Homebrew JDK 25.

```sh
bash scripts/shamela/run-sample.sh
python3 -m unittest discover -s scripts/shamela -p 'test_*.py'
```

Output: `.shamela-cache/books/2094.json`, containing the complete 351-page
**جغرافية المناخ والنبات** by يوسف عبد المجيد فايد, including all 26 chapter
titles and their parent/page links. The source page IDs are 1–351; printed page
numbers differ. The sample's first printed page is 3 and its last is 367.

The script downloads selected files from the official 1448 ZIP, using about
1.6 MB of compressed book/catalog/segment data plus the ZIP directory and Java
libraries. It does not download the entire 13.3 GB archive. All binary and book
outputs live in the ignored `.shamela-cache/` folder.

## Inspect or fetch other archive members

```sh
# List the whole archive without fetching its contents.
python3 scripts/shamela/archive.py --match '.'

# Fetch metadata for the book already being tested in the app.
python3 scripts/shamela/archive.py --fetch --match 'database/book/679/1679\.db$'
```

That individual SQLite file contains page/volume numbers and chapter references,
but **no page body text**. Complete text is in `database/store/page/` Lucene
segments. The master SQLite catalog contains names, authors, categories, and
version fields. Book 1679 is not fully exported by the sample command.

For arbitrary books, obtain the relevant complete Lucene segments or use the
full desktop archive. The sample's `_7iq` segment is specific to the 1448
snapshot; it is not a general per-book download endpoint. Books can span
segments. `assemble.py` fails if the extracted IDs do not exactly match the
book's SQLite page IDs, or if duplicate IDs or invalid chapter links occur.
If a chapter label cannot be recovered from an embedded `toc-N` span, the
JSON records a null label and a nonzero `titlesWithoutText`; the dedicated
title index is then needed. All raw page HTML is retained unchanged.

The archive reader verifies exact HTTP ranges, archive ETags, file sizes,
decompression limits, and ZIP CRCs. It rejects paths outside the output folder,
skips already validated files on reruns, and stops on HTTP 429, reporting
Retry-After. It retries an ignored-range HTTP 200 at most twice, while keeping
each transfer bounded. It never uses API keys copied from third-party repos.

## Sources and integration direction

- [Official downloads](https://shamela.ws/page/download) — the full database is
  publicly linked and the desktop database folder is portable between systems.
- [Official 1448 database ZIP](https://dev.shamela.ws/downloads/shamela-database-1448.zip)
  — 13,294,044,352 bytes compressed; the ZIP directory reports
  15,363,238,591 bytes uncompressed. Additional JSON copies require more space.
- [ragaeeb/shamela](https://github.com/ragaeeb/shamela) — useful TypeScript API
  client and content helpers; requires an API key obtained from Shamela.
- [ammusto/shamela-extractor](https://github.com/ammusto/shamela-extractor) —
  desktop extraction approach, but its documented Lucene 9.10 dependency needs
  updating for the Lucene 10.4 files observed in this archive.
- [dalailcentere/shamela-api](https://github.com/dalailcentere/shamela-api) —
  self-hosted API example, not evidence of a supported public API service.

Recommended app integration: acquire a desktop snapshot once, convert complete
books to versioned packages, then let the Android app download those packages
from our service. Preserve Shamela source IDs and printed page numbers separately.
Use authorized API access for incremental updates if granted; otherwise compare
official snapshot versions. An adapter to our document format and a batched,
idempotent database write path are still needed. Changing the source alone does
not resolve the earlier server write timeout.
