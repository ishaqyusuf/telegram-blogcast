type SearchableChannel = { title?: string | null; username?: string | null };

function normalize(value: string) {
	return value.normalize("NFKD").replace(/\p{M}/gu, "").toLocaleLowerCase();
}

export function filterChannels<T extends SearchableChannel>(
	channels: readonly T[],
	query: string,
): T[] {
	const terms = normalize(query)
		.trim()
		.split(/\s+/)
		.map((term) => term.replace(/^@/, ""))
		.filter(Boolean);
	if (!terms.length) return [...channels];
	return channels.filter((channel) => {
		const text = normalize(`${channel.title ?? ""} ${channel.username ?? ""}`);
		return terms.every((term) => text.includes(term));
	});
}
