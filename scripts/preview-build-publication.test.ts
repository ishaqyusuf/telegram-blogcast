import { expect, test } from "bun:test";
import { buildAndRegisterPreview } from "./preview-build-publication";

const id = "a86d38dd-cbd3-4187-a15f-63ffd70f3f58";
const revision = "a".repeat(40);
const build = {
	id,
	status: "FINISHED",
	platform: "ANDROID",
	buildProfile: "preview",
	channel: "preview",
	distribution: "INTERNAL",
	gitCommitHash: revision,
	project: {
		id: "9d8a8cd8-d310-4724-8a61-db39e6b56c9a",
		ownerAccount: { name: "ishaqyusuf" },
	},
	artifacts: { buildUrl: "https://expo.dev/artifacts/eas/example.apk" },
	expirationDate: "2099-01-01",
	appBuildVersion: "28",
	appVersion: "1.0.112",
	runtimeVersion: "1.0.112",
};
test("normal Preview build waits and registers only its finished artifact", async () => {
	const registered: string[] = [];
	await buildAndRegisterPreview({
		command: ["eas", "build"],
		revision,
		runJson: async (command) => {
			expect(command).toContain("--wait");
			expect(command).toContain("--json");
			return JSON.stringify([build]);
		},
		register: async (value, sha) => {
			registered.push(value);
			expect(sha).toBe(revision);
		},
	});
	expect(registered).toEqual([id]);
});
test("never registers queued, failed or another project's builds", async () => {
	for (const override of [
		{ status: "IN_PROGRESS" },
		{ status: "ERRORED" },
		{ project: { id: "wrong" } },
	]) {
		let registered = false;
		await expect(
			buildAndRegisterPreview({
				command: ["eas", "build"],
				revision,
				runJson: async () => JSON.stringify([{ ...build, ...override }]),
				register: async () => {
					registered = true;
				},
			}),
		).rejects.toThrow();
		expect(registered).toBe(false);
	}
});
test("registration failure supplies a retry without charging for another build", async () => {
	await expect(
		buildAndRegisterPreview({
			command: ["eas", "build"],
			revision,
			runJson: async () => JSON.stringify([build]),
			register: async () => {
				throw new Error("offline");
			},
		}),
	).rejects.toThrow(`--build-id ${id} --commit ${revision}`);
});
