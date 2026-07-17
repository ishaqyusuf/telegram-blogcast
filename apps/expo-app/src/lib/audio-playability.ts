export const TELEGRAM_BOT_DOWNLOAD_LIMIT_BYTES = 20 * 1024 * 1024;

export const TELEGRAM_BOT_DOWNLOAD_LIMIT_LABEL = "20 MB";

export const TELEGRAM_AUDIO_TOO_LARGE_REASON =
	"Audio is above Telegram's 20 MB download limit.";

type AudioLike = {
	source?: string | null;
	telegramFileId?: string | null;
	url?: string | null;
	size?: number | null;
};

function hasDirectPlayableBlobUrl(audio?: AudioLike | null) {
	return audio?.source === "vercel_blob" && Boolean(audio.url);
}

function isTelegramBackedAudio(audio?: AudioLike | null) {
	return (
		Boolean(audio?.telegramFileId) || !audio?.source || audio.source === "telegram"
	);
}

export function getAudioPlayability(audio?: AudioLike | null): {
	canPlay: boolean;
	reason: string | null;
} {
	if (!audio) return { canPlay: false, reason: "Audio source is not available." };

	const size = audio.size;
	if (
		typeof size === "number" &&
		Number.isFinite(size) &&
		size > TELEGRAM_BOT_DOWNLOAD_LIMIT_BYTES &&
		isTelegramBackedAudio(audio) &&
		!hasDirectPlayableBlobUrl(audio)
	) {
		return {
			canPlay: false,
			reason: TELEGRAM_AUDIO_TOO_LARGE_REASON,
		};
	}

	return { canPlay: true, reason: null };
}

export function isAudioPlayable(audio?: AudioLike | null) {
	return getAudioPlayability(audio).canPlay;
}
