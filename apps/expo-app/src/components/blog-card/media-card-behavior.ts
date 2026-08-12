import { isExplicitFacebookVideoUrl } from "@acme/blog/facebook-media";

type BlogCardTarget = {
  id: number;
  type?: string | null;
  sourceUrl?: string | null;
  content?: string | null;
  caption?: string | null;
  externalMedia?: { externalUrl?: string | null } | null;
  video?: {
    telegramFileId?: string | number | null;
    url?: string | null;
  } | null;
};

type BlogCardImageSource = {
  coverImageUrl?: string | null;
  coverImageFile?: unknown;
  externalMedia?: {
    thumbnailFileId?: string | number | null;
  } | null;
  video?: {
    thumbnailFile?: unknown;
    thumbnailFileId?: string | number | null;
  } | null;
  img?: {
    url?: string | null;
    file?: unknown;
    fileId?: string | number | null;
  }[] | null;
};

export function getBlogHref(post: BlogCardTarget) {
  const presentationType = getBlogPresentationType(post);
  if (presentationType === "text") return `/blog-view-text/${post.id}`;
  if (presentationType === "audio") return `/blog-view-2/${post.id}`;
  if (presentationType === "video") {
    return `/blog-view/${post.id}?contentType=video`;
  }
  if (presentationType === "pdf") {
    return `/blog-view/${post.id}?contentType=pdf`;
  }
  return `/blog-view/${post.id}`;
}

export function getBlogPresentationType(post: BlogCardTarget) {
  if (post.type !== "video") return post.type;

  const isExternalPreview = Boolean(post.externalMedia?.externalUrl);
  const hasPlayableVideo = Boolean(
    post.video?.telegramFileId || post.video?.url,
  );
  const hasReadableText = Boolean(post.content?.trim() || post.caption?.trim());
  if (
    isExternalPreview &&
    !hasPlayableVideo &&
    hasReadableText &&
    !isExplicitFacebookVideoUrl(post.sourceUrl)
  ) {
    return "text";
  }

  return post.type;
}

export function getPrimaryImageSource(post: BlogCardImageSource) {
  if (post.coverImageUrl) {
    return { url: post.coverImageUrl, file: null, telegramFileId: null };
  }
  if (post.coverImageFile) {
    return { url: null, file: post.coverImageFile, telegramFileId: null };
  }
  if (post.video?.thumbnailFile) {
    return { url: null, file: post.video.thumbnailFile, telegramFileId: null };
  }

  const thumbnailFileId =
    post.externalMedia?.thumbnailFileId ?? post.video?.thumbnailFileId;
  if (thumbnailFileId) {
    return { url: null, file: null, telegramFileId: thumbnailFileId };
  }

  const firstImage = post.img?.[0];
  return {
    url: firstImage?.url ?? null,
    file: firstImage?.file ?? null,
    telegramFileId: firstImage?.fileId ?? null,
  };
}
