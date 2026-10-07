import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assertReleaseSource } from "./release-source.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const modes = args.filter((arg) => ["--preview", "--production"].includes(arg));
if (modes.length !== 1) throw new Error("Choose --preview or --production.");
const production = modes[0] === "--production";
const revision = args[args.indexOf("--revision") + 1];
assertReleaseSource(root, revision);

// Only committed files are uploaded. The root web project link and ignored
// credentials/caches are never copied or relinked.
const stage = mkdtempSync(join(tmpdir(), "alghurobaa-api-release-"));
try {
	const archive = execFileSync("git", ["archive", revision], {
		cwd: root,
		maxBuffer: 256 * 1024 * 1024,
	});
	execFileSync("tar", ["-x", "-C", stage], { input: archive });
	mkdirSync(join(stage, ".vercel"));
	writeFileSync(
		join(stage, ".vercel/project.json"),
		JSON.stringify({
			projectId: "prj_ScB6lVbLlEKjp5RHVXnqG6dac5Tw",
			orgId: "team_BV5rgKHJH4fMyFL1YfscZIZK",
			projectName: "alghurobaa-api",
		}),
	);
	const result = spawnSync(
		"vercel",
		[
			"deploy",
			"--yes",
			"--archive=tgz",
			...(production ? ["--prod"] : []),
			"--meta",
			`releaseSha=${revision}`,
			"--meta",
			`githubCommitSha=${revision}`,
			"--meta",
			"githubCommitRef=" + (production ? "main" : "preview"),
		],
		{
			cwd: stage,
			stdio: ["ignore", "pipe", "inherit"],
			encoding: "utf8",
			maxBuffer: 4 * 1024 * 1024,
		},
	);
	if (result.error) throw result.error;
	if (result.status !== 0)
		throw new Error("API deployment did not become Ready.");
	const deploymentUrl = result.stdout
		.trim()
		.split(/\s+/)
		.findLast((word) => /^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(word));
	if (!deploymentUrl) throw new Error("Vercel returned no deployment URL.");
	const metadata = JSON.parse(
		execFileSync(
			"vercel",
			[
				"api",
				`/v13/deployments/${new URL(deploymentUrl).hostname}?teamId=team_BV5rgKHJH4fMyFL1YfscZIZK`,
				"--raw",
			],
			{ cwd: stage, encoding: "utf8" },
		),
	);
	if (
		metadata.projectId !== "prj_ScB6lVbLlEKjp5RHVXnqG6dac5Tw" ||
		metadata.readyState !== "READY" ||
		metadata.meta?.releaseSha !== revision ||
		metadata.target !== (production ? "production" : null)
	) {
		throw new Error(
			"API deployment identity, revision, or target did not match.",
		);
	}
	const health = JSON.parse(
		execFileSync(
			"vercel",
			[
				"curl",
				"/health",
				"--deployment",
				deploymentUrl,
				"--",
				"--silent",
				"--show-error",
				"--fail",
			],
			{ cwd: stage, encoding: "utf8" },
		),
	);
	if (health.ok !== true || health.service !== "al-ghurobaa-api") {
		throw new Error("Deployed API health verification failed.");
	}
	if (production) {
		const response = await fetch("https://alghurobaa-api.vercel.app/health");
		const publicHealth = await response.json();
		if (
			!response.ok ||
			publicHealth.ok !== true ||
			publicHealth.service !== "al-ghurobaa-api"
		) {
			throw new Error(
				"Public API origin is not serving the healthy production deployment.",
			);
		}
	}
	console.log(`API Ready and healthy: ${deploymentUrl} (${revision})`);
} finally {
	rmSync(stage, { recursive: true, force: true });
}
