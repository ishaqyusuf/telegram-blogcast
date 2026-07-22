export const TELEGRAM_BOT_DOWNLOAD_LIMIT_BYTES = 20 * 1024 * 1024;
export const TELEGRAM_BOT_UPLOAD_LIMIT_BYTES = 50 * 1024 * 1024;

export type FacebookExternalMediaDestination = "telegram" | "facebook";
export type FacebookExternalMediaReason =
	| "telegram_download_limit"
	| "telegram_upload_limit";

export type FacebookExternalMedia = {
	accessMode: "external";
	destination: FacebookExternalMediaDestination;
	reason: FacebookExternalMediaReason;
	externalUrl: string;
	mediaType: string | null;
	mimeType: string | null;
	fileName: string | null;
	fileSize: number | null;
	duration: number | null;
	thumbnailFileId: string | null;
};

function asRecord(value: unknown): Record<string, unknown> {
	if (!value || typeof value !== "object" || Array.isArray(value)) return {};
	return value as Record<string, unknown>;
}

function stringValue(value: unknown) {
	return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberValue(value: unknown) {
	return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function getFacebookMediaDownloadMeta(meta: unknown) {
	return asRecord(asRecord(asRecord(meta).facebook).mediaDownload);
}

export function buildTelegramMessageUrl(
	chatId: string | number | null | undefined,
	messageId: number | null | undefined,
) {
	if (!chatId || !messageId || messageId <= 0) return null;
	const value = String(chatId).trim();
	if (value.startsWith("@") && value.length > 1) {
		return `https://t.me/${value.slice(1)}/${messageId}`;
	}
	if (/^-100\d+$/.test(value)) {
		return `https://t.me/c/${value.slice(4)}/${messageId}`;
	}
	return null;
}

export function getFacebookExternalMedia(input: {
	source?: string | null;
	sourceUrl?: string | null;
	meta?: unknown;
	fileSize?: number | null;
	mediaType?: string | null;
	mimeType?: string | null;
	fileName?: string | null;
	duration?: number | null;
	thumbnailFileId?: string | null;
}): FacebookExternalMedia | null {
	if (input.source !== "facebook") return null;

	const meta = getFacebookMediaDownloadMeta(input.meta);
	const metaStatus = stringValue(meta.status);
	const fileSize = numberValue(meta.fileSize) ?? input.fileSize ?? null;
	const isOversized =
		typeof fileSize === "number" &&
		fileSize > TELEGRAM_BOT_DOWNLOAD_LIMIT_BYTES;
	if (metaStatus !== "external" && !isOversized) return null;

	const savedDestination = stringValue(meta.destination);
	const savedReason = stringValue(meta.reason);
	const messageId = numberValue(meta.messageId);
	const chatId =
		typeof meta.chatId === "number" || typeof meta.chatId === "string"
			? meta.chatId
			: null;
	const telegramUrl = buildTelegramMessageUrl(chatId, messageId);
	const destination: FacebookExternalMediaDestination =
		savedDestination === "telegram" && telegramUrl
			? "telegram"
			: savedDestination === "facebook"
				? "facebook"
				: fileSize != null &&
						fileSize <= TELEGRAM_BOT_UPLOAD_LIMIT_BYTES &&
						telegramUrl
					? "telegram"
					: "facebook";
	const externalUrl =
		stringValue(meta.externalUrl) ??
		(destination === "telegram" ? telegramUrl : input.sourceUrl);
	if (!externalUrl) return null;

	const reason: FacebookExternalMediaReason =
		savedReason === "telegram_upload_limit" ||
		(fileSize != null && fileSize > TELEGRAM_BOT_UPLOAD_LIMIT_BYTES)
			? "telegram_upload_limit"
			: "telegram_download_limit";

	return {
		accessMode: "external",
		destination,
		reason,
		externalUrl,
		mediaType: stringValue(meta.mediaType) ?? input.mediaType ?? null,
		mimeType: stringValue(meta.mimeType) ?? input.mimeType ?? null,
		fileName: stringValue(meta.fileName) ?? input.fileName ?? null,
		fileSize,
		duration: numberValue(meta.duration) ?? input.duration ?? null,
		thumbnailFileId:
			stringValue(meta.thumbnailFileId) ?? input.thumbnailFileId ?? null,
	};
}
