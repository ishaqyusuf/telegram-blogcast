import { getWebUrl } from "@/lib/base-url";

export type InternalShareLink =
	| { type: "blog"; id: number; href: string; label: string }
	| { type: "album"; id: number; href: string; label: string };

const INTERNAL_LINK_RE =
	/(?:https?:\/\/(?:[^/\s]+)|alghurobaa(?:-dev|-preview)?:\/\/)?\/?(blog|albums)\/(\d+)/i;

export function getBlogShareUrl(blogId: number | string) {
	return `${getWebUrl()}/blog/${encodeURIComponent(String(blogId))}`;
}

export function getAlbumShareUrl(albumId: number | string) {
	return `${getWebUrl()}/albums/${encodeURIComponent(String(albumId))}`;
}

export function parseInternalShareLink(text?: string | null): InternalShareLink | null {
	const match = (text ?? "").match(INTERNAL_LINK_RE);
	if (!match) return null;

	const id = Number(match[2]);
	if (!Number.isFinite(id) || id <= 0) return null;

	if (match[1].toLowerCase() === "albums") {
		return {
			type: "album",
			id,
			href: `/albums/${id}`,
			label: `Album #${id}`,
		};
	}

	return {
		type: "blog",
		id,
		href: `/blog-view/${id}`,
		label: `Blog post #${id}`,
	};
}
