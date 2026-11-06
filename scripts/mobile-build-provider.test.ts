import { expect, test } from "bun:test";
import {
	assertApkIdentity,
	previewBuildMetadata,
} from "./mobile-build-provider";

const id = "a86d38dd-cbd3-4187-a15f-63ffd70f3f58";
const commit = "a".repeat(40);
const fixture = {
	id,
	status: "FINISHED",
	platform: "ANDROID",
	buildProfile: "preview",
	channel: "preview",
	distribution: "INTERNAL",
	gitCommitHash: commit,
	project: {
		id: "9d8a8cd8-d310-4724-8a61-db39e6b56c9a",
		ownerAccount: { name: "ishaqyusuf" },
	},
	artifacts: { buildUrl: "https://expo.dev/artifacts/eas/example.apk" },
	expirationDate: "2099-11-20T05:27:42.797Z",
	appBuildVersion: "28",
	appVersion: "1.0.112",
	runtimeVersion: "1.0.112",
};
test("registration requires exact completed provider identity and unexpired artifact", () => {
	expect(previewBuildMetadata(fixture, commit, id).buildNumber).toBe(28);
	for (const override of [
		{ status: "IN_PROGRESS" },
		{ id: "different" },
		{ gitCommitHash: "b".repeat(40) },
		{ project: { id: "other" } },
		{ expirationDate: "2020-01-01" },
		{ buildProfile: "production" },
		{ platform: "IOS" },
	])
		expect(() =>
			previewBuildMetadata({ ...fixture, ...override }, commit, id),
		).toThrow();
});
test("downloaded APK must match native package and build number", () => {
	expect(() =>
		assertApkIdentity(
			"package: name='com.alghurobaa.podcast.preview' versionCode='28' versionName='1.0.112'",
			28,
		),
	).not.toThrow();
	expect(() =>
		assertApkIdentity(
			"package: name='com.alghurobaa.podcast' versionCode='28'",
			28,
		),
	).toThrow();
	expect(() =>
		assertApkIdentity(
			"package: name='com.alghurobaa.podcast.preview' versionCode='27'",
			28,
		),
	).toThrow();
});
