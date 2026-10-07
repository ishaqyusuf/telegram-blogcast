import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { test } from "node:test";
import { providerCli } from "./provider-cli.mjs";

test("release uses global Vercel even when bun run prepends a project CLI", () => {
	const root = mkdtempSync(join(tmpdir(), "alghurobaa-provider-cli-"));
	try {
		const local = join(root, "node_modules", ".bin");
		const global = join(root, "bin");
		for (const directory of [local, global]) {
			mkdirSync(directory, { recursive: true });
			writeFileSync(join(directory, "vercel"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
		}
		assert.equal(providerCli("vercel", [local, global].join(delimiter)), join(global, "vercel"));
		assert.equal(providerCli("vercel", local), join(local, "vercel"));
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
