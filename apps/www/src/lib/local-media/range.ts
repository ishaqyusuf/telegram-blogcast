export type ByteRange = {
	start: number;
	end: number;
	length: number;
};

export function parseSingleByteRange(
	header: string | null | undefined,
	fileSize: number,
): ByteRange | null {
	if (!header || fileSize <= 0 || !header.startsWith("bytes=")) return null;
	const value = header.slice("bytes=".length).trim();
	if (!value || value.includes(",")) return null;

	const match = /^(\d*)-(\d*)$/.exec(value);
	if (!match) return null;
	const [, rawStart, rawEnd] = match;
	if (!rawStart && !rawEnd) return null;

	let start: number;
	let end: number;
	if (!rawStart) {
		const suffixLength = Number(rawEnd);
		if (!Number.isInteger(suffixLength) || suffixLength <= 0) return null;
		start = Math.max(0, fileSize - suffixLength);
		end = fileSize - 1;
	} else {
		start = Number(rawStart);
		end = rawEnd ? Number(rawEnd) : fileSize - 1;
		if (
			!Number.isInteger(start) ||
			!Number.isInteger(end) ||
			start < 0 ||
			start >= fileSize ||
			end < start
		) {
			return null;
		}
		end = Math.min(end, fileSize - 1);
	}

	return { start, end, length: end - start + 1 };
}
