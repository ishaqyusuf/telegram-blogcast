import { expect, test } from "bun:test";
import type { Database, Prisma } from "@acme/db";

import { albumRoutes } from "./album.routes";

function createSuggestionCaller(albumChannelId: number | null) {
	let candidateQuery: Prisma.MediaFindManyArgs | undefined;
	const caller = albumRoutes.createCaller({
		db: {
			album: {
				findFirstOrThrow: async () => ({
					id: 7,
					name: "Lectures",
					channelId: albumChannelId,
					medias: [],
				}),
			},
			media: {
				findMany: async (input: Prisma.MediaFindManyArgs) => {
					candidateQuery = input;
					return [
						{
							id: 99,
							title: "Lecture one",
							mimeType: "audio/mpeg",
							file: { fileName: "lecture-one.mp3" },
							blog: {
								id: 12,
								content: "Lecture one",
								type: "audio",
								blogDate: null,
								telegramMessageId: 55,
								channelId: 42,
								channel: {
									id: 42,
									title: "Knowledge Channel",
									username: "knowledge",
								},
							},
						},
					];
				},
			},
		} as unknown as Database,
	});

	return { caller, getCandidateQuery: () => candidateQuery };
}

test("empty albums can scope suggestions to the selected channel", async () => {
	const { caller, getCandidateQuery } = createSuggestionCaller(null);

	const result = await caller.getSuggestedMedia({
		albumId: 7,
		channelId: 42,
		keyword: "lecture",
	});

	expect(getCandidateQuery()?.where?.AND?.[0]).toEqual({
		blog: {
			is: {
				deletedAt: null,
				type: "audio",
				channelId: 42,
			},
		},
	});
	expect(result[0]?.blog?.channel).toEqual({
		id: 42,
		title: "Knowledge Channel",
		username: "knowledge",
	});
});

test("an album's established channel remains authoritative", async () => {
	const { caller, getCandidateQuery } = createSuggestionCaller(17);

	await caller.getSuggestedMedia({
		albumId: 7,
		channelId: 42,
		keyword: "lecture",
	});

	expect(getCandidateQuery()?.where?.AND?.[0]).toMatchObject({
		blog: { is: { channelId: 17 } },
	});
});
