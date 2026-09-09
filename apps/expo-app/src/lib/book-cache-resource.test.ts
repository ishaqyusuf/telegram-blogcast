import { describe, expect, test } from "bun:test";
import { loadBookCacheResource, withBookCacheDeadline } from "./book-cache-resource";

describe("local-first book resources", () => {
	test("a local read finishing after an account change cannot publish or refresh", async () => {
		const controller = new AbortController();
		let finish!: (value: string) => void;
		const read = new Promise<string>((resolve) => { finish = resolve; });
		const actions: string[] = [];
		const loading = loadBookCacheResource({
			read: () => read,
			fetch: async () => { actions.push("fetch"); return "remote"; },
			save: async () => { actions.push("save"); },
			shouldRefresh: () => true,
			onValue: (value) => { actions.push(value); },
			onError: () => { actions.push("error"); },
			onCacheError: () => { actions.push("cache-error"); },
			signal: controller.signal,
		});
		controller.abort();
		finish("previous-account-page");
		await loading;
		expect(actions).toEqual([]);
	});
	test("a local read failure after cancellation cannot leak stale errors into the new screen", async () => {
		const controller = new AbortController();
		const actions: string[] = [];
		await loadBookCacheResource({
			read: async () => { controller.abort(); throw new Error("previous-account read failed"); },
			fetch: async () => { actions.push("fetch"); return "remote"; },
			save: async () => { actions.push("save"); },
			shouldRefresh: () => true,
			onValue: () => { actions.push("value"); },
			onError: () => { actions.push("error"); },
			onCacheError: () => { actions.push("cache-error"); },
			signal: controller.signal,
		});
		expect(actions).toEqual([]);
	});
	test("cancellation settles even when transport ignores abort", async () => {
		const controller = new AbortController();
		const result = withBookCacheDeadline(() => new Promise(() => {}), controller.signal, 1000).then(() => "resolved", (error: Error) => error.name);
		controller.abort();
		expect(await Promise.race([result, new Promise((resolve) => setTimeout(() => resolve("still waiting"), 20))])).toBe("AbortError");
	});
	test("already cancelled requests never start transport", async () => {
		const controller = new AbortController(); controller.abort();
		let calls = 0;
		await expect(withBookCacheDeadline(async () => { calls++; return "late"; }, controller.signal)).rejects.toMatchObject({ name: "AbortError" });
		expect(calls).toBe(0);
	});
	test("bounds a stalled refresh and aborts its transport", async () => {
		let signal: AbortSignal | undefined;
		await expect(withBookCacheDeadline((requestSignal) => { signal = requestSignal; return new Promise(() => {}); }, new AbortController().signal, 5)).rejects.toThrow("took too long");
		expect(signal?.aborted).toBe(true);
	});
	test("publishes SQLite content before a delayed network refresh", async () => {
		const values: string[] = [];
		let resolve!: (value: string) => void;
		const network = new Promise<string>((done) => { resolve = done; });
		const loading = loadBookCacheResource({
			read: async () => "local", fetch: () => network, save: async () => {},
			shouldRefresh: () => true, onValue: (v) => values.push(v), onError: () => {}, onCacheError: () => {}, signal: new AbortController().signal,
		});
		await new Promise((done) => setTimeout(done, 0));
		expect(values).toEqual(["local"]);
		resolve("remote"); await loading;
		expect(values).toEqual(["local", "remote"]);
	});

	test("offline hits never call the server and misses report a download hint", async () => {
		for (const local of ["saved", null]) {
			let error: string | null = null;
			let data: string | null = null;
			await loadBookCacheResource({ read: async () => local, fetch: async () => { throw new Error("must not call"); }, save: async () => {}, shouldRefresh: () => false, onValue: (v) => { data = v; }, onError: (e) => { error = e.message; }, onCacheError: () => {}, signal: new AbortController().signal });
			expect(data).toBe(local);
			if (local) expect(error).toBeNull(); else expect(error).toContain("not downloaded");
		}
	});

	test("network or storage failures do not hide readable content", async () => {
		const values: string[] = [];
		let hasContent = false;
		await loadBookCacheResource({ read: async () => "local", fetch: async () => { throw new Error("offline"); }, save: async () => {}, shouldRefresh: () => true, onValue: (v) => values.push(v), onError: (_, cached) => { hasContent = cached; }, onCacheError: () => {}, signal: new AbortController().signal });
		expect(values).toEqual(["local"]); expect(hasContent).toBe(true);
		let cacheError = "";
		await loadBookCacheResource({ read: async () => null, fetch: async () => "remote", save: async () => { throw new Error("disk full"); }, shouldRefresh: () => true, onValue: (v) => values.push(v), onError: () => {}, onCacheError: (e) => { cacheError = e.message; }, signal: new AbortController().signal });
		expect(values).toEqual(["local", "remote"]); expect(cacheError).toBe("disk full");
	});

	test("cancelled requests never publish or persist a late response", async () => {
		const controller = new AbortController();
		const values: string[] = [];
		let saves = 0;
		await loadBookCacheResource({ read: async () => "local", fetch: async () => { controller.abort(); return "late"; }, save: async () => { saves++; }, shouldRefresh: () => true, onValue: (v) => values.push(v), onError: () => {}, onCacheError: () => {}, signal: controller.signal });
		expect(values).toEqual(["local"]); expect(saves).toBe(0);
	});
});
