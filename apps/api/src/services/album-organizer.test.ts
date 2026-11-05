import { expect, test } from "bun:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { type Database, type Prisma, db } from "@acme/db";
import {
	continueOrganizerDiscovery,
	readOrganizerState,
	startOrganizerDiscovery,
} from "./album-organizer";
import {
	approveOrganizerReview,
	saveOrganizerReview,
} from "./album-organizer-review";

test("legacy runs have a safe empty review state", () => {
	expect(readOrganizerState(null).scan).toBeNull();
	expect(readOrganizerState({ chunks: [{ mediaIds: [1, 2] }] }).review).toEqual(
		{ currentSuggestionId: null, drafts: {}, targets: {} },
	);
});

// Opt in to the real SQL contract check. All fixtures and approvals are rolled back.
// Nested service transactions use savepoints inside that outer rollback boundary.
test.skipIf(process.env.ALBUM_ORGANIZER_DB_TEST !== "1")(
	"channel discovery and review survive retry, resume and destination changes",
	async () => {
		const rollback = new Error("ROLLBACK_ORGANIZER_FIXTURES");
		let assertionsCompleted = false;
		await expect(
			db.$transaction(
				async (tx) => {
					let savepoint = 0;
					const isolated = new Proxy(tx, {
						get(target, key) {
							if (key !== "$transaction") return Reflect.get(target, key);
							return async (
								work: (client: Prisma.TransactionClient) => Promise<unknown>,
							) => {
								const name = `organizer_test_${++savepoint}`;
								await tx.$executeRawUnsafe(`SAVEPOINT ${name}`);
								try {
									const result = await work(tx);
									await tx.$executeRawUnsafe(`RELEASE SAVEPOINT ${name}`);
									return result;
								} catch (error) {
									await tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${name}`);
									throw error;
								}
							};
						},
					}) as unknown as Database;
					const channel = await tx.channel.create({
						data: {
							username: `organizer-test-${randomUUID()}`,
							title: "Organizer rollback fixture",
						},
					});
					const lateMedia = await tx.media.create({
						data: {
							mimeType: "audio/mpeg",
							title: "Late imported old recording",
						},
					});
					const blog = await tx.blog.create({
						data: {
							channelId: channel.id,
							type: "audio",
							blogDate: new Date("2026-11-01"),
							medias: {
								createMany: {
									data: Array.from({ length: 52 }, (_, index) => ({
										mimeType: "audio/mpeg",
										title: `Track ${index + 1}`,
									})),
								},
							},
						},
					});
					const media = await tx.media.findMany({
						where: { blogId: blog.id },
						orderBy: { id: "asc" },
					});
					const started = await startOrganizerDiscovery(isolated, {
						channelId: channel.id,
						provider: "deepseek",
					});
					const duplicate = await startOrganizerDiscovery(isolated, {
						channelId: channel.id,
						provider: "openai",
					});
					expect(duplicate.id).toBe(started.id);
					await expect(
						continueOrganizerDiscovery(isolated, started.id, async () => {
							throw new Error("provider interrupted");
						}),
					).rejects.toThrow("provider interrupted");
					const failed = await tx.albumAutoIndexRun.findUniqueOrThrow({
						where: { id: started.id },
					});
					expect(readOrganizerState(failed.inputJson).scan?.afterId).toBe(0);
					let requests = 0;
					const provider: Parameters<typeof continueOrganizerDiscovery>[2] =
						async (snapshot) => {
							requests++;
							expect(snapshot.albums).toEqual([]);
							return {
								provider: "deepseek",
								model: "fixture",
								text: "",
								inputTokens: null,
								outputTokens: null,
								rawResponse: { fixture: true },
								parsedResponse: {
									proposedAlbums: [
										{
											name: "Series A",
											mediaIds: snapshot.media
												.slice(0, 2)
												.map((item) => item.id),
										},
										{
											name: "Series B",
											mediaIds: snapshot.media
												.slice(2, -1)
												.map((item) => item.id),
										},
									],
								},
							};
						};
					let releaseProvider: () => void = () => {};
					let providerEntered: () => void = () => {};
					const gate = new Promise<void>((resolve) => {
						releaseProvider = resolve;
					});
					const entered = new Promise<void>((resolve) => {
						providerEntered = resolve;
					});
					const inFlight = continueOrganizerDiscovery(
						isolated,
						started.id,
						async (snapshot) => {
							providerEntered();
							await gate;
							return provider(snapshot);
						},
					);
					await entered;
					let duplicateRequests = 0;
					const busy = await continueOrganizerDiscovery(
						isolated,
						started.id,
						async (snapshot) => {
							duplicateRequests++;
							return provider(snapshot);
						},
					);
					expect(busy.scan?.lease).not.toBeNull();
					expect(duplicateRequests).toBe(0);
					releaseProvider();
					const first = await inFlight;
					expect(first.mediaCount).toBe(50);
					expect(first.scan?.complete).toBe(false);
					const finished = await continueOrganizerDiscovery(
						isolated,
						started.id,
						provider,
					);
					expect(finished.scan?.complete).toBe(true);
					expect(finished.mediaCount).toBe(52);
					expect(requests).toBe(2);
					await continueOrganizerDiscovery(isolated, started.id, provider);
					expect(requests).toBe(2);
					const suggestions = await tx.albumAutoIndexAlbumSuggestion.findMany({
						where: { runId: started.id },
						orderBy: { id: "asc" },
						include: { mediaSuggestions: true },
					});
					expect(suggestions.length).toBe(2);
					const suggestion = suggestions[0];
					assert(suggestion);
					const second = suggestions[1];
					assert(second);
					const selectedRow = suggestion.mediaSuggestions[0];
					assert(selectedRow);
					const draft = {
						selectedIds: [selectedRow.id],
						targetAlbumId: null,
						name: "Edited series",
					};
					await saveOrganizerReview(isolated, {
						runId: started.id,
						suggestionId: suggestion.id,
						draft,
					});
					const saved = await tx.albumAutoIndexRun.findUniqueOrThrow({
						where: { id: started.id },
					});
					expect(
						readOrganizerState(saved.inputJson).review.drafts[
							String(suggestion.id)
						],
					).toEqual(draft);

					await tx.albumAutoIndexMediaSuggestion.update({
						where: { id: selectedRow.id },
						data: { mediaId: -1 },
					});
					await expect(
						approveOrganizerReview(isolated, {
							runId: started.id,
							suggestionId: suggestion.id,
							draft,
						}),
					).rejects.toThrow("Media not found");
					expect(
						await tx.album.count({ where: { channelId: channel.id } }),
					).toBe(0);
					await tx.albumAutoIndexMediaSuggestion.update({
						where: { id: selectedRow.id },
						data: { mediaId: selectedRow.mediaId },
					});
					const approved = await approveOrganizerReview(isolated, {
						runId: started.id,
						suggestionId: suggestion.id,
						draft,
					});
					expect(approved.added).toBe(1);
					await saveOrganizerReview(isolated, {
						runId: started.id,
						suggestionId: suggestion.id,
						draft,
					});
					const afterLateSave = await tx.albumAutoIndexRun.findUniqueOrThrow({
						where: { id: started.id },
					});
					expect(
						readOrganizerState(afterLateSave.inputJson).review
							.currentSuggestionId,
					).toBe(second.id);
					expect(
						await tx.media.count({
							where: { blogId: blog.id, albumId: approved.albumId },
						}),
					).toBe(1);
					const retried = await approveOrganizerReview(isolated, {
						runId: started.id,
						suggestionId: suggestion.id,
						draft,
					});
					expect(retried.albumId).toBe(approved.albumId);
					expect(retried.added).toBe(0);
					expect(
						await tx.album.count({ where: { channelId: channel.id } }),
					).toBe(1);
					// Two suggested groups can be approved into one chosen album despite the legacy unique key.

					await approveOrganizerReview(isolated, {
						runId: started.id,
						suggestionId: second.id,
						draft: {
							selectedIds: second.mediaSuggestions.map((item) => item.id),
							targetAlbumId: approved.albumId,
							name: "Edited series",
						},
					});
					const completed = await tx.albumAutoIndexRun.findUniqueOrThrow({
						where: { id: started.id },
					});
					expect(completed.status).toBe("approved");
					expect(
						readOrganizerState(completed.inputJson).review.targets[
							String(second.id)
						],
					).toBe(approved.albumId);
					const noNewAudio = await startOrganizerDiscovery(isolated, {
						channelId: channel.id,
						provider: "deepseek",
					});
					expect(noNewAudio.scan?.complete).toBe(true);
					expect(noNewAudio.id).toBe(finished.id);
					await tx.media.update({
						where: { id: lateMedia.id },
						data: { blogId: blog.id },
					});
					const incremental = await startOrganizerDiscovery(isolated, {
						channelId: channel.id,
						provider: "deepseek",
					});
					expect(incremental.scan?.afterId).toBe(0);
					expect(incremental.scan?.legacyIds).toContain(media.at(0)?.id);
					expect(incremental.scan?.complete).toBe(false);
					const next = await continueOrganizerDiscovery(
						isolated,
						incremental.id,
						async (snapshot) => {
							expect(snapshot.media.length).toBe(1);
							expect(snapshot.media[0]?.id).toBe(lateMedia.id);
							expect(snapshot.albums.map((album) => album.name)).toContain(
								"Edited series",
							);
							return {
								provider: "deepseek",
								model: "fixture",
								text: "",
								inputTokens: null,
								outputTokens: null,
								rawResponse: {},
								parsedResponse: { albums: [] },
							};
						},
					);
					expect(next.scan?.unassignedIds.length).toBe(1);
					expect(media.length).toBe(52);
					assertionsCompleted = true;
					throw rollback;
				},
				{ timeout: 120000 },
			),
		).rejects.toBe(rollback);
		expect(assertionsCompleted).toBe(true);
	},
	125000,
);
