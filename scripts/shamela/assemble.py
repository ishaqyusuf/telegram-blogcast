#!/usr/bin/env python3
"""Join exported Shamela Lucene pages to a copied desktop SQLite database.

Fails if any expected page is missing or duplicated. Keeps raw HTML intact;
this is a source export, not an application database migration.
"""
import argparse
from contextlib import closing
from html.parser import HTMLParser
import json
from pathlib import Path
import sqlite3


class Headings(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.active = []
        self.headings = {}

    def handle_starttag(self, tag, attrs):
        if tag != "span":
            return
        key = dict(attrs).get("id", "")
        self.active.append([key[4:] if key.startswith("toc-") else None, []])

    def handle_data(self, value):
        for _, parts in self.active:
            parts.append(value)

    def handle_endtag(self, tag):
        if tag != "span" or not self.active:
            return
        key, parts = self.active.pop()
        if key is not None:
            self.headings[int(key)] = "".join(parts).strip()


def database(path):
    connection = sqlite3.connect(Path(path).resolve().as_uri() + "?mode=ro", uri=True)
    connection.row_factory = sqlite3.Row
    return connection


def assemble(root, book_id, pages_path):
    root = Path(root)
    book_path = root / "book" / f"{book_id % 1000:03d}" / f"{book_id}.db"
    with closing(database(root / "master.db")) as master, closing(database(book_path)) as book:
        row = master.execute("select * from book where book_id = ?", (book_id,)).fetchone()
        if row is None:
            raise ValueError("Book is missing from the archive catalog")
        metadata = dict(row)
        authors = [dict(r) for r in master.execute(
            "select a.* from author a join author_book ab on a.author_id=ab.author_id where ab.book_id=?",
            (book_id,))]
        pages = [dict(r) for r in book.execute("select * from page order by id")]
        titles = [dict(r) for r in book.execute("select * from title order by id")]
    bodies = {}
    with Path(pages_path).open() as source:
        for line in source:
            row = json.loads(line)
            if not row["id"].startswith(f"{book_id}-"):
                continue
            page_id = int(row["id"].split("-", 1)[1])
            if page_id in bodies:
                raise ValueError(f"Duplicate source page {page_id}")
            if not isinstance(row.get("body"), str):
                raise ValueError(f"Missing body for source page {page_id}")
            bodies[page_id] = row["body"]
    expected = {p["id"] for p in pages}
    if not expected or expected != set(bodies):
        raise ValueError(f"Incomplete book: missing={len(expected - set(bodies))}, extra={len(set(bodies) - expected)}")
    headings = Headings()
    for page in pages:
        page["contentHtml"] = bodies[page["id"]]
        page["sourceUrl"] = f"https://shamela.ws/book/{book_id}/{page['id']}"
        headings.feed(page["contentHtml"])
    headings.close()
    title_ids = {t["id"] for t in titles}
    for title in titles:
        if title["page"] not in expected or (title["parent"] and title["parent"] not in title_ids):
            raise ValueError("Chapter references an unknown page or parent")
        title["text"] = headings.headings.get(title["id"])
    return {
        "format": "shamela-desktop-source-v1", "shamelaId": book_id,
        "metadata": metadata, "authors": authors, "pages": pages, "titles": titles,
        "validation": {"expectedPages": len(pages), "exportedPages": len(bodies),
                       "missingPages": 0, "duplicatePages": 0,
                       "titlesWithoutText": sum(t["text"] is None for t in titles)},
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--database", default=".shamela-cache/snapshot/database")
    parser.add_argument("--book", required=True, type=int)
    parser.add_argument("--pages", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    result = assemble(args.database, args.book, args.pages)
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_suffix(output.suffix + ".partial")
    temporary.write_text(json.dumps(result, ensure_ascii=False, indent=2))
    temporary.replace(output)
    print(json.dumps({"book": result["metadata"]["book_name"], "output": str(output),
                      **result["validation"]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
