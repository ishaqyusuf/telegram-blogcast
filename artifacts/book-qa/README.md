# Book feature QA evidence

Screenshots in this directory are generated from the isolated Android emulator
and isolated web/database test environment for Shamela book `21739`.

## Captured import

- Book: `كتاب بداية المجتهد ونهاية المقتصد`
- TOC status: `complete`
- Recursive TOC nodes: `487`
- Page stubs created from the TOC: `352`
- `/book/21739/1`: fetched, printed page 9, 8 paragraphs, 6 source-color
  ranges, next link `/book/21739/2`
- `/book/21739/2`: fetched through the stored adjacent link, printed page
  10, previous link `/book/21739/1`, next link `/book/21739/3`
- `/book/21739/3`: deliberately left pending to prove that swiping from page
  10 opens the calculated Shamela capture URL.

## Screenshots

- `web-01-import.png`: web Shamela import page.
- `mobile-01-reader-source-color.png`: initial reader and preserved `.c5`
  source color.
- `mobile-02-chapter-tree.png`: searchable recursive index showing all 487
  nodes and three visible nesting levels.
- `mobile-03-bookmark.png`: active bookmark state; persistence was also
  verified in AsyncStorage.
- `mobile-04-highlight-layering.png`: yellow user highlight layered behind
  the blue Shamela source text.
- `mobile-05-swipe-fetched-next.png`: locale-aware swipe from printed page 9
  to already-fetched printed page 10.
- `mobile-06-swipe-missing-capture.png`: swipe from page 10 opens the live
  capture screen at `https://shamela.ws/book/21739/3`.

The Android run used the dedicated `AlGhurobaa_Book_QA_API_34` AVD on
`emulator-5558`; no existing emulator or application data was modified.
