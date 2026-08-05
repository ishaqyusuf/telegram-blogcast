import { join } from "node:path";
import { db } from "@acme/db";
import { getClient } from "@telegram/telegram-client";

import { createLocalMediaCache } from "./cache";
import { isLocalMediaGatewayEnabled } from "./config";
import { resolveLocalMediaSource } from "./source";

export { isLocalMediaGatewayEnabled };

async function resolveSource(mediaId: number) {
	const media = await db.media.findUnique({
		where: { id: mediaId },
		include: {
			file: true,
			blog: { include: { channel: true } },
		},
	});
	if (!media?.blog || media.blog.deletedAt) return null;
	return resolveLocalMediaSource(media);
}

async function downloadTelegramMedia(input: {
	source: NonNullable<Awaited<ReturnType<typeof resolveSource>>>;
	destination: string;
	onProgress: (progress: number, downloadedBytes?: number) => void;
}) {
	const client = await getClient();
	if (!(await client.checkAuthorization())) {
		throw new Error("The local Telegram session is not authorized.");
	}
	const entity = await client.getEntity(input.source.peer);
	const messages = await client.getMessages(entity, {
		ids: input.source.messageId,
	});
	const message = messages.find(
		(candidate) => candidate.id === input.source.messageId,
	);
	if (!message?.media) {
		throw new Error("The Telegram message no longer contains media.");
	}

	await client.downloadMedia(message, {
		outputFile: input.destination,
		progressCallback: (downloaded, total) => {
			const receivedBytes = Number(downloaded.toString());
			const totalBytes = Number(total.toString());
			if (totalBytes > 0) {
				input.onProgress(receivedBytes / totalBytes, receivedBytes);
			}
		},
	});
}

const globalForLocalMedia = globalThis as unknown as {
	localMediaCache?: ReturnType<typeof createLocalMediaCache>;
};

function getCacheMaxBytes() {
	const configured = Number(process.env.LOCAL_MEDIA_CACHE_MAX_BYTES);
	return Number.isFinite(configured) && configured > 0
		? configured
		: 20 * 1024 * 1024 * 1024;
}

export const localMediaCache =
	globalForLocalMedia.localMediaCache ??
	createLocalMediaCache({
		cacheDir:
			process.env.LOCAL_MEDIA_CACHE_DIR ||
			join(process.cwd(), ".local-media-cache"),
		maxBytes: getCacheMaxBytes(),
		resolveSource,
		download: downloadTelegramMedia,
	});

if (process.env.NODE_ENV !== "production") {
	globalForLocalMedia.localMediaCache = localMediaCache;
}
