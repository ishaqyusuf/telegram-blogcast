import { createTRPCRouter, publicProcedure } from "../init";
import { z } from "zod";

export const albumRoutes = createTRPCRouter({
  getAlbums: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.album.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
      include: {
        author: { select: { id: true, name: true, nameAr: true } },
        thumbnail: { include: { file: true } },
        _count: { select: { medias: true } },
      },
    });
  }),

  getAlbum: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.album.findFirstOrThrow({
        where: { id: input.id, deletedAt: null },
        include: {
          author: { select: { id: true, name: true, nameAr: true } },
          thumbnail: { include: { file: true } },
          medias: {
            include: {
              file: true,
              blog: {
                select: {
                  id: true,
                  content: true,
                  type: true,
                  blogDate: true,
                },
              },
              albumAudioIndex: true,
            },
            orderBy: { albumAudioIndex: { index: "asc" } },
          },
        },
      });
    }),

  createAlbum: publicProcedure
    .input(
      z.object({
        name: z.string().min(1),
        albumType: z.string().optional().default("series"),
        authorId: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.album.create({
        data: {
          name: input.name,
          albumType: input.albumType,
          albumAuthorId: input.authorId,
        },
      });
    }),

  addMediaToAlbum: publicProcedure
    .input(
      z.object({
        albumId: z.number(),
        mediaIds: z.array(z.number()).min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;
      // Get current max index in album
      const maxIdx = await db.albumAudioIndex.aggregate({
        where: { albumId: input.albumId },
        _max: { index: true },
      });
      let nextIndex = (maxIdx._max.index ?? 0) + 1;

      const results = await Promise.all(
        input.mediaIds.map(async (mediaId) => {
          // Update media albumId
          await db.media.update({
            where: { id: mediaId },
            data: { albumId: input.albumId },
          });
          // Create or update AlbumAudioIndex
          const existing = await db.albumAudioIndex.findUnique({
            where: { blogAudioId: mediaId },
          });
          if (!existing) {
            await db.albumAudioIndex.create({
              data: {
                albumId: input.albumId,
                blogAudioId: mediaId,
                index: nextIndex++,
              },
            });
          }
          return mediaId;
        })
      );
      return { added: results.length };
    }),

  updateAlbum: publicProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        albumType: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.album.update({
        where: { id },
        data: {
          ...(data.name !== undefined ? { name: data.name } : {}),
          ...(data.description !== undefined ? { description: data.description } : {}),
          ...(data.albumType !== undefined ? { albumType: data.albumType } : {}),
        },
      });
    }),

  // Accepts the full desired order as [{mediaId, index}] and bulk-updates.
  // Client sends the list after user finishes dragging / tapping up-down.
  reorderTracks: publicProcedure
    .input(
      z.object({
        albumId: z.number(),
        order: z.array(z.object({ mediaId: z.number(), index: z.number() })),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;
      await Promise.all(
        input.order.map(({ mediaId, index }) =>
          db.albumAudioIndex.update({
            where: { blogAudioId: mediaId },
            data: { index },
          })
        )
      );
      return { updated: input.order.length };
    }),

  getAuthors: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.author.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true, nameAr: true },
    });
  }),

  createAuthor: publicProcedure
    .input(z.object({ name: z.string().min(1), nameAr: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.author.upsert({
        where: { name: input.name },
        create: { name: input.name, nameAr: input.nameAr },
        update: { nameAr: input.nameAr },
      });
    }),
});
