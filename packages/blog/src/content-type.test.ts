import { describe, expect, test } from "bun:test";
import { inferBlogMediaContentType } from "./content-type";

describe("blog media content type", () => {
	test("classifies supported MIME types and PDF filenames", () => {
		expect(inferBlogMediaContentType({ mimeType: "audio/mpeg" })).toBe("audio");
		expect(inferBlogMediaContentType({ mimeType: "image/jpeg" })).toBe("image");
		expect(inferBlogMediaContentType({ mimeType: "video/mp4" })).toBe("video");
		expect(
			inferBlogMediaContentType({
				mimeType: "application/octet-stream",
				file: { fileName: "notes.PDF" },
			}),
		).toBe("pdf");
	});

	test("falls back to text for missing and unsupported media", () => {
		expect(inferBlogMediaContentType(null)).toBe("text");
		expect(inferBlogMediaContentType({ mimeType: "application/msword" })).toBe(
			"text",
		);
	});
});
