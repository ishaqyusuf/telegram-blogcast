#!/usr/bin/env python3
"""Inspect/extract selected files from Shamela's official ZIP using HTTP ranges.

No API credentials or third-party services are required. Extracted files remain
local; this tool does not write to the application's database.
"""
import argparse
import hashlib
import io
import json
import os
from pathlib import Path
import re
import struct
import subprocess
import tempfile
import time
import zipfile
import zlib

DEFAULT_URL = "https://dev.shamela.ws/downloads/shamela-database-1448.zip"


def headers(text):
    return {k.lower(): v.strip() for k, v in re.findall(r"^([^:\r\n]+):\s*(.*)$", text, re.M)}


class Archive:
    def __init__(self, url, cache):
        if not url.startswith("https://dev.shamela.ws/downloads/") or not url.endswith(".zip"):
            raise ValueError("Use an official HTTPS Shamela downloads ZIP URL")
        self.url = url
        self.cache = Path(cache)
        self.cache.mkdir(parents=True, exist_ok=True)
        head = subprocess.check_output(["curl", "-fsSI", "--max-time", "30", url], text=True)
        meta = headers(head)
        self.size = int(meta["content-length"])
        self.etag = meta.get("etag")
        if not self.etag or self.etag.startswith("W/"):
            raise ValueError("A strong archive ETag is required for consistent range reads")
        self.transferred = 0
        key = hashlib.sha256((url + self.etag).encode()).hexdigest()[:20]
        self.entry_cache = self.cache / key
        self.entry_cache.mkdir(exist_ok=True)

    def read(self, start, length):
        # Some CDN responses ignore Range. Retry only that bounded response;
        # never retry a 429 here or accept the full archive in its place.
        for attempt in range(3):
            try:
                return self._read_once(start, length)
            except RuntimeError as error:
                if "HTTP 200:" not in str(error) or attempt == 2:
                    raise
                time.sleep(2)

    def _read_once(self, start, length):
        if length == 0:
            return b""
        if start < 0 or start + length > self.size:
            raise ValueError("Invalid archive byte range")
        with tempfile.TemporaryDirectory(dir=self.cache) as tmp:
            body, header = Path(tmp) / "body", Path(tmp) / "headers"
            result = subprocess.run([
                "curl", "-sS", "--max-time", "120", "--max-filesize", str(length),
                "-r", f"{start}-{start + length - 1}",
                "-D", str(header), "-o", str(body), self.url,
            ], capture_output=True, text=True)
            raw_headers = header.read_text() if header.exists() else ""
            meta = headers(raw_headers)
            status = re.findall(r"HTTP/\S+ (\d+)", raw_headers)
            if status and status[-1] == "429":
                raise RuntimeError("Rate limited; stopped. Retry-After: " + meta.get("retry-after", "unspecified"))
            if result.returncode:
                raise RuntimeError(f"Range {start}-{start + length - 1}, HTTP {status[-1] if status else 'unknown'}: {result.stderr.strip()}")
            expected = f"bytes {start}-{start + length - 1}/{self.size}"
            if not status or status[-1] != "206" or meta.get("content-range") != expected:
                raise RuntimeError("Server did not honor the exact range; stopped")
            if meta.get("etag") != self.etag:
                raise RuntimeError("Archive changed during download; stopped")
            data = body.read_bytes()
            if len(data) != length:
                raise RuntimeError("Incomplete range response")
            self.transferred += len(data)
            return data

    def entries(self):
        target = self.entry_cache / "index.json"
        if target.exists():
            return json.loads(target.read_text())
        tail_start = max(0, self.size - 65557)
        tail = self.read(tail_start, self.size - tail_start)
        end = tail.rfind(b"PK\x05\x06")
        if end < 0:
            raise ValueError("ZIP end record missing")
        record = struct.unpack_from("<4s4H2IH", tail, end)
        offset = record[6]
        if offset == 0xFFFFFFFF or record[5] == 0xFFFFFFFF:
            locator = struct.unpack_from("<4sIQI", tail, end - 20)
            if locator[0] != b"PK\x06\x07" or locator[3] != 1:
                raise ValueError("Unsupported ZIP64 layout")
            zip64 = struct.unpack("<4sQ2H2I4Q", self.read(locator[2], 56))
            offset = zip64[-1]
        if self.size - offset > 32 * 1024 * 1024:
            raise ValueError("Archive directory exceeds 32 MiB")
        directory = self.read(offset, self.size - offset)
        with zipfile.ZipFile(io.BytesIO(directory)) as archive:
            rows = [dict(name=e.filename, size=e.file_size, compressed=e.compress_size,
                         offset=e.header_offset + offset, method=e.compress_type, crc=e.CRC)
                    for e in archive.infolist()]
        target.write_text(json.dumps(rows))
        return rows

    def extract(self, entry, output):
        output = Path(output).resolve()
        dest = (output / entry["name"]).resolve()
        if not dest.is_relative_to(output):
            raise ValueError("Unsafe ZIP entry path")
        if entry["name"].endswith("/"):
            return dest
        if dest.exists():
            data = dest.read_bytes()
            if len(data) == entry["size"] and zlib.crc32(data) == entry["crc"]:
                return dest
        raw = self.read(entry["offset"], 30)
        header = struct.unpack("<4s5H3I2H", raw)
        if header[0] != b"PK\x03\x04" or header[2] & 1:
            raise ValueError("Invalid or encrypted ZIP member")
        offset = entry["offset"] + 30 + header[-2] + header[-1]
        compressed = self.read(offset, entry["compressed"])
        if entry["method"] == 8:
            inflater = zlib.decompressobj(-15)
            data = inflater.decompress(compressed, entry["size"] + 1)
            if not inflater.eof or inflater.unconsumed_tail or inflater.unused_data:
                raise ValueError("Invalid deflate stream or size")
        elif entry["method"] == 0:
            data = compressed
        else:
            raise ValueError("Unsupported compression method")
        if len(data) != entry["size"] or zlib.crc32(data) != entry["crc"]:
            raise ValueError("ZIP size/CRC validation failed")
        dest.parent.mkdir(parents=True, exist_ok=True)
        temporary = dest.with_suffix(dest.suffix + ".partial")
        temporary.write_bytes(data)
        os.replace(temporary, dest)
        return dest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default=DEFAULT_URL)
    parser.add_argument("--cache", default=".shamela-cache/archive")
    parser.add_argument("--output", default=".shamela-cache/snapshot")
    parser.add_argument("--match", default=r"database/(master\.db|book/679/1679\.db)$")
    parser.add_argument("--fetch", action="store_true")
    parser.add_argument("--max-mib", type=int, default=128)
    args = parser.parse_args()
    archive = Archive(args.url, args.cache)
    selected = [e for e in archive.entries() if re.search(args.match, e["name"]) and not e["name"].endswith("/")]
    size = sum(e["compressed"] for e in selected)
    print(json.dumps(dict(url=args.url, etag=archive.etag, archiveBytes=archive.size,
                          selectedFiles=len(selected), compressedBytes=size), ensure_ascii=False))
    if not selected:
        raise SystemExit("No matching entries")
    if args.fetch and (size > args.max_mib * 1024 ** 2 or any(e["size"] > args.max_mib * 1024 ** 2 for e in selected)):
        raise SystemExit("Selection exceeds --max-mib; inspect the file list before increasing it")
    for entry in selected:
        if args.fetch:
            print(archive.extract(entry, args.output), flush=True)
        else:
            print(entry["name"], entry["compressed"], entry["size"])
    print(f"Transferred {archive.transferred} bytes")


if __name__ == "__main__":
    main()
