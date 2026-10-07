import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
function run(args, cwd) {
	const result = spawnSync("bun", args, { cwd, stdio: "inherit" });
	if (result.error) throw result.error;
	if (result.status !== 0) throw new Error(`API build failed: ${args[0]}`);
}

// Generate on every build; Turbo's cached dist cannot restore Prisma's client.
run(["x", "prisma", "generate"], resolve(root, "packages/db"));
run(
	[
		"build",
		"src/vercel-app.ts",
		"--target=bun",
		"--packages=bundle",
		"--env=disable",
		"--external=@prisma/client",
		"--external=@prisma/adapter-pg",
		"--external=pg",
		"--outfile=dist/api.js",
	],
	resolve(root, "apps/api"),
);
