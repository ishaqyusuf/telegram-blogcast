import { getBookImportToken } from "@/lib/book-import-token";

export const trpcFetch: typeof fetch = async (input, init) => {
	const requestUrl =
		typeof input === "string"
			? input
			: input instanceof URL
				? input.href
				: input.url;
	const method =
		init?.method ??
		(typeof input === "string" || input instanceof URL ? "GET" : input.method);
	if (__DEV__) {
		console.log("[tRPC] Requesting", {
			url: requestUrl,
			method,
		});
	}

	let response: Response;
	try {
		const headers = new Headers(
			init?.headers ??
				(typeof input === "string" || input instanceof URL
					? undefined
					: input.headers),
		);
		headers.set("x-book-import-token", await getBookImportToken());
		response = await fetch(input, { ...init, headers });
	} catch (error) {
		console.error("[tRPC] Network request failed before reaching endpoint.", {
			url: requestUrl,
			method,
			error,
		});

		throw new Error(
			`Network request failed for ${requestUrl}. In Expo dev, make sure apps/api is running on the same machine and that the mobile device can reach it over the local network.`,
		);
	}

	const url = requestUrl;
	const contentType = response.headers.get("content-type");
	const shouldInspectBody =
		!response.ok || !contentType || !contentType.includes("json");

	if (!shouldInspectBody) {
		return response;
	}

	const body = await response
		.clone()
		.text()
		.catch(() => "");
	const bodyPreview = body.slice(0, 120).replace(/\s+/g, " ");
	const platformError = response.headers.get("x-vercel-error") ?? "";
	if (
		response.status === 504 ||
		/FUNCTION_INVOCATION_TIMEOUT|FUNCTION_RUNTIME_TIMEOUT/i.test(
			platformError + bodyPreview,
		)
	) {
		throw new Error(
			requestUrl.includes("book.captureShamelaChapters") ||
				requestUrl.includes("bookChapter.capture")
				? "Chapter capture timed out on the server. Your saved page is safe. Use Retry Chapters or View Saved Page."
				: "The server took too long to respond. Please try again.",
		);
	}

	// Proxies can return plain text as well as HTML. Never pass either to tRPC's JSON decoder.
	let isJson = false;
	try {
		const parsed = JSON.parse(body);
		isJson = parsed !== null && typeof parsed === "object";
	} catch {}
	if (!isJson) {
		console.error("[tRPC] Expected JSON but received a non-JSON response.", {
			url,
			status: response.status,
			contentType,
			bodyPreview,
		});

		throw new Error(
			response.status === 413
				? "The captured content is too large for the server. Your previously saved page is unchanged."
				: `The server returned an invalid response (${response.status}). Please try again.`,
		);
	}

	if (!response.ok) {
		console.error("[tRPC] Non-OK response from endpoint.", {
			url,
			status: response.status,
			contentType,
			bodyPreview,
		});
	}

	return response;
};
