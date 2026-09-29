import { describe, expect, test } from "bun:test";
import {
	getAudioDetailPreview,
	rememberAudioDetailFromMedia,
	rememberAudioDetailFromPost,
} from "./audio-detail-preview";

describe("audio detail preview", () => {
	test("opens with feed metadata and the matching media file", () => {
		rememberAudioDetailFromPost({
			id: 101,
			type: "audio",
			caption: "A lesson",
			date: new Date("2026-09-29T12:00:00.000Z"),
			audio: { mediaId: 33, title: "Lesson 1", fileName: "lesson.mp3", duration: 120, size: 2048 },
			media: [{ id: 33, file: { fileName: "lesson.mp3", fileSize: 2048, duration: 120 } }],
			channel: { id: 9, title: "Lessons" },
			tags: ["Arabic"],
		} as any);
		const detail = getAudioDetailPreview(101);
		expect(detail?.content).toBe("A lesson");
		expect(detail?.channel?.title).toBe("Lessons");
		expect(detail?.medias[0]?.file?.fileName).toBe("lesson.mp3");
		expect(detail?.medias[0]?.id).toBe(33);
	});

	test("opens with album or history metadata", () => {
		rememberAudioDetailFromMedia({
			id: 44,
			blog: { id: 102, content: "Another lesson", channelId: 9 },
			file: { fileName: "second.mp3", fileSize: 4096 },
		}, { id: 7, name: "Series", channelId: 9 });
		const detail = getAudioDetailPreview(102);
		expect(detail?.medias[0]?.album?.name).toBe("Series");
		expect(detail?.medias[0]?.file?.fileName).toBe("second.mp3");
	});
});
