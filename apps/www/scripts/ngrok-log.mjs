const DISABLED_VALUES = new Set(["0", "false", "no", "off"]);

export function isNgrokEnabled(value) {
	if (value == null) return true;
	return !DISABLED_VALUES.has(value.trim().toLowerCase());
}

export function parseNgrokLogLine(line) {
	const trimmed = line.trim();
	if (!trimmed) return {};

	try {
		const entry = JSON.parse(trimmed);
		return {
			level: typeof entry.lvl === "string" ? entry.lvl : undefined,
			message:
				typeof entry.msg === "string"
					? [entry.msg, entry.err].filter(Boolean).join(": ")
					: undefined,
			url:
				typeof entry.url === "string" && entry.url.startsWith("https://")
					? entry.url
					: undefined,
		};
	} catch {
		const url = trimmed.match(/https:\/\/[^\s"']+/)?.[0];
		return {
			message: trimmed,
			url,
		};
	}
}
