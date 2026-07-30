const FACEBOOK_ORIGIN = "https://www.facebook.com";

export function normalizeFacebookSavedText(value) {
	return String(value ?? "")
		.replace(/\s+/g, " ")
		.trim();
}

export function canonicalizeFacebookSavedUrl(value) {
	if (!value) return "";

	try {
		const url = new URL(value, FACEBOOK_ORIGIN);
		url.hash = "";
		if (url.hostname === "facebook.com") url.hostname = "www.facebook.com";

		const reelMatch = url.pathname.match(/^\/reel\/([^/]+)\/?/);
		if (reelMatch) {
			return `${FACEBOOK_ORIGIN}/reel/${reelMatch[1]}/`;
		}

		const videoMatch = url.pathname.match(/\/videos\/([^/]+)\/?/);
		if (videoMatch) {
			return `${FACEBOOK_ORIGIN}/videos/${videoMatch[1]}/`;
		}

		const watchVideoId =
			url.pathname === "/watch/" ? url.searchParams.get("v") : null;
		if (watchVideoId) {
			return `${FACEBOOK_ORIGIN}/watch/?v=${watchVideoId}`;
		}

		const keptParams = new URLSearchParams();
		for (const key of ["id", "story_fbid", "post_id", "comment_id"]) {
			const param = url.searchParams.get(key);
			if (param) keptParams.set(key, param);
		}
		url.search = keptParams.toString();
		return url.toString();
	} catch {
		return normalizeFacebookSavedText(value);
	}
}

export function getFacebookSavedIdentity(value) {
	const canonical = canonicalizeFacebookSavedUrl(value);
	if (!canonical) return "";

	try {
		const url = new URL(canonical);
		const reelMatch = url.pathname.match(/^\/reel\/([^/]+)\/?/);
		if (reelMatch) return `video:${reelMatch[1]}`;

		const videosMatch = url.pathname.match(/\/videos\/([^/]+)\/?/);
		if (videosMatch) return `video:${videosMatch[1]}`;

		const watchId =
			url.pathname === "/watch/" ? url.searchParams.get("v") : null;
		if (watchId) return `video:${watchId}`;

		const storyId =
			url.searchParams.get("story_fbid") ?? url.searchParams.get("post_id");
		const ownerId = url.searchParams.get("id");
		if (storyId) return `post:${ownerId ?? "unknown"}:${storyId}`;

		const postMatch = url.pathname.match(/^\/([^/]+)\/posts\/([^/]+)\/?/);
		if (postMatch) return `post:${postMatch[1]}:${postMatch[2]}`;
	} catch {
		// Fall back to the canonical URL below.
	}

	return `url:${canonical}`;
}

function inferFacebookSavedTitle(caption, sourceTitle = "") {
	const normalizedCaption = normalizeFacebookSavedText(caption);
	if (normalizedCaption) {
		const sentence =
			normalizedCaption
				.split(/(?<=[.!?؟])\s+/u)
				.find((part) => normalizeFacebookSavedText(part)) ?? normalizedCaption;
		const title = normalizeFacebookSavedText(sentence);
		return title.length > 180 ? `${title.slice(0, 177).trim()}...` : title;
	}

	return (
		normalizeFacebookSavedText(sourceTitle)
			.replace(/\s*'s post$/i, "")
			.replace(/,\s*view story$/i, "") || "Facebook saved item"
	);
}

function isFacebookControlCaption(value) {
	const caption = normalizeFacebookSavedText(value);
	if (!caption) return false;
	return (
		/^post\s*[•·]\s*saved\b/i.test(caption) ||
		/\bsaved (to|from)\b.*\badd to collection\b/i.test(caption)
	);
}

export function normalizeFacebookSavedItem(item) {
	const caption = isFacebookControlCaption(item?.caption)
		? ""
		: normalizeFacebookSavedText(item?.caption);
	const sourceTitle = normalizeFacebookSavedText(item?.sourceTitle);
	const url = canonicalizeFacebookSavedUrl(
		item?.url || item?.sourcePostUrl || item?.link,
	);
	const link = canonicalizeFacebookSavedUrl(item?.link);

	return {
		title:
			normalizeFacebookSavedText(item?.title) ||
			inferFacebookSavedTitle(caption, sourceTitle),
		link,
		url: url || link,
		collection: normalizeFacebookSavedText(item?.collection),
		avatar: normalizeFacebookSavedText(item?.avatar),
		caption,
		...(Number.isInteger(item?.blogId) ? { blogId: item.blogId } : {}),
	};
}

function preferText(current, incoming) {
	const left = normalizeFacebookSavedText(current);
	const right = normalizeFacebookSavedText(incoming);
	if (!left) return right;
	if (!right) return left;
	return right.length > left.length ? right : left;
}

function preferSourceUrl(current, incoming) {
	const left = canonicalizeFacebookSavedUrl(current);
	const right = canonicalizeFacebookSavedUrl(incoming);
	if (!left) return right;
	if (!right) return left;
	const leftIdentity = getFacebookSavedIdentity(left);
	const rightIdentity = getFacebookSavedIdentity(right);
	if (leftIdentity !== rightIdentity) return left;
	if (left.includes("/watch/") && !right.includes("/watch/")) return right;
	return left;
}

export function mergeFacebookSavedItems(current, incoming) {
	const left = normalizeFacebookSavedItem(current);
	const right = normalizeFacebookSavedItem(incoming);
	const caption = preferText(left.caption, right.caption);
	const sourceUrl = preferSourceUrl(left.url, right.url);
	const link = preferSourceUrl(left.link, right.link);
	const explicitTitle = preferText(current?.title, incoming?.title);

	return {
		title:
			explicitTitle ||
			inferFacebookSavedTitle(
				caption,
				incoming?.sourceTitle || current?.sourceTitle,
			),
		link,
		url: sourceUrl || link,
		collection: preferText(left.collection, right.collection),
		avatar: preferText(left.avatar, right.avatar),
		caption,
		...(Number.isInteger(left.blogId)
			? { blogId: left.blogId }
			: Number.isInteger(right.blogId)
				? { blogId: right.blogId }
				: {}),
	};
}

export function createFacebookSavedCollector(
	knownIdentities = [],
	options = {},
) {
	return {
		knownIdentities: new Set(knownIdentities),
		observedIdentities: new Set(),
		newRows: new Map(),
		logs: [],
		passes: 0,
		knownCount: 0,
		newCount: 0,
		consecutiveKnownCount: 0,
		noGrowthPasses: 0,
		lastHeight: 0,
		boundaryThreshold: options.boundaryThreshold ?? 20,
		stopAfterNoGrowthPasses: options.stopAfterNoGrowthPasses ?? 8,
		maxPasses: options.maxPasses ?? 250,
	};
}

export function processFacebookSavedSnapshot(
	collector,
	snapshot,
	options = {},
) {
	const boundaryThreshold =
		options.boundaryThreshold ?? collector.boundaryThreshold;
	const stopAfterNoGrowthPasses =
		options.stopAfterNoGrowthPasses ?? collector.stopAfterNoGrowthPasses;
	const maxPasses = options.maxPasses ?? collector.maxPasses;
	const snapshotRows = new Map();

	for (const rawItem of snapshot.rows ?? []) {
		const item = normalizeFacebookSavedItem(rawItem);
		const identity = getFacebookSavedIdentity(item.url || item.link);
		if (!identity) continue;
		const existing = snapshotRows.get(identity);
		snapshotRows.set(
			identity,
			existing ? mergeFacebookSavedItems(existing, item) : item,
		);
	}

	let observedThisPass = 0;
	for (const [identity, item] of snapshotRows) {
		if (collector.observedIdentities.has(identity)) {
			if (collector.newRows.has(identity)) {
				collector.newRows.set(
					identity,
					mergeFacebookSavedItems(collector.newRows.get(identity), item),
				);
			}
			continue;
		}

		collector.observedIdentities.add(identity);
		observedThisPass += 1;
		if (collector.knownIdentities.has(identity)) {
			collector.knownCount += 1;
			collector.consecutiveKnownCount += 1;
		} else {
			collector.newRows.set(identity, item);
			collector.newCount += 1;
			collector.consecutiveKnownCount = 0;
		}
	}

	const height = Number.isFinite(snapshot.height) ? snapshot.height : 0;
	const scrollY = Number.isFinite(snapshot.scrollY) ? snapshot.scrollY : 0;
	const viewportHeight = Number.isFinite(snapshot.viewportHeight)
		? snapshot.viewportHeight
		: 0;
	const atEnd =
		viewportHeight > 0 && scrollY + viewportHeight >= Math.max(0, height - 100);
	if (observedThisPass === 0 && Math.abs(height - collector.lastHeight) < 10) {
		collector.noGrowthPasses += 1;
	} else {
		collector.noGrowthPasses = 0;
	}
	collector.lastHeight = height;
	collector.passes += 1;

	let done = false;
	let complete = false;
	let stopReason = null;
	if (collector.consecutiveKnownCount >= boundaryThreshold) {
		done = true;
		complete = true;
		stopReason = "known_boundary";
	} else if (atEnd && collector.noGrowthPasses >= stopAfterNoGrowthPasses) {
		done = true;
		complete = collector.knownIdentities.size === 0 || collector.knownCount > 0;
		stopReason = complete ? "natural_end" : "no_known_overlap";
	} else if (collector.passes >= maxPasses) {
		done = true;
		complete = false;
		stopReason = "safety_cap";
	}

	const progress = {
		done,
		complete,
		stopReason,
		pass: collector.passes,
		visibleCount: snapshotRows.size,
		scannedCount: collector.observedIdentities.size,
		knownCount: collector.knownCount,
		newCount: collector.newCount,
		consecutiveKnownCount: collector.consecutiveKnownCount,
		noGrowthPasses: collector.noGrowthPasses,
		atEnd,
		height,
	};
	collector.logs.push(progress);
	return progress;
}

export function getFacebookSavedNewItems(collector) {
	return Array.from(collector.newRows.values());
}

export function buildFacebookSavedCapture(
	collector,
	snapshot,
	progress = collector.logs.at(-1),
) {
	if (collector.boundaryThreshold !== 20) {
		throw new Error("Committed Facebook captures require a boundary of 20.");
	}
	const completedAt = new Date().toISOString();
	const complete = Boolean(progress?.complete);
	return {
		exportedAt: completedAt,
		source: {
			type: "facebook-saved",
			url: snapshot?.url ?? "https://www.facebook.com/saved/?cref=28",
			title: snapshot?.title ?? null,
		},
		items: getFacebookSavedNewItems(collector),
		capture: {
			complete,
			stopReason:
				progress?.stopReason ??
				(progress?.done ? "extraction_failed" : "safety_cap"),
			scannedCount: progress?.scannedCount ?? collector.observedIdentities.size,
			knownCount: progress?.knownCount ?? collector.knownCount,
			newCount: progress?.newCount ?? collector.newCount,
			consecutiveKnownCount:
				progress?.consecutiveKnownCount ?? collector.consecutiveKnownCount,
			noGrowthPasses: progress?.noGrowthPasses ?? collector.noGrowthPasses,
			atEnd: Boolean(progress?.atEnd),
			passes: progress?.pass ?? collector.passes,
			boundaryThreshold: collector.boundaryThreshold,
		},
		validation: {
			errors: complete
				? []
				: [`Capture did not complete: ${progress?.stopReason ?? "unknown"}.`],
		},
	};
}

export function mergeFacebookSavedExports(payload, capturedItems) {
	const existingItems = Array.isArray(payload?.items) ? payload.items : [];
	const existingIdentities = new Set();
	for (const item of existingItems) {
		const identity = getFacebookSavedIdentity(item?.url || item?.link);
		if (identity) existingIdentities.add(identity);
	}

	const capturedByIdentity = new Map();
	for (const rawItem of capturedItems ?? []) {
		const item = normalizeFacebookSavedItem(rawItem);
		const identity = getFacebookSavedIdentity(item.url || item.link);
		if (!identity || existingIdentities.has(identity)) continue;
		const current = capturedByIdentity.get(identity);
		capturedByIdentity.set(
			identity,
			current ? mergeFacebookSavedItems(current, item) : item,
		);
	}

	const newItems = Array.from(capturedByIdentity.values());
	return {
		newItems,
		existingCount: existingItems.length,
		payload: {
			...payload,
			exportedAt: new Date().toISOString(),
			count: newItems.length + existingItems.length,
			items: [...newItems, ...existingItems],
		},
	};
}

export function facebookSavedPageSnapshot() {
	const normalize = (value) =>
		String(value || "")
			.replace(/\s+/g, " ")
			.trim();
	const rectOf = (element) => {
		const rect = element.getBoundingClientRect();
		return {
			x: rect.x,
			y: rect.y,
			width: rect.width,
			height: rect.height,
		};
	};
	const isVisible = (element) => {
		const rect = rectOf(element);
		const style = window.getComputedStyle(element);
		return (
			rect.width > 0 &&
			rect.height > 0 &&
			style.visibility !== "hidden" &&
			style.display !== "none"
		);
	};
	const getUrl = (href) => {
		try {
			return new URL(href, window.location.href);
		} catch {
			return null;
		}
	};
	const isFacebookHost = (url) => /(^|\.)facebook\.com$/i.test(url.hostname);
	const isSavedItemHref = (href) => {
		const url = getUrl(href);
		if (!url || !isFacebookHost(url)) return false;
		return Boolean(
			(url.pathname === "/watch/" && url.searchParams.get("v")) ||
				/^\/reel\/[^/]+\/?/.test(url.pathname) ||
				url.pathname.includes("/posts/") ||
				url.pathname.includes("/videos/") ||
				url.searchParams.get("story_fbid") ||
				url.searchParams.get("post_id"),
		);
	};
	const findCard = (anchor) => {
		let fallback = null;
		for (
			let element = anchor;
			element && element !== document.body;
			element = element.parentElement
		) {
			const rect = rectOf(element);
			const text = normalize(element.innerText || element.textContent);
			if (rect.width >= 280 && rect.height >= 70) fallback = element;
			if (
				rect.width >= 280 &&
				rect.height >= 70 &&
				/Saved\s+(to|from)/i.test(text)
			) {
				return element;
			}
		}
		return fallback || anchor.parentElement;
	};
	const cards = new Map();
	for (const anchor of Array.from(document.querySelectorAll("a[href]"))) {
		if (!isVisible(anchor) || !isSavedItemHref(anchor.href)) continue;
		const rect = rectOf(anchor);
		if (rect.y < -250 || rect.y > window.innerHeight + 700) continue;
		const card = findCard(anchor);
		if (!card || !isVisible(card)) continue;
		const cardRect = rectOf(card);
		cards.set(
			`${Math.round(cardRect.x)}:${Math.round(cardRect.y)}:${Math.round(
				cardRect.width,
			)}:${Math.round(cardRect.height)}`,
			card,
		);
	}

	const rows = [];
	for (const card of cards.values()) {
		const anchors = Array.from(card.querySelectorAll("a[href]")).filter(
			isVisible,
		);
		const itemAnchors = anchors.filter((anchor) =>
			isSavedItemHref(anchor.href),
		);
		const primary =
			itemAnchors.find((anchor) => {
				const url = getUrl(anchor.href);
				return (
					url?.pathname === "/watch/" && Boolean(url.searchParams.get("v"))
				);
			}) || itemAnchors[0];
		if (!primary) continue;

		const sourcePost =
			itemAnchors.find((anchor) => {
				const url = getUrl(anchor.href);
				return Boolean(
					url &&
						(/^\/reel\/[^/]+\/?/.test(url.pathname) ||
							url.pathname.includes("/posts/") ||
							url.pathname.includes("/videos/") ||
							url.searchParams.get("story_fbid") ||
							url.searchParams.get("post_id")),
				);
			}) || primary;
		const collectionAnchor = anchors.find((anchor) => {
			const url = getUrl(anchor.href);
			const text = normalize(anchor.innerText || anchor.textContent);
			return Boolean(
				url &&
					url.pathname === "/saved/" &&
					url.searchParams.get("list_id") &&
					text &&
					!text.includes("Only me"),
			);
		});
		const caption =
			itemAnchors
				.map((anchor) => normalize(anchor.innerText || anchor.textContent))
				.filter(
					(text) =>
						text && !/^\d{1,2}:\d{2}$/.test(text) && !/\bpost$/i.test(text),
				)
				.sort((left, right) => right.length - left.length)[0] ||
			normalize(card.innerText || card.textContent);
		const smallImage = Array.from(card.querySelectorAll("img"))
			.filter(isVisible)
			.map((image) => ({
				src: image.currentSrc || image.src || "",
				rect: rectOf(image),
			}))
			.find(
				(image) =>
					image.src &&
					image.rect.width >= 20 &&
					image.rect.height >= 20 &&
					image.rect.width <= 80 &&
					image.rect.height <= 80,
			);

		rows.push({
			link: primary.href,
			url: sourcePost.href || primary.href,
			sourcePostUrl: sourcePost.href || "",
			sourceTitle: normalize(
				sourcePost.innerText ||
					sourcePost.textContent ||
					sourcePost.getAttribute("aria-label") ||
					"",
			),
			collection: normalize(collectionAnchor?.innerText || ""),
			avatar: smallImage?.src || "",
			caption,
		});
	}

	return {
		rows,
		scrollY: window.scrollY,
		viewportHeight: window.innerHeight,
		height: document.documentElement.scrollHeight,
		title: document.title,
		url: window.location.href,
	};
}

export function createFacebookSavedSnapshotScript(delayMs = 0) {
	const run = `
		(function() {
			try {
				var snapshot = (${facebookSavedPageSnapshot.toString()})();
				window.ReactNativeWebView.postMessage(JSON.stringify({
					type: "facebook-saved-snapshot",
					snapshot: snapshot
				}));
			} catch (error) {
				window.ReactNativeWebView.postMessage(JSON.stringify({
					type: "facebook-saved-error",
					error: String(error && error.message ? error.message : error)
				}));
			}
		})();
		true;
	`;
	if (!delayMs) return run;
	return `
		window.scrollBy(0, Math.max(900, Math.round(window.innerHeight * 0.8)));
		setTimeout(function() { ${run} }, ${Math.max(0, delayMs)});
		true;
	`;
}
