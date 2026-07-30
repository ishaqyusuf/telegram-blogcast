import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { db } from "@acme/db";
import {
	facebookSavedCaptureSchema,
	syncFacebookSavedCapture,
} from "../../apps/api/src/services/facebook-saved-sync";

type Options = {
	captureFilePath: string;
	canonicalFilePath?: string;
	dryRun: boolean;
	batchSize: number;
};

function parseArgs(argv: string[]): Options {
	const options: Options = {
		captureFilePath: "",
		dryRun: false,
		batchSize: 50,
	};

	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		const next = argv[index + 1];
		if (arg === "--dry-run") {
			options.dryRun = true;
			continue;
		}
		if (arg === "--capture" && next) {
			options.captureFilePath = resolve(next);
			index += 1;
			continue;
		}
		if (arg === "--file" && next) {
			options.canonicalFilePath = resolve(next);
			index += 1;
			continue;
		}
		if (arg === "--batch-size" && next) {
			options.batchSize = Number.parseInt(next, 10);
			index += 1;
		}
	}

	if (!options.captureFilePath) {
		throw new Error("--capture is required.");
	}
	if (
		!Number.isInteger(options.batchSize) ||
		options.batchSize < 1 ||
		options.batchSize > 100
	) {
		throw new Error("--batch-size must be between 1 and 100.");
	}
	return options;
}

async function main() {
	const options = parseArgs(process.argv.slice(2));
	const capture = facebookSavedCaptureSchema.parse(
		JSON.parse(await readFile(options.captureFilePath, "utf8")),
	);
	const result = await syncFacebookSavedCapture(db, {
		canonicalFilePath: options.canonicalFilePath,
		capture,
		dryRun: options.dryRun,
		batchSize: options.batchSize,
	});
	console.log(JSON.stringify(result, null, 2));
}

main()
	.catch((error) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(async () => {
		await db.$disconnect();
	});
