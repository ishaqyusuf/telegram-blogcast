export function requiresCrossChannelConfirmation(
	sourceChannelIds: Array<number | null>,
	destinationChannelId: number | null,
) {
	return sourceChannelIds.some((id) => id !== destinationChannelId);
}
