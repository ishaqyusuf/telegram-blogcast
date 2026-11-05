import { describe, expect, test } from "bun:test";
import { getAlbumVisibleTracks, getPlayerAlbumFocus } from "./player-album";

describe("preloaded player album", () => {
	const tracks = Array.from({ length: 80 }, (_, i) => ({ id: i + 1 }));
	test("reveals a playing track beyond the first page and ignores other albums", () => {
		expect(getPlayerAlbumFocus(tracks, 2, 70)).toBe(70);
		expect(getPlayerAlbumFocus(tracks, 2, 999)).toBe(2);
		expect(getPlayerAlbumFocus(tracks, 2)).toBe(2);
	});
	test("full-screen handoff uses all cached tracks without waiting for pagination", () => {
		expect(
			getAlbumVisibleTracks({
				localTracks: null,
				albumTracks: tracks,
				paginatedTracks: tracks.slice(0, 30),
				search: "",
			}),
		).toBe(tracks);
	});
	test("keeps search results, empty albums and local reordering authoritative", () => {
		const search = [tracks[69]];
		expect(
			getAlbumVisibleTracks({
				localTracks: null,
				albumTracks: tracks,
				paginatedTracks: search,
				search: "lesson",
			}),
		).toBe(search);
		expect(
			getAlbumVisibleTracks({
				localTracks: null,
				albumTracks: [],
				paginatedTracks: tracks,
				search: "",
			}),
		).toEqual([]);
		expect(
			getAlbumVisibleTracks({
				localTracks: search,
				albumTracks: tracks,
				paginatedTracks: tracks,
				search: "",
			}),
		).toBe(search);
	});
});
