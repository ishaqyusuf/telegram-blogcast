# KetabOnline and Shamela book acquisition research

Date: 2026-10-12 (Africa/Lagos). Research completed; product integration is not implemented.

## Outcome

KetabOnline is the easiest verified route for whole-book acquisition. Public requests returned title search, metadata, formatted page text, and volume-specific chapter indexes without an account or API key. Use the metadata's `files.data.url` rather than assuming a permanent CDN naming convention. Download the ZIP once for pages, then request the complete index for every volume. The ZIP's embedded index can be incomplete even when all pages are present.

Shamela's v4 download SDK requires an issued API key and configurable service endpoints. There is also an official key-free full-library desktop archive, but its current text storage and parser compatibility remain unresolved. Its newly documented public MCP service returned 404 in this investigation and does not provide a verified bulk-book route.

## Target identity and evidence boundary

- Comprehensive Islamic Library / جامع الكتب الإسلامية: [Google Play](https://play.google.com/store/apps/details?id=com.ketabonline), Android package `com.ketabonline`.
- Official Shamela / المكتبة الشاملة: [Google Play](https://play.google.com/store/apps/details?id=com.arabdt.shamla), Android package `com.arabdt.shamla`.
- Used REA CLI `rea-agents@6.4.0` through a temporary npm cache. Read the [upstream REA skill](https://github.com/morluto/rea/blob/main/.agents/skills/reverse-engineer-anything/SKILL.md), its connection recovery guide, and Android guide. No global installation or Codex configuration changes were made.
- REA `resolve-adb-packages` found no matching target packages on `emulator-5554`. APKs and native Android network traffic were not inspected. These findings establish usable public acquisition paths, not that a particular Android app version makes identical requests.
- REA inspected the actual downloaded KetabOnline ZIP and retained its digest and member inventory. Python separately parsed JSON and checked page/index completeness. Ordinary HTTP/Python observations are not REA evidence.
- Retained machine-readable evidence: [summary and REA records](2026-10-12-book-api-evidence.json).

## KetabOnline: verified requests

The community [SDK](https://github.com/ragaeeb/ketab-online-sdk) and its [network implementation](https://github.com/ragaeeb/ketab-online-sdk/blob/main/src/utils/network.ts) identify the backend. Its [book download implementation](https://github.com/ragaeeb/ketab-online-sdk/blob/main/src/utils/book.ts) identifies the ZIP route. Independently tested these requests successfully:

| Purpose | Request | Result |
| --- | --- | --- |
| Title search | `GET https://backend.ketabonline.com/api/v2/books?q=<URL-encoded Arabic>&page=1&limit=3` | HTTP 200; `code: 200`, `data`, `links`, `meta` |
| Metadata | `GET https://backend.ketabonline.com/api/v2/books/62952` | HTTP 200; title, authors, parts, counts, source, version, `files.data.url` |
| Book text ZIP | `GET https://s2.ketabonline.com/books/62952/62952.data.zip` | HTTP 200; one JSON member, all 5,444 pages |
| Volume chapter tree | `GET https://backend.ketabonline.com/api/v2/books/62952/index?is_recursive=1&part=1` | HTTP 200; nested chapter rows; repeat for all volumes |

Responses use application-level `code` in addition to HTTP status. Arabic query strings must be encoded; passing raw Arabic in the request URL produced HTTP 400, while `curl --data-urlencode` worked. Search titles may include `<em>` highlight markup.

### Completeness checks

| Book | ZIP bytes | Pages declared/actual | Volumes | Complete index declared/actual |
| --- | ---: | ---: | ---: | ---: |
| 62952 — مصنف عبد الرزاق - ط التأصيل الثانية | 5,267,564 | 5,444 / 5,444 | 10 | 2,762 / 2,762 after index requests |
| 29423 — قيام الليل .. رياض الصالحين .. وملاذ المحبين | 20,591 | 19 / 19 | 1 | 1 / 1 in ZIP |

The large ZIP expands to 69,781,888 bytes. All 5,444 pages have unique IDs and nonempty content. Its embedded `index` has just 3 recursively counted entries, despite `index_count: 2762`. Fetching parts 1–10 recovered respectively 301, 234, 218, 239, 289, 325, 343, 282, 246, and 285 entries: 2,762 unique chapter IDs, with zero missing page targets. A ZIP download alone therefore does not establish a complete chapter tree.

Page fields observed: `id`, `page`, `index`, `content`, `seal`, `quran`, `hadeeth`, `shrooh`, `rowa`, `part`, `reciters`. Content contains formatted Arabic HTML and paragraph IDs. `part` contains an ID and name. API index rows include `id`, `parent`, `title`, `book_id`, `page_id`, `to_page_id`, `page`, `part_name`, `title_level`, `reciters`, and `children`.

### Minimal reproduction

```sh
curl --fail --get \
  --data-urlencode 'q=رياض' --data-urlencode 'page=1' --data-urlencode 'limit=3' \
  'https://backend.ketabonline.com/api/v2/books'

curl --fail 'https://backend.ketabonline.com/api/v2/books/29423'
curl --fail -o /tmp/29423.data.zip \
  'https://s2.ketabonline.com/books/29423/29423.data.zip'

python3 - <<'PY'
import json, zipfile
with zipfile.ZipFile('/tmp/29423.data.zip') as archive:
    book = json.loads(archive.read('29423.data.json'))
print(book['title'], len(book['pages']))
PY
```

SDK equivalents: `getBooks({ query, page, limit })`, `getBookInfo(id)`, `getBookContents(id)`, and `getBookIndex(id, { isRecursive: true, part })`. The SDK is community maintained; these successful tests do not establish a supported public API contract, rate limit, or redistribution license. PDF acquisition was not tested.

## Shamela: three separate options

### Issued-key per-book API

The [community SDK README](https://github.com/ragaeeb/shamela) requires an API key and directs access inquiries to `mail@shamela.ws`. No message was sent and no key was extracted from another application.

The [API implementation](https://github.com/ragaeeb/shamela/blob/main/src/api.ts) and [network helper](https://github.com/ragaeeb/shamela/blob/main/src/utils/network.ts) establish:

```text
GET {booksEndpoint}/{id}?major_release=0&minor_release=0&api_key={issued_key}
  -> major_release, major_release_url, optional minor_release/minor_release_url

GET {masterPatchEndpoint}?version=0&api_key={issued_key}
  -> patch_url, version
```

The library downloads ZIP-contained SQLite files, applies available patches, and exposes `getBook(id)` or `downloadBook(id, { outputFile: { path } })` for JSON/SQLite output. Endpoint hosts must be supplied; the README placeholders are not deployable URLs. A trial at `shamela.ws/api/books/26592` returned 404 and does not establish the proper host or authentication behavior. Authenticated book/master retrieval was not tested.

### Official full-library archive

The [official download page](https://shamela.ws/page/download) links [shamela-database-1448.zip](https://dev.shamela.ws/downloads/shamela-database-1448.zip). HEAD returned HTTP 200, `application/zip`, 13,294,044,352 bytes (13.29 GB / 12.38 GiB), last modified 2026-07-30. The page describes replacing the desktop application's database folder with the extracted full folder.

A bounded range probe returned HTTP 200/full body rather than 206 despite the server advertising ranges. It was stopped by its timeout after a partial download; selective remote extraction cannot be assumed. Partial ZIP local headers showed numbered files such as `database/book/000/1000.db`. Local inspection of that sample found 3,224 `page` rows and 998 `title` rows, but neither table contains the `content` column expected by the community SDK. Actual text storage remains unresolved. Do not wire this archive directly into that SDK's parser or claim it has been fully decoded.

### Documented public MCP

[Official support](https://shamela.ws/page/support) documents `https://shamela.ws/mcp` as a public, read-only service requiring no account, for search/source pages/quotation checks. GET and POST initialization returned HTTP 404 in this environment. This is a documented option, not a working integration established here. The [terms](https://shamela.ws/page/terms) describe research/citation use and retain content rights; MCP should not be assumed to be a full-library export API.

## Suggested al-ghurobaa integration — not implemented

The user's requested next-agent handoff is now [the canonical implementation plan](../plans/2026-10-12-ketabonline-book-import-handoff.md), tracked by [a separate planned task](../tasks/2026-10-12-ketabonline-book-import.md). It incorporates the demo diagnosis below and the existing reader/cache/database constraints. No implementation or dispatch occurred while preparing it.

1. Add a server-side KetabOnline acquisition job: search/select a book, fetch metadata, follow `files.data.url`, validate bounded ZIP/JSON, fetch every part's index, and import with resumable batches. Keep large expanded JSON off the mobile main thread.
2. Preserve formatted HTML, paragraph identifiers, footnote links/content, printed page labels, part identity, and source page IDs. Validate counts and chapter targets before marking a whole-book import complete.
3. Introduce explicit provider/source ID mappings. KetabOnline ID 62952 is not established to equal a Shamela ID; even `source: المكتبة الشاملة` is insufficient to deduplicate editions or redirect annotations. Do not populate Shamela-specific IDs/URLs using KetabOnline numbers.
4. Reuse the app's book/page persistence, annotation-preserving refresh logic, import tracking, chapter persistence, and existing offline download machinery after source normalization. Existing WebView capture remains the deployed behavior until an approved implementation changes it.
5. For native Shamela acquisition, obtain issued credentials and confirmed endpoints, then test catalog/book/patch imports. Treat the bulk snapshot as a separate parser investigation.

No API routes, schemas, dependencies, or app behavior changed during this research. Any implementation requires its own task and API/database/ADR impact review.

## Demo availability follow-up (2026-10-12)

Investigated the user's report that `https://demo.ketabonline.workers.dev/` was not working. Live HTTP returned 200 and the actual browser loaded categories and opened a category's book list, with no captured console errors. This does not rule out a user-specific connection or intermittent failure.

Opening listed book 500300 reproduced `0 pages • 0 index entries`. Its public CDN ZIP returned HTTP 200 (1,410 bytes) and contains explicit empty `pages` and `index` arrays. The metadata endpoint for that same ID returned 404. Thus this particular empty reader is explained by missing text in the delivered source bundle, not a demonstrated whole-site outage. The reader source maps whatever `book.pages` contains and supplies no explanatory empty-content message: [book route](https://github.com/ragaeeb/ketab-online-sdk/blob/main/demo/src/routes/book.%24id.tsx).

Control test: [demo book 29423](https://demo.ketabonline.workers.dev/book/29423) rendered its 19 pages and one index entry in the browser. The reader works for this confirmed text-bearing book. Exact cause of the user's own failure remains unconfirmed until the affected route or error is known. No demo fix or deployment was made.

### Confirmed browsing and large-book failures

After the user clarified that browsing/reading fails, further checks established:

- **Large book request fails at the demo host.** One bounded GET to `https://demo.ketabonline.workers.dev/book/62952` returned HTTP 503, a 17-byte `error code: 1102` response, in 6.166 seconds. This book's upstream ZIP had already downloaded and validated successfully. [Cloudflare's 1102 documentation](https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-1xxx-errors/error-1102/) identifies exceeded CPU or memory limits. Without the owner's Worker logs, which limit was exceeded is unknown. The [demo server function](https://github.com/ragaeeb/ketab-online-sdk/blob/main/demo/src/server/api.ts) downloads/parses the whole book before returning; its reader maps every page rather than paginating. For this sample, the JSON alone expands to 69.8 MB with 5,444 pages. Whole-book processing/rendering is a supported explanation for resource exhaustion, not an observed CPU/memory profile.
- **Category filters are ineffective in the tested API requests.** `GET /api/v2/books?limit=3&page=1`, the same query with `category_id=1`, and with `category_id=2` returned identical first IDs `[500300,500301,500302]`. Those rows have category IDs 304/306 rather than 1/2. The [demo's server function](https://github.com/ragaeeb/ketab-online-sdk/blob/main/demo/src/server/api.ts) passes `category_id` through as a query parameter. Its category heading can change while the data remains unfiltered. The proper upstream filter contract is not established by these probes; author filtering was not separately tested.
- **Arabic title search works.** Browser submission of `رياض` produced matching titles, including books 24631 and 29423, with no captured console errors. This rules out a general search/navigation failure for this specific tested flow.

Recommended implementation changes for a future importer/demo: establish the category-filter contract, show explicit missing-content states, normalize/copy each book through a background ingestion job once, then serve cached individual pages or bounded chunks. Do not repeatedly decompress and render thousands of pages in a single Worker request. No external fix was authorized or deployed.
