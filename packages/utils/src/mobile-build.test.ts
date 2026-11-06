import { describe, expect, test } from "bun:test";
import {
	MOBILE_BUILD_SCOPE,
	offeredMobileBuild,
	parseMobileBuild,
	parsePublishedMobileBuild,
} from "./mobile-build";

const fixture = {
	...MOBILE_BUILD_SCOPE,
	buildId: "a86d38dd-cbd3-4187-a15f-63ffd70f3f58",
	buildNumber: 28,
	appVersion: "1.0.112",
	runtimeVersion: "1.0.112",
	gitCommit: "a".repeat(40),
	artifactUrl: "https://expo.dev/artifacts/eas/example.apk",
	sha256: "b".repeat(64),
	sizeBytes: 1234,
	expiresAt: "2099-11-20T05:27:42.797Z",
	notes: "Preview",
	revision: 1,
	active: true,
	publishedAt: "2026-11-06T05:00:00.000Z",
};
describe("Preview APK offers", () => {
	test("only offers a newer active native build in the exact application/channel", () => {
		const build = parsePublishedMobileBuild(fixture);
		const installed = { ...MOBILE_BUILD_SCOPE, buildNumber: 27 };
		expect(offeredMobileBuild(build, installed)).toEqual(build);
		for (const override of [
			{ channel: "production" },
			{ applicationId: "com.alghurobaa.podcast" },
			{ platform: "ios" },
			{ buildNumber: 28 },
			{ buildNumber: 29 },
		])
			expect(
				offeredMobileBuild(build, { ...installed, ...override }),
			).toBeNull();
		expect(
			offeredMobileBuild({ ...build, active: false }, installed),
		).toBeNull();
		expect(
			offeredMobileBuild(build, installed, Date.parse(build.expiresAt)),
		).toBeNull();
	});
	test("rejects malformed or untrusted release data", () => {
		for (const override of [
			{ artifactUrl: "http://expo.dev/artifacts/eas/test.apk" },
			{ artifactUrl: "https://evil.test/a.apk" },
			{ artifactUrl: "https://expo.dev@evil.test/a.apk" },
			{ artifactUrl: "https://expo.dev/artifacts/eas/a.apk?token=secret" },
			{ buildNumber: 0 },
			{ buildNumber: 2.5 },
			{ sizeBytes: 0 },
			{ sizeBytes: 1e12 },
			{ sha256: "bad" },
			{ expiresAt: "bad" },
			{ channel: "production" },
		])
			expect(() => parseMobileBuild({ ...fixture, ...override })).toThrow();
	});
});
