export type LocalMediaSource = {
	mediaId: number;
	peer: string | number;
	messageId: number;
	fileName: string;
	mimeType: string;
};

export type LocalMediaSourceRecord = {
	id: number;
	file?: {
		fileName?: string | null;
		mimeType?: string | null;
	} | null;
	blog?: {
		telegramMessageId?: number | null;
		meta?: unknown;
		channel?: { username?: string | null } | null;
	} | null;
};

function asRecord(value: unknown): Record<string, unknown> {
	return value && typeof value === "object" && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: {};
}

function positiveInteger(value: unknown) {
	return typeof value === "number" && Number.isInteger(value) && value > 0
		? value
		: null;
}

function facebookTelegramSource(meta: unknown) {
	const root = asRecord(meta);
	const facebook = asRecord(root.facebook);
	const mediaDownload = asRecord(facebook.mediaDownload);
	const messageId = positiveInteger(mediaDownload.messageId);
	const chatId = mediaDownload.chatId;
	if (!messageId) return null;

	if (typeof chatId === "number" && Number.isSafeInteger(chatId)) {
		return { peer: chatId, messageId };
	}
	if (typeof chatId !== "string" || !chatId.trim()) return null;
	const value = chatId.trim();
	if (/^-?\d+$/.test(value)) {
		const numericPeer = Number(value);
		return Number.isSafeInteger(numericPeer)
			? { peer: numericPeer, messageId }
			: null;
	}
	return {
		peer: `t.me/${value.replace(/^@/, "")}`,
		messageId,
	};
}

export function resolveLocalMediaSource(
	record: LocalMediaSourceRecord,
): LocalMediaSource | null {
	const blog = record.blog;
	if (!blog) return null;

	const channelUsername = blog.channel?.username?.trim().replace(/^@/, "");
	const channelMessageId = positiveInteger(blog.telegramMessageId);
	const telegramSource =
		channelUsername && channelMessageId
			? {
					peer: `t.me/${channelUsername}`,
					messageId: channelMessageId,
				}
			: facebookTelegramSource(blog.meta);
	if (!telegramSource) return null;

	return {
		mediaId: record.id,
		...telegramSource,
		fileName: record.file?.fileName?.trim() || `media-${record.id}`,
		mimeType: record.file?.mimeType?.trim() || "application/octet-stream",
	};
}
