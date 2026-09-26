import { createHmac, timingSafeEqual } from "node:crypto";
import { lstatSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import type {
	ConsumerProviderBindings,
	ConsumerReleaseContext,
} from "./toolkit/ec653d87eb0b65bbac9235680d85eed6fdfd20a1/src/release/consumer";
import type {
	ProviderReleaseMetadata,
	ReleaseFingerprint,
	ReleaseReceipt,
} from "./toolkit/ec653d87eb0b65bbac9235680d85eed6fdfd20a1/src/release/evidence";
import {
	type ExpoBuildRecord,
	type ExpoChannelRecord,
	type ExpoMobileConfig,
	type ExpoPlatform,
	type ExpoUpdateRecord,
	decideExpoRelease,
	generateExpoCurrentState,
} from "./toolkit/ec653d87eb0b65bbac9235680d85eed6fdfd20a1/src/release/expo";
import {
	type JobsDeploymentRecord,
	type JobsPreviewWaiverRecord,
	type JobsTargetConfig,
	verifyJobsDeployments,
} from "./toolkit/ec653d87eb0b65bbac9235680d85eed6fdfd20a1/src/release/jobs";
import type { ProviderLiveStateMetadata } from "./toolkit/ec653d87eb0b65bbac9235680d85eed6fdfd20a1/src/release/live-state";
import type {
	ReleaseManifest,
	ReleasePlan,
} from "./toolkit/ec653d87eb0b65bbac9235680d85eed6fdfd20a1/src/release/plan";
import {
	type VercelDeploymentMetadata,
	type VercelDomainAssignment,
	type VercelPromotionGate,
	type VercelWebTarget,
	verifyVercelWebDeployments,
} from "./toolkit/ec653d87eb0b65bbac9235680d85eed6fdfd20a1/src/release/vercel";

const MAX_EVIDENCE_BYTES = 1024 * 1024;
const MAX_EVIDENCE_AGE_MS = 5 * 60 * 1000;

type SignedEnvelope = {
	version: 1;
	payload: string;
	signature: string;
};

export type AlghurobaaProviderBundle = {
	version: 1;
	project: "alghurobaa";
	environment: "preview" | "production";
	revision: string;
	generatedAt: string;
	receipts: ReleaseReceipt[];
	evidence: ProviderReleaseMetadata[];
	liveState: ProviderLiveStateMetadata[];
	fingerprints: Record<string, ReleaseFingerprint | undefined>;
	vercel: {
		deploymentIds: Record<string, string | null | undefined>;
		deployments: VercelDeploymentMetadata[];
		domains: Array<{ domain: string; assignment: VercelDomainAssignment }>;
		promotionGates: Array<{ projectId: string; gate: VercelPromotionGate }>;
	};
	expo: {
		fingerprints: Record<ExpoPlatform, string | null>;
		runtimeVersions: Record<ExpoPlatform, string | null>;
		baselineBuildIds: Partial<Record<ExpoPlatform, string | null>>;
		newBuildIds: Partial<Record<ExpoPlatform, string | null>>;
		updateGroupIds: Partial<Record<ExpoPlatform, string | null>>;
		builds: ExpoBuildRecord[];
		updates: ExpoUpdateRecord[];
		channels: ExpoChannelRecord[];
	};
	jobs: {
		deploymentIds: Record<string, string | null | undefined>;
		configurationFingerprints: Record<string, string | null | undefined>;
		deployments: JobsDeploymentRecord[];
		previewWaiverIds?: Record<string, string | null | undefined>;
		waivers?: JobsPreviewWaiverRecord[];
	};
};

export const WEB_TARGETS: VercelWebTarget[] = [
	{
		targetId: "web",
		projectId: "prj_hzQU6ksZjPzQe2x5Gvf7zlVYrKki",
		teamId: "team_BV5rgKHJH4fMyFL1YfscZIZK",
		productionDomain: "alghurobaa.vercel.app",
		dbGateCheckName: "release-assurance-production",
	},
];

export const MOBILE_TARGET: ExpoMobileConfig = {
	targetId: "mobile",
	projectId: "9d8a8cd8-d310-4724-8a61-db39e6b56c9a",
	appPath: "apps/expo-app",
	platforms: ["android"],
	preview: { profile: "preview", channel: "preview", branch: "preview" },
	production: {
		profile: "production",
		channel: "production",
		branch: "production",
	},
};

export const JOBS_TARGET: JobsTargetConfig = {
	targetId: "jobs",
	provider: "trigger",
	projectRef: "proj_ryiraaguagaettphjklm",
	preview: {
		capability: "unsupported",
		reason:
			"Alghurobaa Preview currently shares the Production Trigger worker; isolated Preview ownership is not configured.",
	},
	production: {
		capability: "isolated",
		providerEnvironment: "prod",
		branch: null,
	},
};

function evidenceText(context: ConsumerReleaseContext) {
	const inline = process.env.ALGHUROBAA_RELEASE_EVIDENCE_ENVELOPE?.trim();
	if (inline) return inline;
	const configured =
		process.env.ALGHUROBAA_RELEASE_EVIDENCE_FILE?.trim() ||
		`.release/runtime/${context.environment}.json`;
	const root = resolve(context.repository);
	const path = resolve(root, configured);
	const pathFromRoot = relative(root, path);
	if (
		pathFromRoot.startsWith("..") ||
		pathFromRoot === "" ||
		pathFromRoot.includes("\\")
	) {
		throw new Error("Signed release evidence must stay inside the repository.");
	}
	let stat: ReturnType<typeof lstatSync>;
	try {
		stat = lstatSync(path);
	} catch {
		throw new Error("Signed provider evidence is unavailable.");
	}
	if (
		!stat.isFile() ||
		stat.isSymbolicLink() ||
		stat.size > MAX_EVIDENCE_BYTES
	) {
		throw new Error("Signed provider evidence file is invalid.");
	}
	return readFileSync(path, "utf8");
}

function verifiedPayload(encoded: string, signature: string, secret: string) {
	if (!/^[A-Za-z0-9_-]+$/.test(encoded) || !/^[0-9a-f]{64}$/i.test(signature)) {
		throw new Error("Signed provider evidence is invalid.");
	}
	const expected = createHmac("sha256", secret).update(encoded).digest();
	const supplied = Buffer.from(signature, "hex");
	if (
		supplied.length !== expected.length ||
		!timingSafeEqual(supplied, expected)
	) {
		throw new Error("Signed provider evidence is invalid.");
	}
	try {
		return JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
	} catch {
		throw new Error("Signed provider evidence is invalid.");
	}
}

export function loadSignedProviderBundle(
	context: ConsumerReleaseContext,
): AlghurobaaProviderBundle {
	const secret = process.env.ALGHUROBAA_RELEASE_EVIDENCE_HMAC_KEY ?? "";
	if (Buffer.byteLength(secret) < 32) {
		throw new Error("Signed provider evidence key is unavailable.");
	}
	let envelope: SignedEnvelope;
	try {
		envelope = JSON.parse(evidenceText(context)) as SignedEnvelope;
	} catch (error) {
		if (error instanceof Error && error.message.startsWith("Signed")) {
			throw error;
		}
		throw new Error("Signed provider evidence is invalid.");
	}
	if (
		envelope?.version !== 1 ||
		typeof envelope.payload !== "string" ||
		typeof envelope.signature !== "string"
	) {
		throw new Error("Signed provider evidence is invalid.");
	}
	const payload = verifiedPayload(
		envelope.payload,
		envelope.signature,
		secret,
	) as Partial<AlghurobaaProviderBundle>;
	const generatedAt = Date.parse(payload.generatedAt ?? "");
	const now = Date.now();
	if (
		payload.version !== 1 ||
		payload.project !== "alghurobaa" ||
		payload.environment !== context.environment ||
		payload.revision !== context.revision ||
		!Number.isFinite(generatedAt) ||
		generatedAt > now ||
		now - generatedAt > MAX_EVIDENCE_AGE_MS ||
		!Array.isArray(payload.receipts) ||
		!Array.isArray(payload.evidence) ||
		!Array.isArray(payload.liveState) ||
		!payload.fingerprints ||
		!payload.vercel ||
		!payload.expo ||
		!payload.jobs
	) {
		throw new Error("Signed provider evidence does not match this release.");
	}
	return payload as AlghurobaaProviderBundle;
}

export function createAlghurobaaProviderBindings(
	context: ConsumerReleaseContext,
	bundle = loadSignedProviderBundle(context),
): ConsumerProviderBindings {
	return {
		receiptClaims: async () => bundle.receipts,
		lookupEvidence: async (provider, deploymentId) =>
			bundle.evidence.find(
				(item) =>
					item.provider === provider && item.deploymentId === deploymentId,
			) ?? null,
		lookupLiveState: async (receipt) =>
			bundle.liveState.find(
				(item) =>
					item.targetId === receipt.targetId &&
					item.provider === receipt.provider &&
					item.deploymentId === receipt.deploymentId,
			) ?? null,
		currentFingerprints: async () => bundle.fingerprints,
		verifyActions: async (
			_releaseContext: ConsumerReleaseContext,
			manifest: ReleaseManifest,
			plan: ReleasePlan,
			evidence,
		) => {
			const web = await verifyVercelWebDeployments({
				manifest,
				plan,
				configs: WEB_TARGETS,
				deploymentIds: bundle.vercel.deploymentIds,
				lookupDeployment: async (id) =>
					bundle.vercel.deployments.find((item) => item.id === id) ?? null,
				lookupDomain: async (domain) =>
					bundle.vercel.domains.find((item) => item.domain === domain)
						?.assignment ?? null,
				lookupPromotionGate: async (projectId) =>
					bundle.vercel.promotionGates.find(
						(item) => item.projectId === projectId,
					)?.gate ?? null,
				databaseEvidence: evidence,
				currentSchemaFingerprints: {
					database:
						bundle.fingerprints.database?.kind === "schema"
							? bundle.fingerprints.database.value
							: undefined,
				},
			});
			const mobile = [];
			if (plan.actions.some((item) => item.targetId === "mobile")) {
				const current = await generateExpoCurrentState(
					MOBILE_TARGET,
					plan.environment,
					plan.revision,
					context.repository,
					"node_modules/.bin/eas",
					async (command) => {
						const platformIndex = command.args.indexOf("--platform");
						const platform = command.args[platformIndex + 1] as
							| ExpoPlatform
							| undefined;
						return {
							hash: platform ? bundle.expo.fingerprints[platform] : null,
						};
					},
					async (platform) => bundle.expo.runtimeVersions[platform],
				);
				mobile.push(
					await decideExpoRelease({
						manifest,
						plan,
						config: MOBILE_TARGET,
						current,
						baselineBuildIds: bundle.expo.baselineBuildIds,
						newBuildIds: bundle.expo.newBuildIds,
						updateGroupIds: bundle.expo.updateGroupIds,
						lookupBuild: async (id) =>
							bundle.expo.builds.find((item) => item.id === id) ?? null,
						lookupUpdate: async (id) =>
							bundle.expo.updates.find((item) => item.groupId === id) ?? null,
						lookupChannel: async (channel) =>
							bundle.expo.channels.find((item) => item.channel === channel) ??
							null,
					}),
				);
			}
			const jobs = await verifyJobsDeployments({
				manifest,
				plan,
				configs: [JOBS_TARGET],
				deploymentIds: bundle.jobs.deploymentIds,
				currentConfigurationFingerprints: bundle.jobs.configurationFingerprints,
				lookupDeployment: async (id) =>
					bundle.jobs.deployments.find((item) => item.id === id) ?? null,
				previewWaiverIds: bundle.jobs.previewWaiverIds,
				lookupWaiver: async (id) =>
					bundle.jobs.waivers?.find((item) => item.id === id) ?? null,
			});
			return { web, mobile, jobs };
		},
	};
}
