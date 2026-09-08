/** Foreground page acquisition. The only source transport is the mounted WebView. */
export type PageTarget = {
	url?: string;
	bookId?: number;
	sourcePageNo?: number;
};
export type PageResult = { bookId: number; pageId: number };
export type PageLoadStatus =
	| "queued"
	| "resolving"
	| "loading"
	| "verification"
	| "saving"
	| "ready"
	| "error"
	| "paused";
export type PageLoad = {
	key: string;
	target: PageTarget;
	url?: string;
	id: number;
	status: PageLoadStatus;
	priority: "reader" | "prefetch";
	error?: string;
	result?: PageResult;
	stagedParseId?: number;
	attempts: number;
	showSource?: boolean;
};
export type PageCapture = { href: string; title: string; html: string };
export type PageLoaderAdapter = {
	resolve: (
		target: PageTarget,
		signal: AbortSignal,
	) => Promise<{ result?: PageResult; url?: string }>;
	stage: (
		load: PageLoad,
		capture: PageCapture,
		signal: AbortSignal,
	) => Promise<number>;
	promote: (
		load: PageLoad,
		stagedParseId: number,
		signal: AbortSignal,
	) => Promise<PageResult>;
	prepare: (result: PageResult, signal: AbortSignal) => Promise<void>;
};

export function canonicalPageUrl(value: string) {
	const url = new URL(value, "https://shamela.ws");
	if (
		url.protocol !== "https:" ||
		url.hostname !== "shamela.ws" ||
		url.port ||
		url.username ||
		url.password ||
		!/^\/book\/[1-9]\d*\/[1-9]\d*\/?$/.test(url.pathname)
	) {
		throw new Error(
			"Use a Shamela page link, such as shamela.ws/book/23833/106.",
		);
	}
	return `https://shamela.ws${url.pathname.replace(/\/$/, "")}`;
}

export function pageTargetKey(target: PageTarget) {
	if (
		target.bookId != null &&
		(!Number.isSafeInteger(target.bookId) || target.bookId < 1)
	)
		throw new Error("Invalid book.");
	const url = target.url ? canonicalPageUrl(target.url) : undefined;
	const pageNo = url ? Number(url.split("/").at(-1)) : target.sourcePageNo;
	if (!Number.isSafeInteger(pageNo) || pageNo! < 1 || (!url && !target.bookId))
		throw new Error("No page link is available.");
	return target.bookId ? `book:${target.bookId}:${pageNo}` : url!;
}

export function createBookPageLoader(adapter: PageLoaderAdapter) {
	const jobs = new Map<string, PageLoad>();
	const listeners = new Set<() => void>();
	let active: string | null = null;
	let sequence = 0;
	let foreground = true;
	let timer: ReturnType<typeof setTimeout> | undefined;
	let abort: AbortController | undefined;
	let disposed = false;
	let snapshot = {
		active: null as PageLoad | null,
		jobs: {} as Record<string, PageLoad>,
	};
	const emit = () => {
		snapshot = {
			active: active ? (jobs.get(active) ?? null) : null,
			jobs: Object.fromEntries(jobs),
		};
		listeners.forEach((listener) => listener());
	};
	const patch = (key: string, values: Partial<PageLoad>) => {
		const job = jobs.get(key);
		if (job) jobs.set(key, { ...job, ...values });
		emit();
	};
	const valid = (id: number) =>
		!disposed && !!active && jobs.get(active)?.id === id;
	const release = () => {
		clearTimeout(timer);
		abort?.abort();
		abort = undefined;
		active = null;
	};
	const fail = (id: number, message: string, transient = false) => {
		if (!valid(id)) return;
		const job = jobs.get(active!)!;
		release();
		const retry = transient && job.attempts < 2 && job.priority === "reader";
		patch(job.key, {
			status: retry ? "queued" : "error",
			error: retry ? undefined : message,
		});
		pump();
	};
	const deadline = (
		id: number,
		message: string,
		ms = 30_000,
		transient = false,
	) => {
		clearTimeout(timer);
		timer = setTimeout(() => fail(id, message, transient), ms);
	};
	const complete = async (
		job: PageLoad,
		result: PageResult,
		signal: AbortSignal,
	) => {
		// Keep the result even if preparation fails, so Retry never repeats a completed import.
		if (!valid(job.id)) return;
		patch(job.key, { result });
		await adapter.prepare(result, signal);
		if (!valid(job.id)) return;
		release();
		patch(job.key, { status: "ready", result, error: undefined });
		pump();
	};
	const save = async (job: PageLoad, capture?: PageCapture) => {
		if (!valid(job.id)) return;
		patch(job.key, { status: "saving", error: undefined });
		deadline(
			job.id,
			"Saving took too long. Retry to check whether the page was saved.",
			60_000,
		);
		const signal = abort!.signal;
		try {
			const staged =
				job.stagedParseId ?? (await adapter.stage(job, capture!, signal));
			if (!valid(job.id)) return;
			patch(job.key, { stagedParseId: staged });
			const result = await adapter.promote(job, staged, signal);
			await complete(job, result, signal);
		} catch (error) {
			fail(
				job.id,
				error instanceof Error
					? error.message
					: "Unable to save this page. Please retry.",
			);
		}
	};
	async function start(job: PageLoad) {
		const next = {
			...job,
			id: ++sequence,
			attempts: job.attempts + 1,
			status: "resolving" as const,
		};
		active = job.key;
		abort = new AbortController();
		const signal = abort.signal;
		patch(job.key, next);
		deadline(
			next.id,
			"Could not load this page. Check your connection and retry.",
		);
		try {
			if (next.result) return await complete(next, next.result, signal);
			if (next.stagedParseId) return await save(next);
			const resolved = await adapter.resolve(next.target, signal);
			if (!valid(next.id)) return;
			if (resolved.result) return await complete(next, resolved.result, signal);
			const url = canonicalPageUrl(resolved.url ?? next.target.url ?? "");
			patch(job.key, { url, status: "loading" });
			deadline(
				next.id,
				"This page is taking too long. Retry or open the source to check it.",
				30_000,
				true,
			);
		} catch (error) {
			fail(
				next.id,
				error instanceof Error ? error.message : "Unable to open this page.",
			);
		}
	}
	function pump() {
		if (disposed || active || !foreground) return;
		const queued = [...jobs.values()].filter((job) => job.status === "queued");
		const job = queued.find((item) => item.priority === "reader") ?? queued[0];
		if (job) void start(job);
	}
	return {
		subscribe: (listener: () => void) => {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
		getSnapshot: () => snapshot,
		request(target: PageTarget, priority: PageLoad["priority"] = "reader") {
			const key = pageTargetKey(target);
			const existing = jobs.get(key);
			// A user request interrupts speculative navigation, never an in-flight server save.
			const running = active ? jobs.get(active) : undefined;
			if (
				priority === "reader" &&
				running &&
				running.key !== key &&
				running.priority === "prefetch" &&
				running.status !== "saving"
			) {
				release();
				jobs.delete(running.key);
			}
			if (existing) {
				patch(key, {
					priority: existing.priority === "reader" ? "reader" : priority,
					...(foreground &&
					(existing.status === "paused" ||
						(existing.status === "error" &&
							existing.priority === "prefetch" &&
							priority === "reader"))
						? { status: "queued" as const, error: undefined, attempts: 0 }
						: {}),
				});
			} else {
				if (
					priority === "prefetch" &&
					[...jobs.values()].some(
						(job) =>
							job.priority === "prefetch" &&
							["queued", "loading", "resolving", "saving"].includes(job.status),
					)
				)
					return key;
				// Bound session metadata. Full reader content is owned by React Query.
				if (jobs.size >= 24) {
					const oldest = [...jobs.values()].find(
						(job) =>
							["ready", "error", "paused"].includes(job.status) &&
							job.key !== active,
					);
					if (oldest) jobs.delete(oldest.key);
				}
				jobs.set(key, {
					key,
					target,
					priority,
					status: foreground ? "queued" : "paused",
					id: 0,
					attempts: 0,
				});
				emit();
			}
			pump();
			return key;
		},
		cancel(key: string, onlyPrefetch = false) {
			const job = jobs.get(key);
			if (!job || ["ready", "error"].includes(job.status)) return;
			if (onlyPrefetch && job.priority !== "prefetch") return;
			if (active === key && job.status === "saving") {
				patch(key, { priority: "prefetch" });
				return;
			}
			if (active === key) release();
			patch(key, { status: "paused", priority: "prefetch" });
			pump();
		},
		retry(key: string) {
			const job = jobs.get(key);
			if (!job || (active === key && job.status === "saving")) return;
			if (active === key) release();
			patch(key, {
				status: "queued",
				attempts: 0,
				error: undefined,
				priority: "reader",
			});
			pump();
		},
		showSource(key: string) {
			const job = jobs.get(key);
			if (!job || job.status === "saving") return;
			if (active === key) {
				patch(key, { showSource: true });
			} else {
				patch(key, {
					showSource: true,
					status: "queued",
					attempts: 0,
					priority: "reader",
					error: undefined,
				});
				pump();
			}
		},
		verification(id: number) {
			if (!valid(id)) return;
			const job = jobs.get(active!)!;
			if (!["loading", "verification"].includes(job.status)) return;
			if (job.priority === "prefetch") {
				release();
				patch(job.key, { status: "paused" });
				pump();
			} else {
				if (job.status !== "verification") {
					deadline(
						id,
						"Verification timed out. Retry when you are ready.",
						5 * 60_000,
					);
					patch(job.key, { status: "verification" });
				}
			}
		},
		capture(id: number, capture: PageCapture) {
			if (!valid(id)) return;
			const job = jobs.get(active!)!;
			if (!["loading", "verification"].includes(job.status)) return;
			try {
				if (canonicalPageUrl(capture.href) !== job.url)
					throw new Error("The source opened a different page. Please retry.");
				if (!capture.html || capture.html.length > 4_000_000)
					throw new Error("The page capture is empty or too large.");
				void save(job, capture);
			} catch (error) {
				fail(id, (error as Error).message);
			}
		},
		fail,
		setForeground(value: boolean) {
			foreground = value;
			const job = active ? jobs.get(active) : undefined;
			if (!value && job && job.status !== "saving") {
				release();
				patch(job.key, { status: "paused" });
			}
			if (value) {
				for (const paused of jobs.values())
					if (paused.status === "paused" && paused.priority === "reader")
						patch(paused.key, { status: "queued" });
				pump();
			}
		},
		dispose() {
			disposed = true;
			release();
			listeners.clear();
		},
	};
}
export type BookPageLoader = ReturnType<typeof createBookPageLoader>;
