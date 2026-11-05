import type { BlogItem } from "@/components/blog-card/types";
import {
	getFacebookExternalMedia,
	isExplicitFacebookVideoUrl,
} from "@acme/blog/facebook-media";
export type SearchPage = {
	data: SearchResultItem[];
	meta: {
		allCount: number | null;
		cursor: number | null;
		totalCount: number | null;
		typeCounts: { type: string; count: number }[];
	};
};

export type SearchResultItem = {
	id: number;
	content?: string | null;
	type?: string | null;
	source?: string | null;
	sourceUrl?: string | null;
	meta?: unknown;
	blogDate?: Date | string | null;
	thumbnail?: { file?: SearchMedia["file"] | null } | null;
	medias?: SearchMedia[];
	blogTags?: SearchBlogTag[];
	channel?: {
		id?: number | null;
		title?: string | null;
		username?: string | null;
	} | null;
};

type SearchBlogTag = {
	tags?: {
		title?: string | null;
	} | null;
};

export type RecentSearch = {
	id?: number | string | null;
	searchTerm: string;
};

export type SearchTag =
	| string
	| {
			id?: number | string | null;
			title?: string | null;
	  };

type SearchMedia = {
	id?: number | null;
	title?: string | null;
	titleOverride?: string | null;
	mimeType?: string | null;
	url?: string | null;
	file?: {
		source?: string | null;
		fileId?: string | null;
		fileUniqueId?: string | null;
		fileName?: string | null;
		fileSize?: number | null;
		mimeType?: string | null;
		duration?: number | null;
		blobUrl?: string | null;
		blobDownloadUrl?: string | null;
		blobPathname?: string | null;
		blobContentType?: string | null;
	} | null;
	transcript?: {
		status?: string | null;
		segments?: {
			id?: number | string | null;
			startSec?: number | null;
			endSec?: number | null;
			text?: string | null;
		}[];
	} | null;
	transcriptionJobs?: { status?: string | null }[];
	album?: {
		id?: number | null;
		name?: string | null;
	} | null;
	albumId?: number | null;
	albumAudioIndex?: {
		index?: number | null;
	} | null;
};

export type KeywordSuggestion = {
	keyword: string;
	source?: string | null;
};

function getBlogTags(item: SearchResultItem) {
	return (
		item.blogTags?.map((blogTag) => blogTag.tags?.title).filter(Boolean) ?? []
	);
}

function getMediaUrl(file?: SearchMedia["file"] | null) {
	if (!file) return null;
	return file.source === "vercel_blob"
		? file.blobDownloadUrl || file.blobUrl || null
		: null;
}

function serializeFile(file?: SearchMedia["file"] | null) {
	if (!file) return null;

	return {
		source: file.source ?? "telegram",
		fileId: file.fileId,
		fileUniqueId: file.fileUniqueId,
		fileName: file.fileName,
		fileSize: file.fileSize,
		mimeType: file.mimeType,
		blobUrl: file.blobUrl,
		blobDownloadUrl: file.blobDownloadUrl,
		blobPathname: file.blobPathname,
		blobContentType: file.blobContentType,
	};
}

function mediaMatchesType(media: SearchMedia, type: "audio" | "image") {
	const mimeType = (media.mimeType || media.file?.mimeType || "").toLowerCase();
	return mimeType.startsWith(`${type}/`);
}

function resolveSearchBlogType(
	item: SearchResultItem,
	hasExternalMedia: boolean,
): BlogItem["type"] {
	const type = (item.type || "text") as BlogItem["type"];
	if (
		type !== "video" ||
		item.source !== "facebook" ||
		!hasExternalMedia ||
		!item.content?.trim()
	) {
		return type;
	}

	const hasPlayableVideo = item.medias?.some((media) => {
		const mimeType = (
			media.mimeType ||
			media.file?.mimeType ||
			""
		).toLowerCase();
		const hasFile = Boolean(
			media.file?.fileId ||
				media.file?.blobDownloadUrl ||
				media.file?.blobUrl ||
				media.url,
		);
		return mimeType.startsWith("video/") && hasFile;
	});

	if (hasPlayableVideo || isExplicitFacebookVideoUrl(item.sourceUrl)) {
		return type;
	}

	// Generic Facebook post URLs can be misidentified as videos by preview
	// metadata. Without a playable video payload, preserve the saved post as
	// readable text with its preview image.
	return "text";
}

export function toBlogCardPost(
	item: SearchResultItem,
	localAlbumMembership?: Map<number, { id: number; name: string }>,
): BlogItem {
	const sourceType = (item.type || "text") as BlogItem["type"];
	const medias = item.medias ?? [];
	const audioMedia =
		medias.find((media) => mediaMatchesType(media, "audio")) ?? medias[0];
	const audioFile = audioMedia?.file;
	const localAlbum =
		audioMedia?.id != null ? localAlbumMembership?.get(audioMedia.id) : null;
	const mediaAlbum = localAlbum
		? { id: localAlbum.id, name: localAlbum.name }
		: audioMedia?.album;
	const transcriptSegments =
		audioMedia?.transcript?.segments?.map((segment) => ({
			id: segment.id ?? `${segment.startSec ?? 0}-${segment.endSec ?? 0}`,
			startSec: segment.startSec ?? 0,
			endSec: segment.endSec ?? segment.startSec ?? 0,
			text: segment.text ?? "",
		})) ?? [];
	const transcriptMaxEndSec =
		transcriptSegments[transcriptSegments.length - 1]?.endSec ?? null;
	const durationSec = audioFile?.duration ?? null;
	const externalMedia = getFacebookExternalMedia({
		source: item.source,
		sourceUrl: item.sourceUrl,
		meta: item.meta,
		fileSize: audioFile?.fileSize,
		mediaType: audioFile?.mimeType?.split("/")[0] ?? sourceType,
		mimeType: audioFile?.mimeType ?? audioMedia?.mimeType,
		fileName: audioFile?.fileName,
		duration: durationSec,
		thumbnailFileId: item.thumbnail?.file?.fileId,
	});
	const type = resolveSearchBlogType(item, Boolean(externalMedia));
	const isFullyTranscribed =
		audioMedia?.transcript?.status === "done" &&
		Boolean(durationSec) &&
		transcriptMaxEndSec != null &&
		transcriptMaxEndSec >= (durationSec ?? 0) - 3;
	const caption = type === "text" ? null : (item.content ?? null);
	const audio =
		type === "audio" && audioMedia
			? {
					title: audioMedia.title,
					titleOverride: audioMedia.titleOverride,
					mediaId: audioMedia.id ?? undefined,
					source: audioFile?.source ?? "telegram",
					telegramFileId: externalMedia ? null : audioFile?.fileId,
					url: getMediaUrl(audioFile) ?? audioMedia.url ?? null,
					fileName: audioFile?.fileName,
					displayName: audioFile?.fileName,
					size: audioFile?.fileSize,
					duration: durationSec,
					authorId: undefined,
					authorName: undefined,
					albumName: mediaAlbum?.name ?? undefined,
					albumId: mediaAlbum?.id ?? audioMedia.albumId ?? undefined,
					albumTrackIndex: audioMedia.albumAudioIndex?.index ?? undefined,
					transcriptStatus: audioMedia.transcript?.status ?? null,
					transcriptionJobStatus:
						audioMedia.transcriptionJobs?.[0]?.status ?? null,
					transcriptSegments,
					isTranscribed: isFullyTranscribed,
					externalUrl: externalMedia?.externalUrl ?? null,
					externalDestination: externalMedia?.destination ?? null,
				}
			: null;

	return {
		id: item.id,
		type,
		source: item.source,
		sourceUrl: item.sourceUrl,
		externalMedia,
		content: type === "text" ? (item.content ?? null) : null,
		caption,
		date: item.blogDate ? new Date(item.blogDate) : null,
		audio,
		video: null,
		img:
			type === "image"
				? medias
						.filter((media) => mediaMatchesType(media, "image"))
						.map((media) => ({
							fileId: media.file?.fileId,
							source: media.file?.source ?? "telegram",
							url: getMediaUrl(media.file),
							file: serializeFile(media.file),
						}))
				: [],
		doc: null,
		media: medias.map((media) => ({
			id: media.id,
			title: media.title,
			mimeType: media.mimeType,
			file: serializeFile(media.file),
			url: getMediaUrl(media.file) ?? media.url ?? null,
		})),
		tags: getBlogTags(item),
		channel: item.channel,
		isBookmarked: false,
		likes: 0,
		coverImageUrl: getMediaUrl(item.thumbnail?.file),
		coverImageFile: serializeFile(item.thumbnail?.file),
		artwork: null,
		title: [caption, audio?.fileName || audio?.displayName || audio?.title]
			.filter(Boolean)
			.join(" - "),
		_count: { comments: 0 },
	} as BlogItem;
}
