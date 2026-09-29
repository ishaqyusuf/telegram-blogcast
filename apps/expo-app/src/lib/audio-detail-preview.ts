import type { BlogItem } from "@/components/blog-card/types";
import type { RouterOutputs } from "@api/trpc/routers/_app";

type AudioDetail = RouterOutputs["blog"]["getBlog"];

const previews = new Map<number, AudioDetail>();
const MAX_PREVIEWS = 40;

export function getAudioDetailPreview(blogId: number) {
	return previews.get(blogId);
}

function rememberPreview(blogId: number, preview: AudioDetail) {
	previews.delete(blogId);
	previews.set(blogId, preview);
	if (previews.size > MAX_PREVIEWS) {
		const oldest = previews.keys().next().value;
		if (oldest !== undefined) previews.delete(oldest);
	}
}

/** Feed metadata is enough to render the player while getBlog refreshes. */
export function rememberAudioDetailFromPost(post: BlogItem) {
	const audio = post.audio as Record<string, unknown> | null;
	if (post.type !== "audio" || !audio || typeof audio.mediaId !== "number") return;
	if ((post as any).externalMedia?.externalUrl) return;
	const sourceMedia = (post.media as any[] | undefined)?.find(
		(item) => item.id === audio.mediaId,
	);
	const file = sourceMedia?.file ?? {
		fileName: audio.fileName,
		fileSize: audio.size,
		duration: audio.duration,
		fileId: audio.telegramFileId,
		source: audio.source ?? "telegram",
		blobDownloadUrl: audio.source === "vercel_blob" ? audio.url : null,
		mimeType: "audio/mpeg",
	};
	if (!file?.fileName) return;
	const channel = (post as any).channel ?? null;
	const preview = {
		id: post.id,
		type: "audio",
		content: post.caption ?? post.content ?? null,
		blogDate: post.date ?? null,
		channelId: channel?.id ?? null,
		channel,
		medias: [{
			...sourceMedia,
			id: audio.mediaId,
			title: audio.title ?? sourceMedia?.title ?? null,
			titleOverride: audio.titleOverride ?? sourceMedia?.titleOverride ?? null,
			file,
			transcriptStatus: audio.transcriptStatus ?? null,
			transcript: Array.isArray(audio.transcriptSegments)
				? { status: audio.transcriptStatus ?? null, segments: audio.transcriptSegments }
				: null,
			albumId: audio.albumId ?? null,
			album: audio.albumId ? { id: audio.albumId, name: audio.albumName ?? "Album" } : null,
		}],
		thumbnail: (post as any).coverImageFile
			? { file: (post as any).coverImageFile }
			: null,
		blogTags: (post.tags ?? []).map((title) => ({ tags: { title } })),
		source: (post as any).source ?? null,
		sourceUrl: (post as any).sourceUrl ?? null,
		blogs: [],
	} as unknown as AudioDetail;
	rememberPreview(post.id, preview);
}

export function rememberAudioDetailFromMedia(media: any, album?: any) {
	const blog = media?.blog;
	const file = media?.file;
	if (!blog?.id || !media?.id || !file?.fileName) return;
	rememberPreview(blog.id, {
		id: blog.id,
		type: "audio",
		content: blog.content ?? null,
		blogDate: blog.blogDate ?? null,
		channelId: blog.channelId ?? album?.channelId ?? null,
		channel: blog.channel ?? album?.channel ?? null,
		medias: [{
			...media,
			file,
			albumId: media.albumId ?? album?.id ?? null,
			album: media.album ?? (album ? { id: album.id, name: album.name } : null),
		}],
		thumbnail: blog.thumbnail ?? null,
		blogTags: blog.blogTags ?? [],
		blogs: [],
	} as unknown as AudioDetail);
}
