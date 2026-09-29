type UpdateCandidate = {
	channelId: number;
	canUpdate: boolean;
	delta: number | null;
};

export const CHANNEL_AUTO_UPDATE_INTERVAL_MS = 5 * 60 * 1000;

export function getAutomaticChannelIds(
	channels: readonly UpdateCandidate[],
	selectedIds: readonly number[],
) {
	const selected = new Set(selectedIds);
	return channels
		.filter(
			(channel) =>
				selected.has(channel.channelId) &&
				channel.canUpdate &&
				(channel.delta === null || channel.delta > 0),
		)
		.map((channel) => channel.channelId);
}

// Keep the automatic path independent of prompts, navigation and notifications.
export async function runChannelAutoUpdate({
	selectedIds,
	isCurrent,
	getAuthStatus,
	getSummary,
	startJob,
}: {
	selectedIds: readonly number[];
	isCurrent: () => boolean;
	getAuthStatus: () => Promise<{ authorized: boolean }>;
	getSummary: () => Promise<{ channels: UpdateCandidate[] }>;
	startJob: (input: { channelIds: number[] }) => Promise<unknown>;
}) {
	if (!isCurrent() || selectedIds.length === 0) return;
	const auth = await getAuthStatus();
	if (!isCurrent() || !auth.authorized) return;
	const summary = await getSummary();
	if (!isCurrent()) return;
	const channelIds = getAutomaticChannelIds(summary.channels, selectedIds);
	if (channelIds.length > 0) await startJob({ channelIds });
}
