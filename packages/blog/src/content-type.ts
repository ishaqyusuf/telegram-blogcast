export const BLOG_CONTENT_TYPES = [
	"text",
	"image",
	"video",
	"audio",
	"pdf",
] as const;

export type BlogContentType = (typeof BLOG_CONTENT_TYPES)[number];

export type BlogMediaContentTypeInput = {
	mimeType?: string | null;
	title?: string | null;
	file?: {
		mimeType?: string | null;
		fileName?: string | null;
		blobContentType?: string | null;
		blobPathname?: string | null;
	} | null;
};

function normalizeValue(value?: string | null) {
	return value?.trim().toLowerCase() ?? "";
}

export function inferBlogMediaContentType(
	media: BlogMediaContentTypeInput | null | undefined,
): BlogContentType {
	if (!media) return "text";

	const mimeTypes = [
		media.mimeType,
		media.file?.mimeType,
		media.file?.blobContentType,
	].map(normalizeValue);
	const names = [
		media.title,
		media.file?.fileName,
		media.file?.blobPathname,
	].map(normalizeValue);

	if (
		mimeTypes.some(
			(value) => value === "application/pdf" || value.startsWith("document/"),
		) ||
		names.some((value) => value.endsWith(".pdf"))
	) {
		return "pdf";
	}
	if (mimeTypes.some((value) => value.startsWith("audio/"))) return "audio";
	if (mimeTypes.some((value) => value.startsWith("image/"))) return "image";
	if (mimeTypes.some((value) => value.startsWith("video/"))) return "video";
	return "text";
}
