import { previewBuildMetadata } from "./mobile-build-provider";

export async function buildAndRegisterPreview(input: {
	command: string[];
	revision: string;
	runJson: (command: string[]) => Promise<string>;
	register: (buildId: string, revision: string) => Promise<void>;
}) {
	if (input.command.includes("--no-wait"))
		throw new Error(
			"Preview registration requires the finished APK. Remove --no-wait.",
		);
	const result = JSON.parse(
		await input.runJson([
			...input.command.filter((v) => v !== "--json" && v !== "--wait"),
			"--wait",
			"--json",
		]),
	);
	if (
		!Array.isArray(result) ||
		result.length !== 1 ||
		typeof result[0]?.id !== "string"
	)
		throw new Error("Expected exactly one Android Preview build");
	const id = result[0].id;
	previewBuildMetadata(result[0], input.revision, id);
	try {
		await input.register(id, input.revision);
	} catch (error) {
		throw new Error(
			`Build ${id} finished, but registration failed. Retry without rebuilding: bun scripts/mobile-build-release.ts publish --build-id ${id} --commit ${input.revision}`,
			{ cause: error },
		);
	}
	return id;
}
