import { readFile, rename, writeFile } from "node:fs/promises";
import {
	type FacebookSavedItem,
	canonicalizeFacebookSavedUrl,
	normalizeFacebookSavedItem,
	normalizeFacebookSavedText,
} from "@acme/blog/facebook-saved";
import { db } from "@acme/db";
import { importFacebookSavedItems } from "../../apps/api/src/services/facebook-saved-sync";

type FacebookSavedExport = {
	exportedAt?: string;
	count?: number;
	items: FacebookSavedItem[];
	[key: string]: unknown;
};

type ImportOptions = {
	filePath: string;
	dryRun: boolean;
	limit?: number;
	offset: number;
	batchSize: number;
	recentStopAfter?: number;
};

const DEFAULT_FILE = "exports/facebook-saved.json";

function parseArgs(argv: string[]): ImportOptions {
	const options: ImportOptions = {
		filePath: DEFAULT_FILE,
		dryRun: false,
		offset: 0,
		batchSize: 50,
	};

	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		const next = argv[index + 1];
		if (arg === "--dry-run") {
			options.dryRun = true;
			continue;
		}
		if (arg === "--file" && next) {
			options.filePath = next;
			index += 1;
			continue;
		}
		if (arg === "--limit" && next) {
			options.limit = Number.parseInt(next, 10);
			index += 1;
			continue;
		}
		if (arg === "--offset" && next) {
			options.offset = Number.parseInt(next, 10);
			index += 1;
			continue;
		}
		if (arg === "--batch-size" && next) {
			options.batchSize = Number.parseInt(next, 10);
			index += 1;
			continue;
		}
		if (arg === "--recent-stop-after" && next) {
			options.recentStopAfter = Number.parseInt(next, 10);
			index += 1;
			continue;
		}
		if (!arg.startsWith("--")) options.filePath = arg;
	}

	if (!Number.isInteger(options.offset) || options.offset < 0) {
		throw new Error("--offset must be a non-negative integer.");
	}
	if (
		options.limit != null &&
		(!Number.isInteger(options.limit) || options.limit < 1)
	) {
		throw new Error("--limit must be a positive integer.");
	}
	if (
		!Number.isInteger(options.batchSize) ||
		options.batchSize < 1 ||
		options.batchSize > 100
	) {
		throw new Error("--batch-size must be between 1 and 100.");
	}
	if (
		options.recentStopAfter != null &&
		(!Number.isInteger(options.recentStopAfter) || options.recentStopAfter < 1)
	) {
		throw new Error("--recent-stop-after must be a positive integer.");
	}
	return options;
}

async function writeUpdatedExport(
	filePath: string,
	payload: FacebookSavedExport,
) {
	payload.count = payload.items.length;
	const temporaryPath = `${filePath}.tmp`;
	await writeFile(
		temporaryPath,
		`${JSON.stringify(payload, null, 2)}\n`,
		"utf8",
	);
	await rename(temporaryPath, filePath);
}

async function main() {
	const options = parseArgs(process.argv.slice(2));
	const payload = JSON.parse(
		await readFile(options.filePath, "utf8"),
	) as FacebookSavedExport;
	if (!Array.isArray(payload.items)) {
		throw new Error("Export file must contain an items array.");
	}

	const start = options.offset;
	const end =
		options.limit == null ? payload.items.length : start + options.limit;
	const selected = payload.items.slice(start, end);
	const stats = {
		file: options.filePath,
		dryRun: options.dryRun,
		selected: selected.length,
		imported: 0,
		existing: 0,
		invalid: 0,
		updatedJson: 0,
		stoppedEarly: false,
	};

	if (options.dryRun) {
		for (const [index, rawItem] of selected.entries()) {
			const item = normalizeFacebookSavedItem(rawItem);
			const sourceId = canonicalizeFacebookSavedUrl(item.url || item.link);
			if (!sourceId) stats.invalid += 1;
			console.log(
				JSON.stringify({
					action: "dry-run",
					index: start + index,
					sourceId,
					collection:
						normalizeFacebookSavedText(item.collection) || "Uncategorized",
					title: item.title,
					hasBlogId: Number.isInteger(item.blogId),
				}),
			);
		}
		console.log(JSON.stringify({ action: "complete", ...stats }, null, 2));
		return;
	}

	let existingStreak = 0;
	for (
		let batchStart = 0;
		batchStart < selected.length;
		batchStart += options.batchSize
	) {
		const batch = selected.slice(batchStart, batchStart + options.batchSize);
		const results = await importFacebookSavedItems(db, batch, {
			batchSize: options.batchSize,
		});

		for (const [index, result] of results.entries()) {
			const item = payload.items[start + batchStart + index];
			if (!item) continue;
			if (result.status === "imported") stats.imported += 1;
			if (result.status === "existing") stats.existing += 1;
			if (result.status === "invalid") stats.invalid += 1;
			if (result.blogId != null && item.blogId !== result.blogId) {
				item.blogId = result.blogId;
				stats.updatedJson += 1;
			}
			existingStreak = result.status === "existing" ? existingStreak + 1 : 0;
			if (
				options.recentStopAfter != null &&
				existingStreak >= options.recentStopAfter
			) {
				stats.stoppedEarly = true;
				break;
			}
		}

		await writeUpdatedExport(options.filePath, payload);
		console.log(
			JSON.stringify({
				action: "batch-complete",
				from: start + batchStart,
				to: start + batchStart + batch.length - 1,
				...stats,
			}),
		);
		if (stats.stoppedEarly) break;
	}

	console.log(JSON.stringify({ action: "complete", ...stats }, null, 2));
}

main()
	.catch((error) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(async () => {
		await db.$disconnect();
	});
