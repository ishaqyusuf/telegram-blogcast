/** Adapted from EwaTrade's app-update contract; Preview APK delivery only. */
export const MOBILE_BUILD_KEY = "mobile.android.preview.v1";
export const MOBILE_BUILD_SCOPE = {
	applicationId: "com.alghurobaa.podcast.preview",
	platform: "android",
	channel: "preview",
} as const;
export const MAX_APK_BYTES = 512 * 1024 * 1024;
export type MobileBuild = typeof MOBILE_BUILD_SCOPE & {
	buildId: string;
	buildNumber: number;
	appVersion: string;
	runtimeVersion: string;
	gitCommit: string;
	artifactUrl: string;
	sha256: string;
	sizeBytes: number;
	expiresAt: string;
	notes: string;
};
export type PublishedMobileBuild = MobileBuild & {
	revision: number;
	active: boolean;
	publishedAt: string;
};
export function parseBuildNumber(value: unknown): number {
	if (!/^[1-9]\d{0,9}$/.test(String(value)))
		throw new Error("Invalid build number");
	const number = Number(value);
	if (!Number.isSafeInteger(number) || number > 2100000000)
		throw new Error("Invalid build number");
	return number;
}
function record(value: unknown): Record<string, unknown> {
	if (!value || typeof value !== "object" || Array.isArray(value))
		throw new Error("Invalid build record");
	return value as Record<string, unknown>;
}
function text(value: unknown, pattern: RegExp, label: string): string {
	if (typeof value !== "string" || !pattern.test(value))
		throw new Error(`Invalid ${label}`);
	return value;
}
export function assertApkUrl(value: unknown): string {
	const url = new URL(text(value, /^.{1,2048}$/, "APK URL"));
	if (
		url.protocol !== "https:" ||
		url.hostname !== "expo.dev" ||
		url.port ||
		url.username ||
		url.password ||
		url.search ||
		url.hash ||
		!/^\/artifacts\/eas\/[A-Za-z0-9_-]+\.apk$/.test(url.pathname)
	)
		throw new Error("Expected a direct Expo APK URL");
	return url.href;
}
export function parseMobileBuild(value: unknown): MobileBuild {
	const data = record(value);
	for (const [key, expected] of Object.entries(MOBILE_BUILD_SCOPE))
		if (data[key] !== expected) throw new Error("Unsupported build scope");
	if (
		!Number.isSafeInteger(data.sizeBytes) ||
		Number(data.sizeBytes) < 1 ||
		Number(data.sizeBytes) > MAX_APK_BYTES
	)
		throw new Error("Invalid APK size");
	if (
		typeof data.expiresAt !== "string" ||
		!Number.isFinite(Date.parse(data.expiresAt))
	)
		throw new Error("Invalid artifact expiry");
	if (typeof data.notes !== "string" || data.notes.length > 1000)
		throw new Error("Invalid release notes");
	return {
		...MOBILE_BUILD_SCOPE,
		buildId: text(data.buildId, /^[a-f0-9-]{36}$/, "build ID"),
		buildNumber: parseBuildNumber(data.buildNumber),
		appVersion: text(data.appVersion, /^[\w.+-]{1,80}$/, "app version"),
		runtimeVersion: text(data.runtimeVersion, /^[\w.+-]{1,80}$/, "runtime"),
		gitCommit: text(data.gitCommit, /^[a-f0-9]{40}$/, "source revision"),
		artifactUrl: assertApkUrl(data.artifactUrl),
		sha256: text(data.sha256, /^[a-f0-9]{64}$/, "APK checksum"),
		sizeBytes: Number(data.sizeBytes),
		expiresAt: new Date(data.expiresAt).toISOString(),
		notes: data.notes.trim(),
	};
}
export function parsePublishedMobileBuild(
	value: unknown,
): PublishedMobileBuild {
	const data = record(value);
	if (
		!Number.isSafeInteger(data.revision) ||
		Number(data.revision) < 1 ||
		typeof data.active !== "boolean" ||
		typeof data.publishedAt !== "string" ||
		!Number.isFinite(Date.parse(data.publishedAt))
	)
		throw new Error("Invalid published build");
	return {
		...parseMobileBuild(data),
		revision: Number(data.revision),
		active: data.active,
		publishedAt: data.publishedAt,
	};
}
export function offeredMobileBuild(
	build: PublishedMobileBuild | null,
	installed: {
		applicationId: string;
		platform: string;
		channel: string;
		buildNumber: number;
	},
	now = Date.now(),
) {
	if (
		!build ||
		!build.active ||
		Date.parse(build.expiresAt) <= now ||
		build.buildNumber <= installed.buildNumber
	)
		return null;
	if (
		Object.entries(MOBILE_BUILD_SCOPE).some(
			([key, value]) =>
				installed[key as keyof typeof MOBILE_BUILD_SCOPE] !== value,
		)
	)
		return null;
	return build;
}
