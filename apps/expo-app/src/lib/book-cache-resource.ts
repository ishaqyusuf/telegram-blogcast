export async function withBookCacheDeadline<T>(fetch: (signal: AbortSignal) => Promise<T>, signal: AbortSignal, timeoutMs = 20_000): Promise<T> {
	const controller = new AbortController();
	let cancel = () => {};
	let timer: ReturnType<typeof setTimeout> | undefined;
	try {
		return await new Promise<T>((resolve, reject) => {
			cancel = () => {
				const error = new Error("The book request was cancelled.");
				error.name = "AbortError";
				reject(error);
				controller.abort();
			};
			signal.addEventListener("abort", cancel, { once: true });
			if (signal.aborted) { cancel(); return; }
			timer = setTimeout(() => {
				reject(new Error("The request took too long. Any previously saved content remains available; retry when connected."));
				controller.abort();
			}, timeoutMs);
			fetch(controller.signal).then(resolve, reject);
		});
	} finally { clearTimeout(timer); signal.removeEventListener("abort", cancel); }
}

export async function loadBookCacheResource<T>(options: {
	read: () => Promise<T | null>;
	fetch: () => Promise<T>;
	save: (value: T, observedAt: number) => Promise<void>;
	shouldRefresh: (local: T | null) => boolean;
	onValue: (value: T, source: "local" | "remote") => void;
	onError: (error: Error, hasContent: boolean) => void;
	onCacheError: (error: Error) => void;
	signal: AbortSignal;
}) {
	const asError = (error: unknown) => error instanceof Error ? error : new Error(String(error));
	let local: T | null = null;
	try { local = await options.read(); }
	catch (error) { if (!options.signal.aborted) options.onCacheError(asError(error)); }
	if (options.signal.aborted) return;
	if (local !== null) options.onValue(local, "local");
	if (!options.shouldRefresh(local)) {
		if (local === null) options.onError(new Error("This content is not downloaded. Connect to the internet and retry."), false);
		return;
	}
	const observedAt = Date.now();
	try {
		const remote = await options.fetch();
		if (options.signal.aborted) return;
		options.onValue(remote, "remote");
		try { await options.save(remote, observedAt); }
		catch (error) { if (!options.signal.aborted) options.onCacheError(asError(error)); }
	} catch (error) {
		if (!options.signal.aborted) options.onError(asError(error), local !== null);
	}
}
