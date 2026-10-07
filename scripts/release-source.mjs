import { execFileSync } from "node:child_process";

export function assertReleaseSource(root, expectedRevision) {
	if (!/^[a-f0-9]{40}$/.test(expectedRevision ?? "")) {
		throw new Error("An exact 40-character release revision is required.");
	}
	const git = (...args) =>
		execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
	if (git("rev-parse", "HEAD") !== expectedRevision) {
		throw new Error("Release revision must match committed HEAD.");
	}
	if (git("status", "--porcelain")) {
		throw new Error(
			"Commit changes before releasing; the release source must be clean.",
		);
	}
	return expectedRevision;
}
