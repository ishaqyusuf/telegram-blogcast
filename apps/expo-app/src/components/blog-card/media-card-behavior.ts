type BlogCardTarget = {
  id: number;
  type?: string | null;
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
  if (post.type === "text") return `/blog-view-text/${post.id}`;
  if (post.type === "audio") return `/blog-view-2/${post.id}`;
  if (post.type === "video") {
    return `/blog-view/${post.id}?contentType=video`;
  }
  if (post.type === "pdf") {
    return `/blog-view/${post.id}?contentType=pdf`;
  }
  return `/blog-view/${post.id}`;
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
