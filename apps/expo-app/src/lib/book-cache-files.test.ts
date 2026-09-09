import { describe, expect, test } from "bun:test";
import { androidDocumentPath, readRecoverableBookFile, safeBookRelativePath, writeRecoverableBookFile, type BookFileAccess } from "./book-cache-files";

function fixture() {
	const rows = new Map<string, string>();
	const files: BookFileAccess = {
		async read(path) { return rows.get(path) ?? null; },
		async write(path, value) { rows.set(path, value); },
		async remove(path) { rows.delete(path); },
	};
	return { rows, files };
}
const path = "book-3/pages/page-12.json";
const validate = (text: string) => {
	const value = JSON.parse(text);
	if (value.bookId !== 3 || value.pageId !== 12) throw new Error("Wrong page");
	return value as { bookId: number; pageId: number; version: number };
};
const content = (version: number) => JSON.stringify({ bookId: 3, pageId: 12, version });

describe("recoverable book files", () => {
	test("shorter replacements work when the provider does not truncate existing files", async () => {
		const { files, rows } = fixture();
		const nonTruncating = { ...files, async write(destination: string, value: string) {
			rows.set(destination, value + (rows.get(destination)?.slice(value.length) ?? ""));
		} };
		await writeRecoverableBookFile(nonTruncating, path, content(10000), validate);
		await writeRecoverableBookFile(nonTruncating, path, content(2), validate);
		await writeRecoverableBookFile(nonTruncating, path, content(3), validate);
		expect(rows.get(path)).toBe(content(3));
		expect(rows.get(`${path}.previous`)).toBe(content(2));
		expect(rows.has(`${path}.pending`)).toBe(false);
	});
	test("interruption after removing the canonical file retains a verified previous copy", async () => {
		const { files, rows } = fixture();
		await writeRecoverableBookFile(files, path, content(1), validate);
		const interrupted = { ...files, async write(destination: string, value: string) {
			if (destination === path) throw new Error("interrupted before create");
			await files.write(destination, value);
		} };
		await expect(writeRecoverableBookFile(interrupted, path, content(2), validate)).rejects.toThrow("interrupted");
		expect(rows.has(path)).toBe(false);
		expect(await readRecoverableBookFile(files, path, validate)).toEqual({ value: validate(content(1)), recovered: true });
	});
	test("an unreadable current file still recovers a valid previous copy", async () => {
		const { files, rows } = fixture();
		rows.set(`${path}.previous`, content(1));
		const unreadable = { ...files, async read(candidate: string) {
			if (candidate === path) throw new Error("Book file is not a supported size or type.");
			return files.read(candidate);
		} };
		expect(await readRecoverableBookFile(unreadable, path, validate)).toEqual({ value: validate(content(1)), recovered: true });
	});
	test("unreadable copies do not masquerade as missing files", async () => {
		const { files } = fixture();
		const unreadable = { ...files, async read() { throw new Error("permission revoked"); } };
		await expect(readRecoverableBookFile(unreadable, path, validate)).rejects.toThrow("permission revoked");
	});
	test("publishes and verifies files while preserving the last valid content", async () => {
		const { files, rows } = fixture();
		await writeRecoverableBookFile(files, path, content(1), validate);
		await writeRecoverableBookFile(files, path, content(2), validate);
		expect(rows.get(path)).toBe(content(2));
		expect(rows.get(`${path}.previous`)).toBe(content(1));
		expect((await readRecoverableBookFile(files, path, validate))?.recovered).toBe(false);
	});
	test("recovers after interruption during canonical file replacement", async () => {
		const { files, rows } = fixture();
		await writeRecoverableBookFile(files, path, content(1), validate);
		const failing: BookFileAccess = { ...files, async write(destination, value) {
			if (destination === path) { rows.set(path, "{partial"); throw new Error("disk full"); }
			return files.write(destination, value);
		} };
		await expect(writeRecoverableBookFile(failing, path, content(2), validate)).rejects.toThrow("disk full");
		expect(await readRecoverableBookFile(files, path, validate)).toEqual({ value: validate(content(1)), recovered: true });
		await writeRecoverableBookFile(files, path, content(2), validate);
		expect(rows.get(`${path}.previous`)).toBe(content(1));
	});
	test("a failed backup never touches the canonical file", async () => {
		const { files, rows } = fixture();
		await writeRecoverableBookFile(files, path, content(1), validate);
		const failing = { ...files, async write(destination: string, value: string) {
			if (destination.endsWith(".previous")) throw new Error("permission revoked");
			return files.write(destination, value);
		} };
		await expect(writeRecoverableBookFile(failing, path, content(2), validate)).rejects.toThrow();
		expect(rows.get(path)).toBe(content(1));
	});
	test("rejects silent truncation and ignores unfinished staging on restore", async () => {
		const { files, rows } = fixture();
		const failing = { ...files, async write(destination: string, value: string) { rows.set(destination, value.slice(0, 3)); } };
		await expect(writeRecoverableBookFile(failing, path, content(1), validate)).rejects.toThrow("verification failed");
		expect(await readRecoverableBookFile(files, path, validate)).toBeNull();
	});
	test("rejects traversal and unknown files", () => {
		for (const invalid of ["../page-12.json", "book-3/pages/../../token", "book-0/manifest.json", "book-3/comments.json", "book-3/pages/page-12.json/extra"])
			expect(() => safeBookRelativePath(invalid)).toThrow();
		expect(safeBookRelativePath(path)).toEqual(["book-3", "pages", "page-12.json"]);
	});
	test("decodes the selected Android/media folder without inventing a filesystem path", () => {
		expect(androidDocumentPath("content://com.android.externalstorage.documents/tree/primary%3AAndroid%2Fmedia%2Fcom.alghurobaa.podcast%2FBooks")).toBe("Android/media/com.alghurobaa.podcast/Books");
		expect(androidDocumentPath("content://com.android.externalstorage.documents/tree/primary%3ABooks/document/primary%3ABooks%2Fbook-3")).toBe("Books/book-3");
		expect(() => androidDocumentPath("file:///sdcard/Books")).toThrow();
		expect(() => androidDocumentPath("content://unknown.provider/tree/Books")).toThrow();
	});
});
