import { afterEach, expect, test } from "bun:test";
import {
	canonicalPageUrl,
	createBookPageLoader,
	pageTargetKey,
	type BookPageLoader,
	type PageLoaderAdapter,
} from "./book-page-loader";

const url = "https://shamela.ws/book/23833/110";
const capture = {
	href: url,
	title: "Book",
	html: '<div class="nass">Readable content</div>',
};
const loaders: BookPageLoader[] = [];
afterEach(() => {
	loaders.forEach((loader) => loader.dispose());
	loaders.length = 0;
});
const tick = async () => {
	for (let i = 0; i < 12; i++) await Promise.resolve();
};
function fixture(overrides: Partial<PageLoaderAdapter> = {}) {
	const calls = { stage: 0, promote: 0, prepare: 0 };
	const loader = createBookPageLoader({
		resolve: async (target) => ({ url: target.url ?? url }),
		stage: async () => {
			calls.stage++;
			return 42;
		},
		promote: async () => {
			calls.promote++;
			return { bookId: 3, pageId: 174 };
		},
		prepare: async () => {
			calls.prepare++;
		},
		...overrides,
	});
	loaders.push(loader);
	return { loader, calls };
}

test("canonical source identity rejects other protocols, hosts, roots and credentials", () => {
	expect(canonicalPageUrl(`${url}/?x=1#p`)).toBe(url);
	expect(pageTargetKey({ bookId: 3, url })).toBe(
		pageTargetKey({ bookId: 3, sourcePageNo: 110 }),
	);
	for (const input of [
		"http://shamela.ws/book/1/2",
		"https://evil.test/book/1/2",
		"https://user@shamela.ws/book/1/2",
		"https://shamela.ws/book/1",
		"https://shamela.ws/book/0/2",
	])
		expect(() => canonicalPageUrl(input)).toThrow();
});

test("duplicate captures promote once and only become ready after reader preparation", async () => {
	const { loader, calls } = fixture();
	const key = loader.request({ url });
	await tick();
	const id = loader.getSnapshot().active!.id;
	loader.capture(id, capture);
	loader.capture(id, capture);
	await tick();
	expect(calls).toEqual({ stage: 1, promote: 1, prepare: 1 });
	expect(loader.getSnapshot().jobs[key]?.status).toBe("ready");
});

test("verification keeps the same request and automatically saves on content arrival", async () => {
	const { loader, calls } = fixture();
	loader.request({ url });
	await tick();
	const id = loader.getSnapshot().active!.id;
	loader.verification(id);
	loader.verification(id);
	expect(loader.getSnapshot().active).toMatchObject({
		id,
		status: "verification",
	});
	loader.capture(id, capture);
	await tick();
	expect(calls.promote).toBe(1);
});

test("prefetch cannot display verification and a later reader request resumes it", async () => {
	const { loader } = fixture();
	const key = loader.request({ url }, "prefetch");
	await tick();
	loader.verification(loader.getSnapshot().active!.id);
	expect(loader.getSnapshot().active).toBeNull();
	expect(loader.getSnapshot().jobs[key]?.status).toBe("paused");
	loader.request({ url });
	await tick();
	expect(loader.getSnapshot().active?.status).toBe("loading");
});

test("late capture and resolution cannot overwrite the latest navigation", async () => {
	const { loader, calls } = fixture();
	const key = loader.request({ url });
	await tick();
	const oldId = loader.getSnapshot().active!.id;
	loader.cancel(key);
	loader.request({ url: "https://shamela.ws/book/23833/111" });
	await tick();
	loader.capture(oldId, capture);
	expect(calls.stage).toBe(0);
	expect(loader.getSnapshot().active?.url).toContain("/111");
});

test("save retry reuses staging instead of recapturing HTML", async () => {
	let promotions = 0;
	const { loader, calls } = fixture({
		promote: async () => {
			if (++promotions === 1) throw new Error("Connection lost");
			return { bookId: 3, pageId: 174 };
		},
	});
	const key = loader.request({ url });
	await tick();
	loader.capture(loader.getSnapshot().active!.id, capture);
	await tick();
	expect(loader.getSnapshot().jobs[key]?.stagedParseId).toBe(42);
	loader.retry(key);
	await tick();
	expect(calls.stage).toBe(1);
	expect(promotions).toBe(2);
	expect(loader.getSnapshot().jobs[key]?.status).toBe("ready");
});

test("preparation failure preserves promoted identity for retry", async () => {
	let preparations = 0;
	const { loader, calls } = fixture({
		prepare: async () => {
			if (++preparations === 1) throw new Error("Offline");
		},
	});
	const key = loader.request({ url });
	await tick();
	loader.capture(loader.getSnapshot().active!.id, capture);
	await tick();
	loader.retry(key);
	await tick();
	expect(calls.stage).toBe(1);
	expect(calls.promote).toBe(1);
	expect(loader.getSnapshot().jobs[key]?.status).toBe("ready");
});

test("foreground demand interrupts speculative WebView navigation", async () => {
	const { loader } = fixture();
	loader.request({ url }, "prefetch");
	await tick();
	const key = loader.request({ url: "https://shamela.ws/book/23833/112" });
	await tick();
	expect(loader.getSnapshot().active?.key).toBe(key);
});

test("navigation away during saving completes safely without stealing the next request", async () => {
	let finishStage!: (id: number) => void;
	const { loader } = fixture({
		stage: () =>
			new Promise((resolve) => {
				finishStage = resolve;
			}),
	});
	const key = loader.request({ url });
	await tick();
	loader.capture(loader.getSnapshot().active!.id, capture);
	loader.cancel(key);
	const nextKey = loader.request({ url: "https://shamela.ws/book/23833/111" });
	expect(loader.getSnapshot().active?.status).toBe("saving");
	finishStage(42);
	await tick();
	expect(loader.getSnapshot().jobs[key]?.status).toBe("ready");
	expect(loader.getSnapshot().active?.key).toBe(nextKey);
});

test("prefetch cleanup cannot cancel a page the reader has now requested", async () => {
	const { loader } = fixture();
	const key = loader.request({ url }, "prefetch");
	await tick();
	loader.request({ url });
	loader.cancel(key, true);
	expect(loader.getSnapshot().active?.status).toBe("loading");
});

test("cancelled server resolution cannot revive an obsolete source navigation", async () => {
	let finishResolve!: (value: { url: string }) => void;
	const { loader } = fixture({
		resolve: (target) =>
			target.url === url
				? new Promise((resolve) => {
						finishResolve = resolve;
					})
				: Promise.resolve({ url: target.url }),
	});
	const key = loader.request({ url });
	loader.cancel(key);
	const nextKey = loader.request({ url: "https://shamela.ws/book/23833/111" });
	await tick();
	finishResolve({ url });
	await tick();
	expect(loader.getSnapshot().active?.key).toBe(nextKey);
});

test("background pauses source loading; resume ignores captures from the old document", async () => {
	const { loader, calls } = fixture();
	loader.request({ url });
	await tick();
	const oldId = loader.getSnapshot().active!.id;
	loader.setForeground(false);
	expect(loader.getSnapshot().active).toBeNull();
	loader.setForeground(true);
	await tick();
	loader.capture(oldId, capture);
	expect(calls.stage).toBe(0);
	expect(loader.getSnapshot().active?.id).not.toBe(oldId);
});

test("leaving a page does not restart it on app resume", async () => {
	const { loader } = fixture();
	const key = loader.request({ url });
	await tick();
	loader.cancel(key);
	loader.setForeground(false);
	loader.setForeground(true);
	await tick();
	expect(loader.getSnapshot().active).toBeNull();
});

test("a capture for the wrong page is rejected before staging", async () => {
	const { loader, calls } = fixture();
	const key = loader.request({ url });
	await tick();
	loader.capture(loader.getSnapshot().active!.id, {
		...capture,
		href: "https://shamela.ws/book/23833/111",
	});
	await tick();
	expect(calls.stage).toBe(0);
	expect(loader.getSnapshot().jobs[key]?.status).toBe("error");
});

test("transient source failures retry once then expose recovery", async () => {
	const { loader } = fixture();
	const key = loader.request({ url });
	await tick();
	loader.fail(loader.getSnapshot().active!.id, "Network", true);
	await tick();
	loader.fail(loader.getSnapshot().active!.id, "Network", true);
	expect(loader.getSnapshot().active).toBeNull();
	expect(loader.getSnapshot().jobs[key]?.status).toBe("error");
});
