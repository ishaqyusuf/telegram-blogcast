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
  //   q: z.string(),
});
export type PostsSchema = z.infer<typeof postsSchema>;

export async function posts(ctx: TRPCContext, query: PostsSchema) {
  const { db } = ctx;
  const { response, searchMeta, where } = await composeQueryData(
    query,
    wherePosts(query),
    db.blog
  );
  const data = await db.blog.findMany({
    where,
    ...searchMeta,
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
        },
      },
    },
  });
  return await response(
    data.map((blog) => {
      const type: BlogType = blog.type as any;
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
      };
      const isType = <T>(t: BlogType, fn: T) =>
        t === type
          ? fn
          : ((Array.isArray(fn)
              ? []
              : typeof fn === "object"
              ? {}
              : null) as T);
      return {
        type,
        id: blog.id,
        content: blogContent(type, blog.content),
        caption: blogCaption(type, blog.content),
        date: blog.blogDate,
        audio: isType("audio", blogAudio()),
        video: blogVideo(type, blog),
        img: isType(
          "image",
          blog.medias.map(({ file, fileId, title }) => ({
            fileId,
          }))
        ),
        doc: blogPdf(type, blog),
        // images: blog.medias,
      };
    })
  );
}
function wherePosts(query) {
  return {};
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
