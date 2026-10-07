import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assertReleaseSource } from "./release-source.mjs";

const directories = [];
afterEach(() => {
	for (const dir of directories.splice(0))
		rmSync(dir, { recursive: true, force: true });
});
function fixture() {
	const dir = mkdtempSync(join(tmpdir(), "alghurobaa-release-source-test-"));
	directories.push(dir);
	const git = (...args) =>
		execFileSync("git", args, {
			cwd: dir,
			encoding: "utf8",
			stdio: ["ignore", "pipe", "pipe"],
		}).trim();
	git("init", "--object-format=sha1");
	git(
		"-c",
		"user.name=Release Test",
		"-c",
		"user.email=release@example.invalid",
		"commit",
		"--allow-empty",
		"-m",
		"fixture",
	);
	const sha = git("rev-parse", "HEAD");
	return { dir, sha };
}
test("release accepts clean committed HEAD and rejects a different revision", () => {
	const { dir, sha } = fixture();
	assert.equal(assertReleaseSource(dir, sha), sha);
	assert.throws(
		() => assertReleaseSource(dir, "a".repeat(40)),
		/match committed HEAD/,
	);
	assert.throws(() => assertReleaseSource(dir, "main"), /exact 40-character/);
});
test("release refuses to label uncommitted source as the committed artifact", () => {
	const { dir, sha } = fixture();
	writeFileSync(join(dir, "changed.ts"), "export const changed = true;");
	assert.throws(() => assertReleaseSource(dir, sha), /source must be clean/);
});
