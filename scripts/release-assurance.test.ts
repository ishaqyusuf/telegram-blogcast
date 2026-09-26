import { afterEach, describe, expect, test } from "bun:test";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
	type AlghurobaaProviderBundle,
	loadSignedProviderBundle,
} from "../.release/alghurobaa-provider-bundle";
import { checkRelease } from "../.release/release-adapter";
import { validateReleaseManifest } from "../.release/toolkit/ec653d87eb0b65bbac9235680d85eed6fdfd20a1/src/release/manifest";
import {
	type ReleaseManifest,
	type ReleaseTargetChange,
	planRelease,
} from "../.release/toolkit/ec653d87eb0b65bbac9235680d85eed6fdfd20a1/src/release/plan";

const root = resolve(import.meta.dir, "..");
const toolkitRevision = "ec653d87eb0b65bbac9235680d85eed6fdfd20a1";
const secret = "alghurobaa-release-test-key-at-least-32-bytes";
const originalEnvelope = process.env.ALGHUROBAA_RELEASE_EVIDENCE_ENVELOPE;
const originalKey = process.env.ALGHUROBAA_RELEASE_EVIDENCE_HMAC_KEY;

afterEach(() => {
	if (originalEnvelope === undefined) {
		// biome-ignore lint/performance/noDelete: test cleanup must remove this key.
		delete process.env.ALGHUROBAA_RELEASE_EVIDENCE_ENVELOPE;
	} else {
		process.env.ALGHUROBAA_RELEASE_EVIDENCE_ENVELOPE = originalEnvelope;
	}
	if (originalKey === undefined) {
		// biome-ignore lint/performance/noDelete: test cleanup must remove this key.
		delete process.env.ALGHUROBAA_RELEASE_EVIDENCE_HMAC_KEY;
	} else {
		process.env.ALGHUROBAA_RELEASE_EVIDENCE_HMAC_KEY = originalKey;
	}
});

function revision() {
	const head = readFileSync(resolve(root, ".git/HEAD"), "utf8").trim();
	if (/^[0-9a-f]{40}$/i.test(head)) return head;
	if (!head.startsWith("ref: ")) {
		throw new Error("Could not resolve test Git SHA.");
	}
	const ref = head.slice("ref: ".length);
	try {
		return readFileSync(resolve(root, ".git", ref), "utf8").trim();
	} catch {
		const packed = readFileSync(resolve(root, ".git/packed-refs"), "utf8");
		return (
			packed
				.split("\n")
				.find((line) => line.endsWith(` ${ref}`))
				?.split(" ")[0] ?? ""
		);
	}
}

function manifest() {
	return JSON.parse(
		readFileSync(resolve(root, "release.manifest.json"), "utf8"),
	) as ReleaseManifest;
}

function signedEnvelope(bundle: AlghurobaaProviderBundle) {
	const payload = Buffer.from(JSON.stringify(bundle)).toString("base64url");
	return JSON.stringify({
		version: 1,
		payload,
		signature: createHmac("sha256", secret).update(payload).digest("hex"),
	});
}

function bundle(
	environment: "preview" | "production",
	releaseRevision: string,
): AlghurobaaProviderBundle {
	const fingerprints = {
		database: { kind: "schema" as const, value: "1".repeat(64) },
		web: { kind: "configuration" as const, value: "2".repeat(64) },
		mobile: { kind: "native" as const, value: "3".repeat(64) },
		jobs: { kind: "configuration" as const, value: "4".repeat(64) },
	};
	const descriptors = [
		{
			targetId: "database",
			targetKind: "database" as const,
			action: "db-push" as const,
			provider: "postgresql",
		},
		{
			targetId: "web",
			targetKind: "web" as const,
			action: "web-deploy" as const,
			provider: "vercel",
		},
		{
			targetId: "mobile",
			targetKind: "mobile" as const,
			action: "mobile-build" as const,
			provider: "expo",
		},
		{
			targetId: "jobs",
			targetKind: "jobs" as const,
			action: "jobs-deploy" as const,
			provider: "trigger",
		},
	];
	const now = Date.now();
	const completedAt = new Date(now - 10_000).toISOString();
	const observedAt = new Date(now).toISOString();
	const receipts = descriptors.map((descriptor, index) => ({
		version: 1 as const,
		project: "alghurobaa",
		...descriptor,
		environment,
		revision: releaseRevision,
		fingerprint: fingerprints[descriptor.targetId as keyof typeof fingerprints],
		deploymentId: `deployment_${index + 1}`,
		result: "succeeded" as const,
		completedAt,
	}));
	return {
		version: 1,
		project: "alghurobaa",
		environment,
		revision: releaseRevision,
		generatedAt: observedAt,
		receipts,
		evidence: receipts.map(({ version: _version, ...receipt }) => receipt),
		liveState: receipts.map((receipt) => ({
			project: receipt.project,
			targetId: receipt.targetId,
			targetKind: receipt.targetKind,
			environment: receipt.environment,
			revision: receipt.revision,
			provider: receipt.provider,
			deploymentId: receipt.deploymentId,
			fingerprint: receipt.fingerprint,
			active: true,
			observedAt,
		})),
		fingerprints,
		vercel: {
			deploymentIds: {},
			deployments: [],
			domains: [],
			promotionGates: [],
		},
		expo: {
			fingerprints: { android: null, ios: null },
			runtimeVersions: { android: null, ios: null },
			baselineBuildIds: {},
			newBuildIds: {},
			updateGroupIds: {},
			builds: [],
			updates: [],
			channels: [],
		},
		jobs: {
			deploymentIds: {},
			configurationFingerprints: { jobs: fingerprints.jobs.value },
			deployments: [],
			previewWaiverIds:
				environment === "preview" ? { jobs: "waiver_preview_jobs" } : undefined,
			waivers:
				environment === "preview"
					? [
							{
								id: "waiver_preview_jobs",
								project: "alghurobaa",
								targetId: "jobs",
								environment: "preview",
								revision: releaseRevision,
								status: "approved",
								protectedApproval: true,
								approvedBy: "release-reviewer",
								reason: "Preview currently shares the Production worker.",
								expiresAt: new Date(now + 60_000).toISOString(),
							},
						]
					: undefined,
		},
	};
}

describe("Alghurobaa release manifest", () => {
	test("maps the four owned deployment surfaces and database ordering", () => {
		const releaseManifest = manifest();
		expect(() => validateReleaseManifest(releaseManifest)).not.toThrow();
		expect(releaseManifest.targets.map((target) => target.id)).toEqual([
			"database",
			"web",
			"mobile",
			"jobs",
		]);
		const changes: Record<string, ReleaseTargetChange> = Object.fromEntries(
			releaseManifest.targets.map((target) => [
				target.id,
				{
					baseRevision: "a".repeat(40),
					changedPaths: [],
					...(target.kind === "mobile"
						? {
								nativeFingerprint: {
									base: "b".repeat(64),
									current: "b".repeat(64),
								},
							}
						: {}),
				} satisfies ReleaseTargetChange,
			]),
		);
		changes.database = {
			baseRevision: "a".repeat(40),
			changedPaths: ["packages/db/src/schema/schema.prisma"],
		};
		const plan = planRelease(releaseManifest, {
			environment: "preview",
			revision: "c".repeat(40),
			targetChanges: changes,
		});
		expect(plan.actions.map((action) => action.targetId)).toEqual([
			"database",
			"web",
			"jobs",
		]);
	});

	test("uses OTA only when the native fingerprint is unchanged", () => {
		const releaseManifest = manifest();
		const emptyChanges = Object.fromEntries(
			releaseManifest.targets.map((target) => [
				target.id,
				{ baseRevision: "a".repeat(40), changedPaths: [] },
			]),
		);
		const updatePlan = planRelease(releaseManifest, {
			environment: "production",
			revision: "d".repeat(40),
			targetChanges: {
				...emptyChanges,
				mobile: {
					baseRevision: "a".repeat(40),
					changedPaths: ["apps/expo-app/src/screens/home-screen.tsx"],
					nativeFingerprint: {
						base: "b".repeat(64),
						current: "b".repeat(64),
					},
				},
			},
		});
		expect(updatePlan.actions[0]?.action).toBe("mobile-update");

		const buildPlan = planRelease(releaseManifest, {
			environment: "production",
			revision: "e".repeat(40),
			targetChanges: {
				...emptyChanges,
				mobile: {
					baseRevision: "a".repeat(40),
					changedPaths: ["apps/expo-app/app.config.ts"],
					nativeFingerprint: {
						base: "b".repeat(64),
						current: "c".repeat(64),
					},
				},
			},
		});
		expect(buildPlan.actions[0]?.action).toBe("mobile-build");
	});
});

describe("Alghurobaa signed provider gate", () => {
	test("rejects missing or tampered evidence", () => {
		const context = {
			environment: "preview" as const,
			revision: revision(),
			repository: root,
			toolkitRevision,
		};
		// biome-ignore lint/performance/noDelete: this test proves the key is absent.
		delete process.env.ALGHUROBAA_RELEASE_EVIDENCE_HMAC_KEY;
		expect(() => loadSignedProviderBundle(context)).toThrow(
			"key is unavailable",
		);
		process.env.ALGHUROBAA_RELEASE_EVIDENCE_HMAC_KEY = secret;
		process.env.ALGHUROBAA_RELEASE_EVIDENCE_ENVELOPE = JSON.stringify({
			version: 1,
			payload: Buffer.from("{}").toString("base64url"),
			signature: "0".repeat(64),
		});
		expect(() => loadSignedProviderBundle(context)).toThrow(
			"evidence is invalid",
		);
	});

	for (const environment of ["preview", "production"] as const) {
		test(`${environment} accepts a fresh exact-revision provider snapshot`, async () => {
			const releaseRevision = revision();
			process.env.ALGHUROBAA_RELEASE_EVIDENCE_HMAC_KEY = secret;
			process.env.ALGHUROBAA_RELEASE_EVIDENCE_ENVELOPE = signedEnvelope(
				bundle(environment, releaseRevision),
			);
			const report = await checkRelease({
				environment,
				revision: releaseRevision,
				repository: root,
				toolkitRevision,
			});
			expect(report.ready).toBe(true);
			expect(report.targets).toHaveLength(4);
			expect(
				report.targets.every(
					(target) =>
						target.reason === "verified" || target.reason === "waived",
				),
			).toBe(true);
			if (environment === "preview") {
				expect(
					report.targets.find((target) => target.targetId === "jobs")?.reason,
				).toBe("waived");
			}
		});
	}

	test("Preview jobs fail closed without a protected waiver", async () => {
		const releaseRevision = revision();
		const current = bundle("preview", releaseRevision);
		current.jobs.previewWaiverIds = {};
		process.env.ALGHUROBAA_RELEASE_EVIDENCE_HMAC_KEY = secret;
		process.env.ALGHUROBAA_RELEASE_EVIDENCE_ENVELOPE = signedEnvelope(current);
		const report = await checkRelease({
			environment: "preview",
			revision: releaseRevision,
			repository: root,
			toolkitRevision,
		});
		expect(report.ready).toBe(false);
		expect(
			report.targets.find((target) => target.targetId === "jobs")?.reason,
		).toBe("provider-action-unready");
	});
});
