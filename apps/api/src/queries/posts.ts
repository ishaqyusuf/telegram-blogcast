import type { TRPCContext } from "@api/trpc/init";
import { composeQueryData } from "@api/utils/query-response";
import z from "zod";
import * as __ from "@acme/db";
import type { AlbumType, BlogType } from "@api/type";
/*
posts: publicProcedure
      .input(postsSchema)
      .input|mutation(async (props) => {
        return posts(props.ctx, props.input);
      }),
*/
export const postsSchema = z.object({
  channelId: z.number().optional(),
  q: z.string().optional(),
  cursor: z.union([z.string(), z.number()]).optional(),
  size: z.number().optional(),
  sort: z.string().optional(),
  category: z
    .enum(["all", "audio", "text", "picture", "video", "likes", "saved"])
    .optional(),
});
export type PostsSchema = z.infer<typeof postsSchema>;

const hasContentOrMediaWhere = {
  OR: [
    {
      AND: [{ content: { not: null } }, { content: { not: "" } }],
    },
    {
      medias: {
        some: {
          fileId: {
            not: null,
          },
        },
      },
    },
  ],
};

function hasUsableFile(file?: {
  source?: string | null;
  fileId?: string | null;
  blobUrl?: string | null;
  blobDownloadUrl?: string | null;
} | null) {
  if (!file) return false;

  if (file.source === "vercel_blob") {
    return Boolean(file.blobDownloadUrl || file.blobUrl || file.fileId);
  }

  return Boolean(file.fileId);
}

function hasMediaPayload(
  blog: {
    medias?: {
      mimeType?: string | null;
      file?: {
        source?: string | null;
        fileId?: string | null;
        blobUrl?: string | null;
        blobDownloadUrl?: string | null;
      } | null;
    }[];
  },
  mediaType: "audio" | "image" | "video" | "document",
) {
  return blog.medias?.some((media) => {
    const mimeType = media.mimeType?.toLowerCase() ?? "";
    const matchesType =
      mediaType === "document"
        ? mimeType === "application/pdf" || mimeType.startsWith("document/")
        : mimeType.startsWith(`${mediaType}/`);

    return matchesType && hasUsableFile(media.file);
  });
}

function hasBlogPayload(blog: {
  type?: string | null;
  content?: string | null;
  medias?: {
    mimeType?: string | null;
    file?: {
      source?: string | null;
      fileId?: string | null;
      blobUrl?: string | null;
      blobDownloadUrl?: string | null;
    } | null;
  }[];
}) {
  if (blog.type === "text") return Boolean(blog.content?.trim());
  if (blog.type === "audio") return Boolean(hasMediaPayload(blog, "audio"));
  if (blog.type === "image") return Boolean(hasMediaPayload(blog, "image"));
  if (blog.type === "video") return Boolean(hasMediaPayload(blog, "video"));
  if (blog.type === "pdf" || blog.type === "document") {
    return Boolean(hasMediaPayload(blog, "document"));
  }

  return Boolean(
    blog.content?.trim() ||
      blog.medias?.some((media) => hasUsableFile(media.file)),
  );
}

export async function posts(ctx: TRPCContext, query: PostsSchema) {
  const { db } = ctx;
  const { response, searchMeta, where } = await composeQueryData(
    query,
    wherePosts(query),
    db.blog,
  );
  const data = await db.blog.findMany({
    where,
    ...searchMeta,
    orderBy: [{ blogDate: "desc" }, { createdAt: "desc" }],
    include: {
      medias: {
        include: {
          author: true,
          albumAudioIndex: true,
          album: {
            include: {
              author: true,
            },
          },
          file: true,
          transcript: {
            select: {
              status: true,
              updatedAt: true,
              segments: {
                select: {
                  id: true,
                  startSec: true,
                  endSec: true,
                  text: true,
                },
                where: { status: "done" },
                orderBy: { startSec: "asc" },
                take: 240,
              },
            },
          },
          transcriptionJobs: {
            where: { status: { in: ["queued", "running"] } },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { status: true },
          },
        },
      },
      _count: {
        select: { blogs: true },
      },
      blogTags: {
        include: { tags: { select: { id: true, title: true } } },
        where: { deletedAt: null },
      },
      channel: {
        select: {
          id: true,
          title: true,
          username: true,
        },
      },
    },
  });
  return await response(
    data.filter(hasBlogPayload).map((blog) => {
      const type: BlogType = blog.type as any;
      const serializeFile = (file: any) =>
        file
          ? {
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
            }
          : null;
      const getMediaUrl = (file: any) =>
        file?.source === "vercel_blob"
          ? file.blobDownloadUrl || file.blobUrl
          : null;
      const blogAudio = () => {
        const [media] = blog.medias;
        if (!media || !media.file) return null;
        let displayName = media.file?.fileName;

        if (media.album) {
          const albumType = media.album.albumType as AlbumType;
          if (albumType == "series") {
            displayName = [
              `${media.album.name}
                ${media.albumAudioIndex?.index}`,
            ]
              .filter(Boolean)
              .join(" - ");
          }
        }
        const durationSec = media.file.duration;
        const transcriptSegments =
          media.transcript?.segments?.map((segment) => ({
            id: segment.id,
            startSec: segment.startSec,
            endSec: segment.endSec,
            text: segment.text,
          })) ?? [];
        const transcriptMaxEndSec =
          transcriptSegments[transcriptSegments.length - 1]?.endSec ?? null;
        const isFullyTranscribed =
          media.transcript?.status === "done" &&
          Boolean(durationSec) &&
          transcriptMaxEndSec != null &&
          transcriptMaxEndSec >= durationSec - 3;

        return {
          title: media.title,
          mediaId: media.id,
          source: media.file.source ?? "telegram",
          telegramFileId: media.file.fileId,
          url: getMediaUrl(media.file),
          fileName: media.file?.fileName,
          displayName,
          size: media.file.fileSize,
          duration: media.file.duration,
          authorId: media.album?.albumAuthorId || media.authorId,
          authorName: media.album?.author?.name || media.author?.name,
          albumName: media.album?.name,
          albumId: media.albumId,
          transcriptStatus: media.transcript?.status ?? null,
          transcriptionJobStatus: media.transcriptionJobs[0]?.status ?? null,
          transcriptSegments,
          isTranscribed: isFullyTranscribed,
        };
      };
      const isType = <T>(t: BlogType, fn: T) =>
        t === type
          ? fn
          : ((Array.isArray(fn)
              ? []
              : typeof fn === "object"
                ? {}
                : null) as T);
      const audio = isType("audio", blogAudio());
      return {
        type,
        id: blog.id,
        content: blogContent(type, blog.content),
        caption: blogCaption(type, blog.content),
        date: blog.blogDate,
        audio,
        video: blogVideo(type, blog),
        img: isType(
          "image",
          blog.medias.map(({ file }) => ({
            fileId: file?.fileId,
            source: file?.source ?? "telegram",
            url: getMediaUrl(file),
            file: serializeFile(file),
          })),
        ),
        doc: blogPdf(type, blog),
        media: blog.medias.map((media) => ({
          id: media.id,
          title: media.title,
          mimeType: media.mimeType,
          file: serializeFile(media.file),
          url: getMediaUrl(media.file),
        })),
        tags: blog.blogTags?.map((bt) => bt.tags?.title).filter(Boolean) ?? [],
        channel: blog.channel,
        isBookmarked: false,
        likes: 0,
        coverImageUrl: null,
        artwork: null,
        title: [
          blogCaption(type, blog.content),
          audio?.fileName || audio?.displayName || audio?.title,
        ]
          .filter(Boolean)
          .join(" - "),
        _count: { comments: blog._count?.blogs ?? 0 },
        // images: blog.medias,
      };
    }),
  );
}
function wherePosts(query: PostsSchema) {
  const category = query?.category;
  const q = query?.q?.trim();
  const where = {
    deletedAt: null,
    AND: [hasContentOrMediaWhere],
    ...(query.channelId ? { channelId: query.channelId } : {}),
  } as any;

  if (q) {
    where.AND.push({
      OR: [
        { content: { contains: q, mode: "insensitive" } },
        {
          blogTags: {
            some: {
              tags: { title: { contains: q, mode: "insensitive" } },
            },
          },
        },
        {
          medias: {
            some: {
              OR: [
                { title: { contains: q, mode: "insensitive" } },
                {
                  file: {
                    fileName: {
                      contains: q,
                      mode: "insensitive",
                    },
                  },
                },
                {
                  file: {
                    blobPathname: {
                      contains: q,
                      mode: "insensitive",
                    },
                  },
                },
                {
                  transcript: {
                    segments: {
                      some: {
                        text: {
                          contains: q,
                          mode: "insensitive",
                        },
                      },
                    },
                  },
                },
              ],
            },
          },
        },
      ],
    });
  }

  if (!category || category === "all") {
    return where;
  }

  if (category === "picture") {
    where.type = "image";
    return where;
  }

  if (category === "audio" || category === "text" || category === "video") {
    where.type = category;
    return where;
  }

  if (category === "likes") {
    where.interactions = {
      some: {
        deletedAt: null,
        type: "like",
      },
    };
    return where;
  }

  if (category === "saved") {
    where.blogTags = {
      some: {
        deletedAt: null,
        tags: {
          is: {
            deletedAt: null,
            title: "saved",
          },
        },
      },
    };
    return where;
  }

  return where;
}
function blogContent(type: BlogType, content) {
  if (type == "text") return content;
  return null;
}
function blogCaption(type: BlogType, content) {
  if (type == "text") return null;
  return content;
}
function blogPdf(type: BlogType, blog) {
  if (type == "pdf") {
  }
  return null;
}
function blogVideo(type: BlogType, blog) {
  if (type == "video") {
  }
  return null;
}
function blogImg(type: BlogType, blog) {
  if (type == "image") {
  }
  return null;
}
function blogAudio(type: BlogType, blog) {
  if (type == "audio") {
    const [media] = blog.medias;
    if (!media || !media.file) return null;
    let displayName = media.file?.fileName;

    if (media.album) {
      const albumType = media.album.albumType as AlbumType;
      if (albumType == "series") {
        displayName = [
          `${media.album.name}
                ${media.albumAudioIndex?.index}`,
        ]
          .filter(Boolean)
          .join(" - ");
      }
    }
    return {
      title: media.title,
      mediaId: media.id,
      telegramFileId: media.file.fileId,
      fileName: media.file?.fileName,
      displayName,
      size: media.file.fileSize,
      duration: media.file.duration,
      authorId: media.album?.albumAuthorId || media.authorId,
      authorName: media.album?.author?.name || media.author?.name,
      albumName: media.album?.name,
      albumId: media.albumId,
    };
  }
  return null;
}
