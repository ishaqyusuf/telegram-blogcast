import type { Database } from "@acme/db";
import { TRPCError } from "@trpc/server";
import { canExportBookContent } from "./book-content-policy";

export async function readBookPageRecord(db: Database, pageId: number, sourcePageNo: (url: string) => number | null) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const page = await readBookPageAttempt(db, pageId, sourcePageNo);
    const current = await db.bookPage.findFirstOrThrow({ where: { id: pageId, deletedAt: null }, select: { rawJson: true } });
    // Keep parallel relation reads, but never cache paragraphs paired with an older version.
    if (JSON.stringify(current.rawJson) === JSON.stringify(page.rawJson)) return page;
  }
  throw new TRPCError({ code: "CONFLICT", message: "Page content is changing. Please retry." });
}

async function readBookPageAttempt(db: Database, pageId: number, sourcePageNo: (url: string) => number | null) {
  const page = await db.bookPage.findFirstOrThrow({ where: { id: pageId, deletedAt: null } });
  const previousPageNo = page.previousShamelaPageNo ?? (page.previousShamelaUrl ? sourcePageNo(page.previousShamelaUrl) : null);
  const nextPageNo = page.nextShamelaPageNo ?? (page.nextShamelaUrl ? sourcePageNo(page.nextShamelaUrl) : null);
  const adjacentNumbers = [previousPageNo, nextPageNo].filter((value): value is number => typeof value === "number");
  // These independent relations otherwise require sequential remote DB trips.
  const [paragraphs, footnotes, highlights, audioReferences, comments, volume, book, adjacentRows] = await Promise.all([
    db.bookPageParagraph.findMany({ where: { pageId }, orderBy: { pid: "asc" } }),
    db.bookPageFootnote.findMany({ where: { pageId }, orderBy: { marker: "asc" } }),
    db.bookPageHighlight.findMany({ where: { pageId }, orderBy: { startOffset: "asc" } }),
    db.mediaBookPageReference.findMany({
      where: { pageId, deletedAt: null },
      include: { media: { select: {
        id: true, title: true,
        file: { select: { id: true, fileName: true, duration: true } },
        album: { select: { id: true, name: true } },
        blog: { select: { id: true, content: true } },
      } } },
    }),
    db.bookPageComment.findMany({ where: { pageId, deletedAt: null }, orderBy: { createdAt: "asc" } }),
    page.volumeId == null ? null : db.bookVolume.findUnique({ where: { id: page.volumeId }, select: { id: true, number: true, title: true } }),
    db.book.findUniqueOrThrow({ where: { id: page.bookId }, select: { id: true, sourceType: true, editable: true, ownerUserId: true, shamelaId: true, shamelaUrl: true, blog: { select: { published: true } } } }),
    adjacentNumbers.length ? db.bookPage.findMany({
      where: { bookId: page.bookId, shamelaPageNo: { in: adjacentNumbers }, deletedAt: null },
      select: { id: true, shamelaPageNo: true, shamelaUrl: true, status: true },
    }) : [],
  ]);
  const adjacent = new Map(adjacentRows.map((row) => [row.shamelaPageNo, row] as const));
  const { blog, ...bookIdentity } = book;
  return { ...page, paragraphs, footnotes, highlights, audioReferences, comments, volume, book: bookIdentity,
    contentExportable: canExportBookContent(book),
    adjacentPages: {
      previous: { shamelaPageNo: previousPageNo, shamelaUrl: page.previousShamelaUrl ?? null, page: previousPageNo ? adjacent.get(previousPageNo) ?? null : null },
      next: { shamelaPageNo: nextPageNo, shamelaUrl: page.nextShamelaUrl ?? null, page: nextPageNo ? adjacent.get(nextPageNo) ?? null : null },
    },
  };
}
