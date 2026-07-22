type ChannelStatus = "queued" | "running" | "completed" | "failed" | "skipped";

type ChannelUpdateTerminalItem = {
	channelId: number;
	title: string | null;
	username: string;
	status: ChannelStatus;
	beforeCount: number;
	latestKnownCount: number | null;
	fetchedCount: number;
	finalStoredCount: number | null;
	error: string | null;
	skipReason: string | null;
};

export type ChannelUpdateTerminalJob = {
	id: string;
	status: "running" | "completed";
	selectedCount: number;
	totalNewChats: number;
	channels: readonly ChannelUpdateTerminalItem[];
};

export type ChannelUpdateTerminalEvent = {
	kind: "cmd" | "info" | "success" | "error";
	text: string;
};

function channelName(channel: ChannelUpdateTerminalItem) {
	return channel.title?.trim() || `@${channel.username}`;
}

function getChannelEvent(
	channel: ChannelUpdateTerminalItem,
): ChannelUpdateTerminalEvent | null {
	const name = channelName(channel);

	switch (channel.status) {
		case "running":
			return {
				kind: "info",
				text: `updating ${name} (@${channel.username}) · ${channel.fetchedCount} new so far · ${channel.beforeCount} previously saved`,
			};
		case "completed":
			return {
				kind: "success",
				text: `${name} updated · ${channel.fetchedCount} new · ${channel.finalStoredCount ?? channel.beforeCount} saved`,
			};
		case "failed":
			return {
				kind: "error",
				text: `${name} failed · ${channel.error ?? "unknown error"}`,
			};
		case "skipped":
			return {
				kind: "info",
				text: `${name} skipped · ${channel.skipReason ?? "not available"}`,
			};
		default:
			return null;
	}
}

export function getChannelUpdateTerminalEvents(
	previous: ChannelUpdateTerminalJob | null,
	current: ChannelUpdateTerminalJob,
) {
	const events: ChannelUpdateTerminalEvent[] = [];

	if (!previous || previous.id !== current.id) {
		events.push({
			kind: "cmd",
			text: `recent update started · ${current.selectedCount} channel${current.selectedCount === 1 ? "" : "s"}`,
		});
	}

	const previousChannels = new Map(
		previous?.id === current.id
			? previous.channels.map((channel) => [channel.channelId, channel])
			: [],
	);

	for (const channel of current.channels) {
		const prior = previousChannels.get(channel.channelId);
		const changed =
			!prior ||
			prior.status !== channel.status ||
			prior.fetchedCount !== channel.fetchedCount;
		if (!changed) continue;

		const event = getChannelEvent(channel);
		if (event) events.push(event);
	}

	if (
		current.status === "completed" &&
		(previous?.id !== current.id || previous.status !== "completed")
	) {
		const failedCount = current.channels.filter(
			(channel) => channel.status === "failed",
		).length;
		events.push({
			kind: failedCount > 0 ? "error" : "success",
			text:
				failedCount > 0
					? `recent update finished · ${failedCount} failed · ${current.totalNewChats} new post${current.totalNewChats === 1 ? "" : "s"}`
					: `recent update complete · ${current.totalNewChats} new post${current.totalNewChats === 1 ? "" : "s"}`,
		});
	}

	return events;
}
