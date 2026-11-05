import { expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { db, type Database, type Prisma } from "@acme/db";
import {
	albumSearchInput,
	albumSearchWhere,
} from "../../queries/album-discovery";
import { albumRoutes } from "./album.routes";
import { blogRoutes } from "./blog.routes";
import { addAlbumMedia } from "../../services/album-membership";

test("album discovery bounds input and separates home-channel groups", () => {
	expect(albumSearchInput.safeParse({ limit: 201 }).success).toBe(false);
	expect(albumSearchInput.safeParse({ q: "x".repeat(501) }).success).toBe(
		false,
	);
	expect(
		albumSearchWhere(albumSearchInput.parse({ group: "same", channelIds: [] })),
	).toMatchObject({ channelId: { in: [] } });
	expect(
		albumSearchWhere(
			albumSearchInput.parse({ group: "other", channelIds: [4, 4] }),
		),
	).toMatchObject({ OR: [{ channelId: null }, { channelId: { notIn: [4] } }] });
});

test("lean paging performs no count queries", async () => {
	let countCalls = 0;
	const caller = blogRoutes.createCaller({
		db: {
			blog: {
				findMany: async () => [],
				count: async () => {
					countCalls++;
					return 0;
				},
			},
		} as unknown as Database,
	});
	const page = await caller.search({ q: "term", includeCounts: false });
	expect(countCalls).toBe(0);
	expect(page.meta.allCount).toBeNull();
	await caller.searchFacets({ q: "term" });
	expect(countCalls).toBeGreaterThan(0);
});

// All fixtures, SQL writes and nested mutations run inside a forced rollback.
// Opt in against a configured test/representative database; no persistent data.
test.skipIf(process.env.AUDIO_SEARCH_DB_TEST !== "1")(
	"audio filters, paging and manual membership remain consistent in SQL",
	async () => {
		const rollback = new Error("ROLLBACK_AUDIO_SEARCH_FIXTURES");
		let completed = false;
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
								const name = `audio_search_${++savepoint}`;
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
					const token = `audio-search-${randomUUID()}`;
					const a = await tx.channel.create({
						data: { username: `${token}-a` },
					});
					const b = await tx.channel.create({
						data: { username: `${token}-b` },
					});
					const albumA = await tx.album.create({
						data: { name: `${token}-album`, channelId: a.id },
					});
					const albumB = await tx.album.create({
						data: { name: `${token}-other`, channelId: b.id },
					});
					const source = await tx.blog.create({
						data: {
							type: "audio",
							content: token,
							channelId: a.id,
							blogDate: new Date("2026-01-01"),
							medias: {
								create: [
									{ mimeType: "image/jpeg", albumId: albumA.id },
									{ mimeType: "audio/mpeg" },
								],
							},
						},
						include: { medias: true },
					});
					const first = source.medias.find((media) =>
						media.mimeType.startsWith("audio/"),
					)!;
					const second = await tx.media.create({
						data: {
							mimeType: "audio/mpeg",
							blog: {
								create: {
									type: "audio",
									channelId: b.id,
									content: token,
									blogDate: new Date("2026-01-01"),
								},
							},
						},
					});
					const third = await tx.media.create({
						data: {
							mimeType: "audio/mpeg",
							blog: {
								create: {
									type: "audio",
									channelId: a.id,
									content: token,
									blogDate: null,
								},
							},
						},
					});
					const search = blogRoutes.createCaller({ db: isolated });
					const albums = albumRoutes.createCaller({ db: isolated });
					const input = {
						q: token,
						type: "audio" as const,
						includeCounts: false,
						limit: 1,
					};
					const ids: number[] = [];
					let cursor: number | undefined;
					for (let i = 0; i < 4; i++) {
						const page = await search.search({ ...input, cursor });
						ids.push(...page.data.map((post) => post.id));
						if (!page.meta.cursor) break;
						cursor = page.meta.cursor;
					}
					expect(new Set(ids).size).toBe(3);
					expect(ids).toHaveLength(3);
					expect(
						(await search.search({ ...input, limit: 20, album: "in" })).data,
					).toHaveLength(0);
					const unalbumed = await search.search({
						...input,
						limit: 20,
						album: "not",
						channelIds: [a.id],
					});
					expect(unalbumed.data).toHaveLength(2);
					expect(
						unalbumed.data
							.find((post) => post.id === source.id)
							?.medias.map((media) => media.id),
					).toEqual([first.id]);
					const expectedMembership = [{ mediaId: first.id, albumId: null }];
					await expect(
						albums.addMediaToAlbum({
							albumId: albumB.id,
							mediaIds: [first.id],
							expectedMembership,
						}),
					).rejects.toThrow("original channel");
					expect(
						(await tx.media.findUniqueOrThrow({ where: { id: first.id } }))
							.albumId,
					).toBeNull();
					await albums.addMediaToAlbum({
						albumId: albumB.id,
						mediaIds: [first.id],
						expectedMembership,
						confirmCrossChannel: true,
					});
					expect(
						(await tx.blog.findUniqueOrThrow({ where: { id: source.id } }))
							.channelId,
					).toBe(a.id);
					expect(
						(await tx.album.findUniqueOrThrow({ where: { id: albumB.id } }))
							.channelId,
					).toBe(b.id);
					await albums.addMediaToAlbum({
						albumId: albumB.id,
						mediaIds: [first.id],
						expectedMembership,
						confirmCrossChannel: true,
					});
					expect(
						await tx.albumAudioIndex.count({ where: { albumId: albumB.id } }),
					).toBe(1);
					await expect(
						albums.addMediaToAlbum({
							albumId: albumA.id,
							mediaIds: [first.id],
							expectedMembership,
						}),
					).rejects.toThrow("membership changed");
					await expect(
						addAlbumMedia(
							tx,
							{ albumId: albumB.id, mediaIds: [third.id] },
							{ channelId: a.id, unalbumedOnly: true },
						),
					).rejects.toThrow("original channel");
					await expect(
						albums.createAlbumWithMedia({
							name: `${token}-failed`,
							mediaIds: [first.id, second.id],
						}),
					).rejects.toThrow("one channel");
					expect(
						await tx.album.count({ where: { name: `${token}-failed` } }),
					).toBe(0);
					await albums.removeMembership({
						expectedMembership: [{ mediaId: first.id, albumId: albumB.id }],
					});
					expect(
						(await tx.media.findUniqueOrThrow({ where: { id: first.id } }))
							.albumId,
					).toBeNull();
					expect(
						(await tx.blog.findUniqueOrThrow({ where: { id: source.id } }))
							.deletedAt,
					).toBeNull();
					expect(
						await tx.albumAudioIndex.count({ where: { albumId: albumB.id } }),
					).toBe(0);
					const created = await albums.createAlbumWithMedia({
						name: `${token}-mixed`,
						mediaIds: [first.id, second.id],
						confirmCrossChannel: true,
					});
					expect(await tx.media.count({ where: { albumId: created.id } })).toBe(
						2,
					);
					completed = true;
					throw rollback;
				},
				{ timeout: 90_000 },
			),
		).rejects.toBe(rollback);
		expect(completed).toBe(true);
	},
	100_000,
);
