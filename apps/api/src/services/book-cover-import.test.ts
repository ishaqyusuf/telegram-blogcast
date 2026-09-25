import { describe, expect, test } from "bun:test";
import {
	hasMatchingImageSignature,
	importBookCoverFromUrl,
	isPublicImageAddress,
	validateCoverSourceUrl,
} from "./book-cover-import";

describe("book cover URL guard", () => {
	test("rejects local and reserved network addresses", () => {
		for (const address of [
			"127.0.0.1",
			"10.0.0.3",
			"169.254.169.254",
			"192.168.1.4",
			"::1",
			"fd00::1",
			"::ffff:127.0.0.1",
			"::ffff:7f00:1",
		]) {
			expect(isPublicImageAddress(address)).toBe(false);
		}
		expect(isPublicImageAddress("8.8.8.8")).toBe(true);
		expect(isPublicImageAddress("2606:4700:4700::1111")).toBe(true);
	});
	test("copies a validated image to Blob and blocks a redirect to a private host", async () => {
		const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]);
		let uploadedPath = "";
		const dependencies = {
			storageToken: "test-token",
			resolve: async () => [{ address: "8.8.8.8", family: 4 }],
			fetchImage: async () =>
				new Response(png, { headers: { "content-type": "image/png" } }),
			upload: async (pathname: string, bytes: Buffer) => {
				uploadedPath = pathname;
				expect(bytes).toEqual(png);
				return { url: `https://blob.example/${pathname}` };
			},
		};
		const url = await importBookCoverFromUrl(
			42,
			"https://example.com/cover.png",
			dependencies,
		);
		expect(uploadedPath).toMatch(/^book-covers\/42\/.+\.png$/);
		expect(url).toBe(`https://blob.example/${uploadedPath}`);
		await expect(
			importBookCoverFromUrl(42, "https://example.com/cover.png", {
				...dependencies,
				fetchImage: async () =>
					new Response(null, {
						status: 302,
						headers: { location: "https://localhost/private.png" },
					}),
			}),
		).rejects.toThrow("public HTTPS");
	});
	test("checks the downloaded bytes against the declared image type", () => {
		expect(
			hasMatchingImageSignature(
				Buffer.from([0xff, 0xd8, 0xff, 0x00]),
				"image/jpeg",
			),
		).toBe(true);
		expect(hasMatchingImageSignature(Buffer.from("<html>"), "image/jpeg")).toBe(
			false,
		);
		expect(hasMatchingImageSignature(Buffer.from("GIF89a"), "image/gif")).toBe(
			true,
		);
	});
	test("requires HTTPS and public DNS results", async () => {
		await expect(
			validateCoverSourceUrl("http://example.com/cover.jpg"),
		).rejects.toThrow();
		await expect(
			validateCoverSourceUrl("https://localhost/cover.jpg"),
		).rejects.toThrow();
		await expect(
			validateCoverSourceUrl("https://example.com/cover.jpg", async () => [
				{ address: "127.0.0.1", family: 4 },
			]),
		).rejects.toThrow();
		await expect(
			validateCoverSourceUrl("https://example.com/cover.jpg", async () => [
				{ address: "8.8.8.8", family: 4 },
			]),
		).resolves.toBeInstanceOf(URL);
	});
});
