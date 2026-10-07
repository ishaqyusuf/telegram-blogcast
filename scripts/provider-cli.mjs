import { accessSync, constants, statSync } from "node:fs";
import { delimiter, resolve } from "node:path";

const PROJECT_BIN = /[\\/]node_modules[\\/]\.bin[\\/]?$/;

// Match local-infra-kit: bun run prepends older project copies to PATH.
export function providerCli(name, path = process.env.PATH ?? "") {
	const entries = path.split(delimiter).filter(Boolean);
	for (const directories of [entries.filter((entry) => !PROJECT_BIN.test(entry)), entries]) {
		for (const directory of directories) {
			const candidate = resolve(directory, name);
			try {
				accessSync(candidate, constants.X_OK);
				if (statSync(candidate).isFile()) return candidate;
			} catch {
				// Try the next directory or the project fallback.
			}
		}
	}
	return name;
}
