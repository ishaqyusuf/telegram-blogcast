import { describe, expect, test } from "bun:test";
import { runBookDownload, shouldResumeBookDownload, type BookDownload } from "./book-cache-download";

const job = (): BookDownload => ({
	scope: "user:1", bookId: 3, cursor: 0, completed: 0, chaptersSaved: false, status: "queued", error: null,
	manifest: { bookId: 3, nameAr: null, nameEn: "Book", sourceBookId: 23833, maxPageId: 13, totalPages: 2, revision: "r1" },
});

describe("resumable book downloads", () => {
	test("foreground recovery respects explicit user pauses and failures", () => {
		expect(shouldResumeBookDownload({ status: "running" })).toBe(true);
		expect(shouldResumeBookDownload({ status: "paused", pauseReason: "interrupted" })).toBe(true);
		expect(shouldResumeBookDownload({ status: "paused", pauseReason: "user" })).toBe(false);
		expect(shouldResumeBookDownload({ status: "failed" })).toBe(false);
		expect(shouldResumeBookDownload({ status: "complete" })).toBe(false);
	});
	test("checkpoints pages only after successful saves and completes against the manifest", async () => {
		const events: string[] = [];
		const result = await runBookDownload(job(), {
			saveChapters: async () => { events.push("chapters"); },
			pageIds: async (cursor) => cursor === 0 ? [{ id: 12 }, { id: 13 }] : [],
			savePage: async (id) => { events.push(`save:${id}`); },
			manifest: async () => job().manifest,
			checkpoint: async (value) => { if (value.cursor) events.push(`checkpoint:${value.cursor}`); },
		}, new AbortController().signal);
		expect(result.status).toBe("complete"); expect(result.completed).toBe(2);
		expect(events.indexOf("save:12")).toBeLessThan(events.indexOf("checkpoint:12"));
	});

	test("a failed page keeps the cursor on the last saved page and resumes without duplicates", async () => {
		const saved: number[] = [];
		const base = {
			saveChapters: async () => {}, pageIds: async (cursor: number) => [12, 13].filter((id) => id > cursor).map((id) => ({ id })),
			manifest: async () => job().manifest, checkpoint: async () => {},
		};
		const failed = await runBookDownload(job(), { ...base, savePage: async (id) => { if (id === 13) throw new Error("timeout"); saved.push(id); } }, new AbortController().signal);
		expect(failed.status).toBe("failed"); expect(failed.cursor).toBe(12);
		const resumed = await runBookDownload(failed, { ...base, savePage: async (id) => { saved.push(id); } }, new AbortController().signal);
		expect(resumed.status).toBe("complete"); expect(saved).toEqual([12, 13]);
	});

	test("cancellation keeps saved pages and leaves resumable status", async () => {
		const controller = new AbortController();
		const result = await runBookDownload(job(), {
			saveChapters: async () => {}, pageIds: async () => [{ id: 12 }, { id: 13 }],
			savePage: async () => { controller.abort(); }, manifest: async () => job().manifest, checkpoint: async () => {},
		}, controller.signal);
		expect(result.status).toBe("paused"); expect(result.completed).toBe(1); expect(result.cursor).toBe(12);
	});

	test("changed books, missing pages, and invalid cursors cannot report success", async () => {
		for (const ids of [[], [{ id: 14 }], [{ id: 0 }]]) {
			const result = await runBookDownload(job(), { saveChapters: async () => {}, pageIds: async () => ids, savePage: async () => {}, manifest: async () => ({ ...job().manifest, revision: "r2" }), checkpoint: async () => {} }, new AbortController().signal);
			expect(result.status).toBe("failed");
		}
	});

	for (const boundary of ["chapters", "manifest"] as const) {
		test(`a user pause during ${boundary} cannot report completion`, async () => {
			const controller = new AbortController();
			const statuses: string[] = [];
			let manifestCalls = 0;
			const ready = { ...job(), cursor: 13, completed: 2 };
			const result = await runBookDownload(ready, {
				pageIds: async () => [], savePage: async () => {},
				saveChapters: async () => { if (boundary === "chapters") controller.abort("user"); },
				manifest: async () => { manifestCalls++; if (boundary === "manifest") controller.abort("user"); return ready.manifest; },
				checkpoint: async (value) => { statuses.push(value.status); },
			}, controller.signal);
			expect(result).toMatchObject({ status: "paused", pauseReason: "user", completed: 2, chaptersSaved: true, error: null });
			expect(statuses).not.toContain("complete");
			expect(manifestCalls).toBe(boundary === "chapters" ? 0 : 1);
		});
	}
});
