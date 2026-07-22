export type ChannelUpdatePromptItem = {
	channelId: number;
	delta: number | null;
	canUpdate: boolean;
};

export function buildChannelUpdatePromptModel<
	TChannel extends ChannelUpdatePromptItem,
>(channels: readonly TChannel[]) {
	const updated = channels.filter(
		(channel) =>
			channel.canUpdate && channel.delta !== null && channel.delta > 0,
	);
	const updatedIds = new Set(updated.map((channel) => channel.channelId));
	const other = channels.filter(
		(channel) => !updatedIds.has(channel.channelId),
	);

	return {
		updated,
		other,
		selectedIds: updated.map((channel) => channel.channelId),
	};
}

export function isChannelUpdateSurface(pathname: string) {
	return pathname === "/blog" || /^\/dashboard(?:\/.*)?$/.test(pathname);
}

export function isLocalChannelUpdateHost(hostname: string) {
	const normalizedHostname =
		hostname.startsWith("[") && hostname.endsWith("]")
			? hostname.slice(1, -1)
			: hostname;
	if (
		normalizedHostname === "localhost" ||
		normalizedHostname === "::1" ||
		normalizedHostname.endsWith(".localhost") ||
		normalizedHostname.startsWith("127.") ||
		normalizedHostname.startsWith("10.") ||
		normalizedHostname.startsWith("192.168.")
	) {
		return true;
	}

	const match = /^172\.(\d+)\./.exec(normalizedHostname);
	const secondOctet = match?.[1] ? Number(match[1]) : null;
	return secondOctet !== null && secondOctet >= 16 && secondOctet <= 31;
}
