import io
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import zipfile
from archive import Archive


class MemoryArchive(Archive):
    def __init__(self, data, cache):
        self.data = data
        self.size = len(data)
        self.entry_cache = Path(cache)

    def read(self, start, length):
        return self.data[start:start + length]


class ArchiveTest(unittest.TestCase):
    def make(self, name="database/book/679/1679.db"):
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as z:
            z.writestr(name, "نص الكتاب\n".encode())
        return buffer.getvalue()

    def test_round_trip_and_idempotent_resume(self):
        with tempfile.TemporaryDirectory() as folder:
            archive = MemoryArchive(self.make(), folder)
            entry = archive.entries()[0]
            path = archive.extract(entry, Path(folder) / "out")
            self.assertEqual(path.read_text(), "نص الكتاب\n")
            with patch.object(archive, "read", side_effect=AssertionError("must use saved file")):
                self.assertEqual(archive.extract(entry, Path(folder) / "out"), path)

    def test_rejects_zip_path_traversal(self):
        with tempfile.TemporaryDirectory() as folder:
            archive = MemoryArchive(self.make("../outside.db"), folder)
            with self.assertRaisesRegex(ValueError, "Unsafe"):
                archive.extract(archive.entries()[0], Path(folder) / "out")

    def test_rejects_corrupt_crc(self):
        with tempfile.TemporaryDirectory() as folder:
            archive = MemoryArchive(self.make(), folder)
            entry = archive.entries()[0]
            entry["crc"] ^= 1
            with self.assertRaisesRegex(ValueError, "CRC"):
                archive.extract(entry, Path(folder) / "out")

    def test_rejects_decompression_size_mismatch(self):
        with tempfile.TemporaryDirectory() as folder:
            archive = MemoryArchive(self.make(), folder)
            entry = archive.entries()[0]
            entry["size"] = 1
            with self.assertRaises(ValueError):
                archive.extract(entry, Path(folder) / "out")

    def test_stops_on_rate_limit(self):
        archive = object.__new__(Archive)
        with patch.object(archive, "_read_once", side_effect=RuntimeError("Rate limited")) as read:
            with self.assertRaisesRegex(RuntimeError, "Rate limited"):
                archive.read(0, 1)
            self.assertEqual(read.call_count, 1)

    def test_bounds_ignored_range_retries(self):
        archive = object.__new__(Archive)
        with patch.object(archive, "_read_once", side_effect=RuntimeError("HTTP 200: ignored")) as read:
            with patch("archive.time.sleep"):
                with self.assertRaisesRegex(RuntimeError, "HTTP 200"):
                    archive.read(0, 1)
            self.assertEqual(read.call_count, 3)


if __name__ == "__main__":
    unittest.main()
