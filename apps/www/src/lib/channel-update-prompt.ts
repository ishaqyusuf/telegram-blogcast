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
