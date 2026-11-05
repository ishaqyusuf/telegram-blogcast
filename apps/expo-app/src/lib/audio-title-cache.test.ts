import { describe, expect, test } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import { patchAudioTitleData, reconcileAudioTitle } from "./audio-title-cache";
import { hasCustomAudioTitle } from "./audio-title";

describe("successful audio renames", () => {
	test("patches full album, every track page, blog detail and feed without changing originals or colliding blog IDs", async () => {
		const client = new QueryClient();
		const media = {
			id: 42,
			title: "Imported title",
			titleOverride: null,
			file: { fileName: "original.mp3" },
		};
		const albumKey = [["album", "getAlbum"], { input: { id: 1 } }];
		const tracksKey = [
			["album", "getAlbumTracks"],
			{ type: "infinite", input: { albumId: 1 } },
		];
		const blogKey = [["blog", "getBlog"], { input: { id: 42 } }];
		const feedKey = [["blog", "posts"], { type: "infinite" }];
		client.setQueryData(albumKey, { id: 1, medias: [media] });
		client.setQueryData(tracksKey, {
			pageParams: [null, 12],
			pages: [
				{ data: [{ ...media, id: 12 }], meta: { cursor: 12 } },
				{ data: [media], meta: { cursor: null } },
			],
		});
		client.setQueryData(blogKey, { id: 42, medias: [media] });
		client.setQueryData(feedKey, {
			pageParams: [null],
			pages: [
				{
					data: [
						{ id: 42, audio: { mediaId: 90, titleOverride: null } },
						{
							id: 99,
							audio: { mediaId: 42, titleOverride: null },
							media: [media],
						},
					],
					meta: { cursor: 2 },
				},
			],
		});
		await reconcileAudioTitle(client, 42, "A custom title");
		expect((client.getQueryData(albumKey) as any).medias[0]).toEqual({
			...media,
			titleOverride: "A custom title",
		});
		const pages = client.getQueryData(tracksKey) as any;
		expect(pages.pages[1].data[0].titleOverride).toBe("A custom title");
		expect(pages.pages[0].data[0].titleOverride).toBeNull();
		expect(pages.pageParams).toEqual([null, 12]);
		const posts = (client.getQueryData(feedKey) as any).pages[0].data;
		expect(posts[0].audio.titleOverride).toBeNull();
		expect(posts[1].audio.titleOverride).toBe("A custom title");
		expect(posts[1].media[0].titleOverride).toBe("A custom title");
		await reconcileAudioTitle(client, 42, null);
		expect(hasCustomAudioTitle(client.getQueryData(blogKey))).toBe(false);
		expect((client.getQueryData(blogKey) as any).medias[0].title).toBe(
			"Imported title",
		);
		client.clear();
	});

	test("cancels an older in-flight fetch before applying the successful rename", async () => {
		const client = new QueryClient();
		const key = [["album", "getAlbum"], { input: { id: 2 } }];
		const old = { medias: [{ id: 42, titleOverride: null }] };
		client.setQueryData(key, old);
		let resolve!: (data: typeof old) => void;
		const pending = client
			.fetchQuery({
				queryKey: key,
				queryFn: () =>
					new Promise<typeof old>((done) => {
						resolve = done;
					}),
			})
			.catch(() => undefined);
		await reconcileAudioTitle(client, 42, "New title");
		resolve(old);
		await pending;
		expect((client.getQueryData(key) as any).medias[0].titleOverride).toBe(
			"New title",
		);
		client.clear();
	});

	test("renames playback queues and search results and treats blank overrides as original titles", () => {
		expect(
			patchAudioTitleData(
				[{ id: 42 }],
				"album.getAlbumPlaybackQueue",
				42,
				"Name",
			)[0].titleOverride,
		).toBe("Name");
		expect(
			patchAudioTitleData(
				{ data: [{ audio: { mediaId: 42 } }] },
				"blog.search",
				42,
				"Name",
			).data[0].audio.titleOverride,
		).toBe("Name");
		expect(hasCustomAudioTitle({ audio: { titleOverride: "  " } })).toBe(false);
		expect(hasCustomAudioTitle({ media: [{ titleOverride: "عنوان" }] })).toBe(
			true,
		);
	});
});
