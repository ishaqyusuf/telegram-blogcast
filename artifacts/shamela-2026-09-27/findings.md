# Shamela acquisition options — tested 2026-09-27

## Recommendation

Use the official desktop database archive as the initial source, extract full
books locally, and serve versioned book packages through our own API. Obtain
authorized Shamela API access for incremental updates if available. Keep the
current WebView capture as a fallback for material newer than the snapshot.

## Options and observed results

| Option | Test result | Assessment |
| --- | --- | --- |
| Official complete database ZIP | HTTP 200; 13,294,044,352 bytes. Explicit byte-range requests work. ZIP index has 8,593 book SQLite files; master catalog has 8,593 book records. | Best immediately usable source for bulk acquisition. |
| Shamela API | Unauthenticated book metadata request returned HTTP 401. | Promising for versioned updates, but requires legitimate API credentials. |
| Connected Samsung phone | Both `com.arabdt.shamla` and `com.nyitgroup.shamelareader` installed. Their accessible external app folders contained no files. Both rejected `run-as` because they are not debuggable. | Copying the tested Android/data folders does not recover books on this phone. A supported app export or separately copied readable files would be needed. Private databases were not extracted. |
| GitHub API clients | `ragaeeb/shamela` documents a required API key. `dalailcentere/shamela-api` is a self-hosted example, not a verified public hosted service. | Useful implementation references; neither establishes unrestricted public API access. |
| GitHub desktop extractor | `ammusto/shamela-extractor` documents Lucene 9.10, while this archive contains Lucene 10.4 files. | Useful architecture reference; its reader dependencies need updating for this archive. |

## Successful extraction

- Source: official `shamela-database-1448.zip`; ETag `"3186304c0-657d8c744ef00"`.
- Archive uncompressed member total: 15,363,238,591 bytes.
- Downloaded selected metadata and one small Lucene text segment; the sample
  selection is 1,580,050 compressed bytes, plus directory and dependency downloads.
- Exported book **2094**, **جغرافية المناخ والنبات**, author **يوسف عبد المجيد فايد**.
- Expected page IDs from SQLite: **351**. Exported: **351**. Missing: **0**.
  Duplicates: **0**. Chapter titles and parent/page links: **26**. Missing labels: **0**.
- Preserved source IDs 1–351, printed page numbers, raw Arabic HTML, author/catalog
  metadata, and chapter hierarchy. First printed page: 3; last printed page: 367.
- Compared the opening text, title, author, and printed page to the website.
- JSON: `.shamela-cache/books/2094.json` (825,008 bytes).
- JSON SHA-256: `9e45c809173b49366d57774f5792ac575fff0f3b97f4727e6333f77e0272be5f`.
- Re-running the sample reused all validated archive files, transferring no new
  archive body data. Ten automated tests passed.

The 13.3 GB full archive was not downloaded. This is a local source export;
the sample was not written to production or the Android reader cache. The
geography book was chosen because its complete text occupied a small segment,
allowing a bounded proof of extraction.

For the existing test book **1679**, its SQLite file confirms **734 pages** but
contains only pagination/chapter links. Its body text has not been exported.
This explains why copying only `database/book/...db` cannot supply full books.

## Reproduce

```sh
bash scripts/shamela/run-sample.sh
python3 -m unittest discover -s scripts/shamela -p 'test_*.py'
```

See `scripts/shamela/README.md` for dependencies, source format, range validation,
rate-limit behavior, and scope. Downloaded data is ignored by Git.

## What integration still requires

An adapter must map this export into the app's existing document and paragraph
format. Import books in idempotent batches, preserve existing page IDs and
annotations, then update content hashes/manifests for local cache synchronization.
The earlier server write timeout remains a separate issue; replacing acquisition
does not itself fix that write path. A snapshot is dated content, so newer changes
need authorized API patches or a newer official archive.

## Sources

- [Shamela official downloads](https://shamela.ws/page/download)
- [Official full database ZIP](https://dev.shamela.ws/downloads/shamela-database-1448.zip)
- [Sample book opening page](https://shamela.ws/book/2094/1)
- [TypeScript client and API key notice](https://github.com/ragaeeb/shamela)
- [Desktop extractor](https://github.com/ammusto/shamela-extractor)
- [Self-hosted API example](https://github.com/dalailcentere/shamela-api)
- [Android storage model](https://developer.android.com/training/data-storage)
