import { createHash } from "node:crypto";
import { mkdtemp, open, readdir, rm } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import {
	MAX_APK_BYTES,
	MOBILE_BUILD_SCOPE,
	parseMobileBuild,
} from "../packages/utils/src/mobile-build";
import {
	assertApkIdentity,
	previewBuildMetadata,
} from "./mobile-build-provider";

async function output(command: string[], cwd = process.cwd()) {
	const child = Bun.spawn(command, { cwd, stdout: "pipe", stderr: "inherit" });
	const text = await new Response(child.stdout).text();
	if (await child.exited)
		throw new Error(`Command failed: ${command[0]} ${command[1]}`);
	return text;
}
const args = process.argv.slice(2);
const operation = args[0];
const flag = (name: string) => args[args.indexOf(name) + 1];
if (!["status", "publish", "withdraw"].includes(operation ?? ""))
	throw new Error(
		"Usage: bun scripts/mobile-build-release.ts status | publish --build-id <id> --commit <sha> [--notes <text>] | withdraw --revision <n>",
	);
const { db } = await import("../packages/db/src/index");
const { readMobileBuild, publishMobileBuild, withdrawMobileBuild } =
	await import("../apps/api/src/services/mobile-build");
try {
	if (operation === "status") {
		console.log(JSON.stringify(await readMobileBuild(db), null, 2));
	} else if (operation === "withdraw") {
		const revision = Number(flag("--revision"));
		if (!Number.isSafeInteger(revision) || revision < 1)
			throw new Error("A valid --revision is required");
		console.log(
			JSON.stringify(await withdrawMobileBuild(db, revision), null, 2),
		);
	} else {
		const id = flag("--build-id");
		const commit = flag("--commit");
		if (
			!args.includes("--build-id") ||
			!args.includes("--commit") ||
			!id ||
			!commit
		)
			throw new Error("--build-id and --commit are required");
		const provider = JSON.parse(
			await output(
				["eas", "build:view", id, "--json"],
				join(import.meta.dir, "../apps/expo-app"),
			),
		);
		const metadata = previewBuildMetadata(provider, commit, id);
		const current = await readMobileBuild(db);
		const directory = await mkdtemp(join(tmpdir(), "alghurobaa-apk-"));
		try {
			const path = join(directory, "preview.apk");
			const response = await fetch(metadata.artifactUrl, {
				signal: AbortSignal.timeout(300_000),
			});
			if (!response.ok || !response.body)
				throw new Error("APK is not downloadable");
			const hash = createHash("sha256");
			let sizeBytes = 0;
			const file = await open(path, "w", 0o600);
			try {
				for await (const chunk of response.body) {
					sizeBytes += chunk.byteLength;
					if (sizeBytes > MAX_APK_BYTES)
						throw new Error("APK exceeds size limit");
					hash.update(chunk);
					await file.writeFile(chunk);
				}
			} finally {
				await file.close();
			}
			const sdk =
				process.env.ANDROID_HOME ??
				process.env.ANDROID_SDK_ROOT ??
				join(homedir(), "Library/Android/sdk");
			const versions = (await readdir(join(sdk, "build-tools")))
				.filter((v) => /^\d+\.\d+\.\d+$/.test(v))
				.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
			if (!versions[0])
				throw new Error(
					"Android build-tools are required to verify APK identity",
				);
			assertApkIdentity(
				await output([
					join(sdk, "build-tools", versions[0], "aapt"),
					"dump",
					"badging",
					path,
				]),
				metadata.buildNumber,
			);
			const build = parseMobileBuild({
				...MOBILE_BUILD_SCOPE,
				...metadata,
				sizeBytes,
				sha256: hash.digest("hex"),
				notes: args.includes("--notes")
					? flag("--notes")
					: "Latest Preview improvements",
			});
			console.log(
				JSON.stringify(
					await publishMobileBuild(db, build, current?.revision ?? 0),
					null,
					2,
				),
			);
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	}
} finally {
	await db.$disconnect();
}
