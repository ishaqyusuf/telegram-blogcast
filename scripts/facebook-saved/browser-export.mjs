import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
	buildFacebookSavedCapture,
	facebookSavedPageSnapshot,
	processFacebookSavedSnapshot,
} from "../../packages/blog/src/facebook-saved.mjs";

export async function collectVisibleSavedItems(tab) {
	return await tab.playwright.evaluate(facebookSavedPageSnapshot, undefined, {
		timeoutMs: 12_000,
	});
}

function getPageBlockReason(snapshot) {
	const url = String(snapshot?.url || "");
	const title = String(snapshot?.title || "");
	if (/log in|login/i.test(title)) return "authentication_required";

	try {
		const parsed = new URL(url);
		const isFacebook =
			parsed.hostname === "facebook.com" ||
			parsed.hostname.endsWith(".facebook.com");
		if (!isFacebook || !parsed.pathname.startsWith("/saved")) {
			return "unexpected_page";
		}
	} catch {
		return "unexpected_page";
	}
	return null;
}

export async function collectBatch(tab, collector, options = {}) {
	const passes = options.passes ?? 8;
	const waitMs = options.waitMs ?? 900;

	for (let index = 0; index < passes; index += 1) {
		const snapshot = await collectVisibleSavedItems(tab);
		const blockReason = getPageBlockReason(snapshot);
		if (blockReason) {
			return {
				done: true,
				complete: false,
				stopReason: blockReason,
				snapshot,
				progress: {
					done: true,
					complete: false,
					stopReason: blockReason,
					pass: collector.passes,
					visibleCount: 0,
					scannedCount: collector.observedIdentities.size,
					knownCount: collector.knownCount,
					newCount: collector.newCount,
					consecutiveKnownCount: collector.consecutiveKnownCount,
					height: Number(snapshot?.height) || 0,
				},
			};
		}

		const progress = processFacebookSavedSnapshot(collector, snapshot, options);
		if (progress.done) {
			return {
				done: true,
				complete: progress.complete,
				stopReason: progress.stopReason,
				snapshot,
				progress,
			};
		}

		await tab.cua.scroll({
			x: 900,
			y: 700,
			scrollY: 1350,
			scrollX: 0,
		});
		await tab.playwright.waitForTimeout(waitMs);
	}

	const snapshot = await collectVisibleSavedItems(tab);
	const progress = processFacebookSavedSnapshot(collector, snapshot, options);
	return {
		done: progress.done,
		complete: progress.complete,
		stopReason: progress.stopReason,
		snapshot,
		progress,
	};
}

export async function writeFacebookSavedExport(
	collector,
	snapshot,
	outputPath,
	progress = collector.logs.at(-1),
) {
	const payload = buildFacebookSavedCapture(collector, snapshot, progress);

	await mkdir(dirname(outputPath), { recursive: true });
	await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
	return { path: outputPath, payload };
}
