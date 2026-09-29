import json
from contextlib import closing
from pathlib import Path
import sqlite3
import tempfile
import unittest
from assemble import assemble


class AssembleTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        with closing(sqlite3.connect(self.root / "master.db")) as db:
            db.executescript("""
                create table book(book_id integer, book_name text);
                insert into book values(1, 'كتاب');
                create table author(author_id integer, author_name text);
                create table author_book(author_id integer, book_id integer);
            """)
        folder = self.root / "book" / "001"
        folder.mkdir(parents=True)
        with closing(sqlite3.connect(folder / "1.db")) as db:
            db.executescript("""
                create table page(id integer, part text, page integer);
                insert into page values(1, '1', 7);
                create table title(id integer, page integer, parent integer);
                insert into title values(1, 1, 0);
            """)
        self.pages = self.root / "pages.jsonl"
        self.line = json.dumps({"id": "1-1", "body": '<span id="toc-1">باب <span>الأول</span></span> نص'}, ensure_ascii=False)
        self.pages.write_text(self.line + "\n")

    def tearDown(self):
        self.temp.cleanup()

    def test_preserves_text_page_ids_and_nested_heading(self):
        result = assemble(self.root, 1, self.pages)
        self.assertEqual(result["pages"][0]["page"], 7)
        self.assertEqual(result["pages"][0]["sourceUrl"], "https://shamela.ws/book/1/1")
        self.assertEqual(result["titles"][0]["text"], "باب الأول")
        self.assertEqual(result["validation"]["missingPages"], 0)

    def test_missing_page_fails(self):
        self.pages.write_text("")
        with self.assertRaisesRegex(ValueError, "Incomplete book"):
            assemble(self.root, 1, self.pages)

    def test_duplicate_page_fails(self):
        self.pages.write_text(self.line + "\n" + self.line + "\n")
        with self.assertRaisesRegex(ValueError, "Duplicate source page"):
            assemble(self.root, 1, self.pages)

    def test_missing_chapter_target_fails(self):
        with closing(sqlite3.connect(self.root / "book" / "001" / "1.db")) as db:
            db.execute("update title set page=9")
            db.commit()
        with self.assertRaisesRegex(ValueError, "unknown page"):
            assemble(self.root, 1, self.pages)


if __name__ == "__main__":
    unittest.main()
