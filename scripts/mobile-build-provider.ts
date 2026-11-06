import {
	assertApkUrl,
	parseBuildNumber,
} from "../packages/utils/src/mobile-build";

/** Provider metadata is read for the exact build, never inferred from "latest". */
export function previewBuildMetadata(
	value: unknown,
	expectedCommit: string,
	expectedId: string,
) {
	const object = (input: unknown): Record<string, unknown> =>
		input && typeof input === "object" && !Array.isArray(input)
			? (input as Record<string, unknown>)
			: {};
	const data = object(value);
	const project = object(data.project);
	if (
		!data ||
		!/^[a-f0-9]{40}$/.test(expectedCommit) ||
		!/^[a-f0-9-]{36}$/.test(expectedId) ||
		data.id !== expectedId ||
		data.status !== "FINISHED" ||
		data.platform !== "ANDROID" ||
		data.buildProfile !== "preview" ||
		data.channel !== "preview" ||
		data.distribution !== "INTERNAL" ||
		project.id !== "9d8a8cd8-d310-4724-8a61-db39e6b56c9a" ||
		object(project.ownerAccount).name !== "ishaqyusuf" ||
		data.gitCommitHash !== expectedCommit
	)
		throw new Error("Expected the exact completed Al-Ghurobaa Preview build");
	if (
		typeof data.expirationDate !== "string" ||
		!(Date.parse(data.expirationDate) > Date.now())
	)
		throw new Error("Build artifact expired or expiry is unknown");
	return {
		buildId: expectedId,
		gitCommit: expectedCommit,
		buildNumber: parseBuildNumber(data.appBuildVersion),
		appVersion: data.appVersion,
		runtimeVersion: data.runtimeVersion,
		artifactUrl: assertApkUrl(object(data.artifacts).buildUrl),
		expiresAt: data.expirationDate,
	};
}

export function assertApkIdentity(badging: string, buildNumber: number) {
	const identity = badging.match(
		/^package: name='([^']+)' versionCode='(\d+)'/m,
	);
	if (
		identity?.[1] !== "com.alghurobaa.podcast.preview" ||
		Number(identity?.[2]) !== buildNumber
	)
		throw new Error(
			"Downloaded APK identity does not match the Preview release",
		);
}
