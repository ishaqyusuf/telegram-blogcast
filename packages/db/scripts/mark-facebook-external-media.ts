import {
	TELEGRAM_BOT_DOWNLOAD_LIMIT_BYTES,
	TELEGRAM_BOT_UPLOAD_LIMIT_BYTES,
	buildTelegramMessageUrl,
} from "@acme/blog/facebook-media";

import { type Prisma, db } from "../src/index";

const args = new Set(process.argv.slice(2));
const execute = args.has("--execute");

function asRecord(value: unknown): Record<string, unknown> {
	if (!value || typeof value !== "object" || Array.isArray(value)) return {};
	return value as Record<string, unknown>;
}

function numberValue(value: unknown) {
	return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function mergeExternalMeta(input: {
	meta: unknown;
	sourceUrl: string;
	fileSize: number;
	fileType: string;
	mimeType: string | null;
	fileName: string | null;
	duration: number | null;
	thumbnailFileId: string | null;
}) {
	const root = asRecord(input.meta);
	const facebook = asRecord(root.facebook);
	const mediaDownload = asRecord(facebook.mediaDownload);
	const messageId = numberValue(mediaDownload.messageId);
	const chatId = mediaDownload.chatId;
	const telegramUrl = buildTelegramMessageUrl(
		typeof chatId === "string" || typeof chatId === "number" ? chatId : null,
		messageId,
	);
	const canOpenTelegram =
		input.fileSize <= TELEGRAM_BOT_UPLOAD_LIMIT_BYTES && Boolean(telegramUrl);
	const destination = canOpenTelegram ? "telegram" : "facebook";

	return {
		...root,
		facebook: {
			...facebook,
			mediaDownload: {
				...mediaDownload,
				status: "external",
				stage: canOpenTelegram ? "telegram_external" : "facebook_external",
				accessMode: "external",
				destination,
				reason:
					input.fileSize > TELEGRAM_BOT_UPLOAD_LIMIT_BYTES
						? "telegram_upload_limit"
						: "telegram_download_limit",
				externalUrl:
					canOpenTelegram && telegramUrl ? telegramUrl : input.sourceUrl,
				mediaType: input.fileType,
				mimeType: input.mimeType,
				fileName: input.fileName,
				fileSize: input.fileSize,
				duration: input.duration,
				thumbnailFileId: input.thumbnailFileId,
				error: null,
			},
		},
	};
}

async function main() {
	const blogs = await db.blog.findMany({
		where: {
			source: "facebook",
			deletedAt: null,
			medias: {
				some: {
					file: { fileSize: { gt: TELEGRAM_BOT_DOWNLOAD_LIMIT_BYTES } },
				},
			},
		},
		select: {
			id: true,
			meta: true,
			sourceUrl: true,
			thumbnail: { select: { file: { select: { fileId: true } } } },
			medias: {
				where: {
					file: { fileSize: { gt: TELEGRAM_BOT_DOWNLOAD_LIMIT_BYTES } },
				},
				orderBy: { id: "asc" },
				take: 1,
				select: {
					file: {
						select: {
							fileSize: true,
							fileType: true,
							mimeType: true,
							fileName: true,
							duration: true,
						},
					},
				},
			},
		},
	});

	const candidates = blogs.flatMap((blog) => {
		const file = blog.medias[0]?.file;
		if (!file?.fileSize || !blog.sourceUrl) return [];
		return [
			{
				blog,
				file,
				meta: mergeExternalMeta({
					meta: blog.meta,
					sourceUrl: blog.sourceUrl,
					fileSize: file.fileSize,
					fileType: file.fileType,
					mimeType: file.mimeType,
					fileName: file.fileName,
					duration: file.duration,
					thumbnailFileId: blog.thumbnail?.file?.fileId ?? null,
				}),
			},
		];
	});

	console.log(
		JSON.stringify(
			{
				mode: execute ? "execute" : "dry-run",
				candidates: candidates.length,
				telegram: candidates.filter(
					({ meta }) =>
						asRecord(asRecord(asRecord(meta).facebook).mediaDownload)
							.destination === "telegram",
				).length,
				facebook: candidates.filter(
					({ meta }) =>
						asRecord(asRecord(asRecord(meta).facebook).mediaDownload)
							.destination === "facebook",
				).length,
				blogIds: candidates.map(({ blog }) => blog.id),
			},
			null,
			2,
		),
	);

	if (!execute) {
		console.log("Dry run only. Re-run with --execute to update metadata.");
		return;
	}

	for (const candidate of candidates) {
		await db.blog.update({
			where: { id: candidate.blog.id },
			data: { meta: candidate.meta as Prisma.InputJsonValue },
		});
	}

	console.log(`Marked ${candidates.length} Facebook media items as external.`);
}

main()
	.catch((error) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(async () => {
		await db.$disconnect();
	});
