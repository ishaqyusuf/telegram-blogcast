import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Database } from "@acme/db";
import {
	getFacebookSavedSyncState,
	syncFacebookSavedCapture,
} from "./facebook-saved-sync";

const temporaryDirectories: string[] = [];

async function createCanonicalExport() {
	const directory = await mkdtemp(join(tmpdir(), "facebook-saved-sync-"));
	temporaryDirectories.push(directory);
	const filePath = join(directory, "facebook-saved.json");
	await writeFile(
		filePath,
		`${JSON.stringify(
			{
				exportedAt: "2026-06-29T08:13:46.226Z",
				source: {
					type: "facebook-saved",
					url: "https://www.facebook.com/saved/?cref=28",
					title: "Saved",
				},
				count: 1,
				items: [
					{
						title: "Existing",
						url: "https://www.facebook.com/reel/1/",
						blogId: 41,
					},
				],
				validation: { errors: [] },
			},
			null,
			2,
		)}\n`,
		"utf8",
	);
	return filePath;
}

function createFakeDatabase() {
	let nextBlogId = 100;
	const blogs = new Map([
		[
			"https://www.facebook.com/reel/1/",
			{ id: 41, sourceId: "https://www.facebook.com/reel/1/" },
		],
	]);
	const tags = new Map<string, number>();

	const tx = {
		blog: {
			findMany: async ({
				where,
			}: {
				where?: { sourceId?: { in?: string[] } };
			}) => {
				const ids: string[] = where?.sourceId?.in ?? [];
				return ids.flatMap((sourceId) => {
					const blog = blogs.get(sourceId);
					return blog ? [blog] : [];
				});
			},
			createMany: async ({
				data,
			}: {
				data: Array<{ sourceId: string }>;
			}) => {
				for (const item of data) {
					if (!blogs.has(item.sourceId)) {
						blogs.set(item.sourceId, {
							id: nextBlogId++,
							sourceId: item.sourceId,
						});
					}
				}
				return { count: data.length };
			},
		},
		channel: {
			upsert: async () => ({ id: 7 }),
		},
		tags: {
			createMany: async ({
				data,
			}: {
				data: Array<{ title: string }>;
			}) => {
				for (const item of data) {
					if (!tags.has(item.title)) tags.set(item.title, tags.size + 1);
				}
				return { count: data.length };
			},
			findMany: async ({
				where,
			}: {
				where?: { title?: { in?: string[] } };
			}) =>
				(where?.title?.in ?? []).map((title: string) => ({
					id: tags.get(title),
					title,
				})),
		},
		blogTags: {
			createMany: async () => ({ count: 0 }),
		},
	};

	return {
		blogs,
		asDatabase: () =>
			({
				$transaction: async (operation: (value: typeof tx) => unknown) =>
					operation(tx),
			}) as unknown as Database,
		$transaction: async (operation: (value: typeof tx) => unknown) =>
			operation(tx),
	};
}

afterEach(async () => {
	const { rm } = await import("node:fs/promises");
	await Promise.all(
		temporaryDirectories
			.splice(0)
			.map((directory) => rm(directory, { recursive: true, force: true })),
	);
});

describe("Facebook saved sync service", () => {
	test("returns stable identities for the mobile collector", async () => {
		const canonicalFilePath = await createCanonicalExport();
		const state = await getFacebookSavedSyncState({ canonicalFilePath });

		expect(state.count).toBe(1);
		expect(state.knownIdentities).toEqual(["video:1"]);
	});

	test("imports and prepends new posts, then becomes idempotent", async () => {
		const canonicalFilePath = await createCanonicalExport();
		const database = createFakeDatabase();
		const capture = {
			exportedAt: "2026-07-30T10:00:00.000Z",
			source: {
				type: "facebook-saved" as const,
				url: "https://www.facebook.com/saved/?cref=28",
				title: "Saved",
			},
			items: [
				{
					title: "New",
					url: "https://www.facebook.com/watch/?ref=saved&v=2",
					collection: "Benefits",
					caption: "A useful caption",
				},
			],
			capture: {
				complete: true,
				stopReason: "known_boundary" as const,
				scannedCount: 21,
				knownCount: 20,
				newCount: 1,
				consecutiveKnownCount: 20,
				noGrowthPasses: 0,
				atEnd: false,
				passes: 4,
				boundaryThreshold: 20 as const,
			},
			validation: { errors: [] },
		};

		const first = await syncFacebookSavedCapture(database.asDatabase(), {
			canonicalFilePath,
			capture,
		});
		expect(first.imported).toBe(1);
		expect(first.jsonUpdated).toBe(true);

		const saved = JSON.parse(await readFile(canonicalFilePath, "utf8")) as {
			items: Array<{ title?: string; blogId?: number }>;
		};
		expect(saved.items.map((item) => item.title)).toEqual(["New", "Existing"]);
		expect(saved.items.at(0)?.blogId).toBe(100);
		expect(saved.items.at(1)?.blogId).toBe(41);

		const second = await syncFacebookSavedCapture(database.asDatabase(), {
			canonicalFilePath,
			capture,
		});
		expect(second.imported).toBe(0);
		expect(second.capturedNew).toBe(0);
		expect(second.jsonUpdated).toBe(false);
		expect(database.blogs.size).toBe(2);
	});

	test("rejects incomplete captures without changing the export", async () => {
		const canonicalFilePath = await createCanonicalExport();
		const before = await readFile(canonicalFilePath, "utf8");

		await expect(
			syncFacebookSavedCapture(createFakeDatabase().asDatabase(), {
				canonicalFilePath,
				capture: {
					exportedAt: "2026-07-30T10:00:00.000Z",
					source: {
						type: "facebook-saved",
						url: "https://www.facebook.com/saved/?cref=28",
						title: "Saved",
					},
					items: [],
					capture: {
						complete: false,
						stopReason: "safety_cap",
						scannedCount: 500,
						knownCount: 0,
						newCount: 500,
						consecutiveKnownCount: 0,
						noGrowthPasses: 0,
						atEnd: false,
						passes: 250,
						boundaryThreshold: 20,
					},
					validation: { errors: [] },
				},
			}),
		).rejects.toThrow("incomplete");

		expect(await readFile(canonicalFilePath, "utf8")).toBe(before);
	});

	test("rejects a forged known boundary", async () => {
		const canonicalFilePath = await createCanonicalExport();

		await expect(
			syncFacebookSavedCapture(createFakeDatabase().asDatabase(), {
				canonicalFilePath,
				capture: {
					exportedAt: "2026-07-30T10:00:00.000Z",
					source: {
						type: "facebook-saved",
						url: "https://www.facebook.com/saved/?cref=28",
						title: "Saved",
					},
					items: [],
					capture: {
						complete: true,
						stopReason: "known_boundary",
						scannedCount: 0,
						knownCount: 0,
						newCount: 0,
						consecutiveKnownCount: 0,
						noGrowthPasses: 0,
						atEnd: false,
						passes: 1,
						boundaryThreshold: 20,
					},
					validation: { errors: [] },
				},
			}),
		).rejects.toThrow("verified known-post boundary");
	});

	test("rejects a natural end without overlap with an existing export", async () => {
		const canonicalFilePath = await createCanonicalExport();

		await expect(
			syncFacebookSavedCapture(createFakeDatabase().asDatabase(), {
				canonicalFilePath,
				capture: {
					exportedAt: "2026-07-30T10:00:00.000Z",
					source: {
						type: "facebook-saved",
						url: "https://www.facebook.com/saved/?cref=28",
						title: "Saved",
					},
					items: [],
					capture: {
						complete: true,
						stopReason: "natural_end",
						scannedCount: 0,
						knownCount: 0,
						newCount: 0,
						consecutiveKnownCount: 0,
						noGrowthPasses: 8,
						atEnd: true,
						passes: 9,
						boundaryThreshold: 20,
					},
					validation: { errors: [] },
				},
			}),
		).rejects.toThrow("without overlapping");
	});

	test("rejects URL-less and off-domain capture items", async () => {
		const canonicalFilePath = await createCanonicalExport();
		const invalidItems = [
			{ title: "Missing URL" },
			{ title: "Wrong host", url: "https://example.com/post/2" },
		];

		for (const item of invalidItems) {
			await expect(
				syncFacebookSavedCapture(createFakeDatabase().asDatabase(), {
					canonicalFilePath,
					capture: {
						exportedAt: "2026-07-30T10:00:00.000Z",
						source: {
							type: "facebook-saved",
							url: "https://www.facebook.com/saved/?cref=28",
							title: "Saved",
						},
						items: [item],
						capture: {
							complete: true,
							stopReason: "known_boundary",
							scannedCount: 21,
							knownCount: 20,
							newCount: 1,
							consecutiveKnownCount: 20,
							noGrowthPasses: 0,
							atEnd: false,
							passes: 4,
							boundaryThreshold: 20,
						},
						validation: { errors: [] },
					},
				}),
			).rejects.toThrow();
		}
	});
});
