import { db } from "@acme/db";
import { formatDistanceToNow } from "date-fns";
import { ArrowLeft, FileText, Music2 } from "lucide-react";
import Link from "next/link";

function initials(name: string) {
    return (
        name
            .split(" ")
            .filter(Boolean)
            .slice(0, 2)
            .map((part) => part[0]?.toUpperCase())
            .join("") || "AL"
    );
}

function formatWhen(date?: Date | null) {
    if (!date) return "unknown";
    return formatDistanceToNow(date, { addSuffix: true });
}

function fileUrl(file?: {
    source?: string | null;
    fileId?: string | null;
    blobDownloadUrl?: string | null;
    blobUrl?: string | null;
}) {
    if (!file) return null;
    if (file.source === "vercel_blob") return file.blobDownloadUrl || file.blobUrl;
    return file.fileId ? `/api/telegram/file/${encodeURIComponent(file.fileId)}` : null;
}

export default async function AlbumsPage() {
    const albums = await db.album.findMany({
        where: { deletedAt: null },
        include: {
            author: { select: { name: true, nameAr: true } },
            channel: { select: { title: true, username: true } },
            thumbnail: {
                include: {
                    file: {
                        select: {
                            source: true,
                            fileId: true,
                            blobDownloadUrl: true,
                            blobUrl: true,
                        },
                    },
                },
            },
            _count: { select: { medias: true } },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });

    return (
        <main className="min-h-screen bg-background text-foreground">
            <div className="mx-auto w-full max-w-3xl pb-16">
                <header className="sticky top-0 z-20 border-b border-border bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                            <Link
                                href="/blog"
                                aria-label="Back to blog"
                                className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-card transition-colors hover:bg-muted"
                            >
                                <ArrowLeft size={18} />
                            </Link>
                            <div className="min-w-0">
                                <h1 className="text-2xl font-semibold tracking-normal">
                                    Albums
                                </h1>
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                    {albums.length} collections
                                </p>
                            </div>
                        </div>
                        <Link
                            href="/transcription-queue"
                            aria-label="Open transcription queue"
                            className="inline-flex size-10 items-center justify-center rounded-full border border-border bg-card transition-colors hover:bg-muted"
                        >
                            <FileText size={18} />
                        </Link>
                    </div>
                </header>

                {albums.length === 0 ? (
                    <section className="px-6 py-16 text-center">
                        <Music2 className="mx-auto text-muted-foreground" size={30} />
                        <h2 className="mt-4 text-lg font-semibold">No albums yet</h2>
                        <p className="mt-2 text-sm text-muted-foreground">
                            Add audio items to albums from the blog feed.
                        </p>
                    </section>
                ) : (
                    <section className="grid gap-3 p-4 sm:grid-cols-2">
                        {albums.map((album) => {
                            const thumb = fileUrl(album.thumbnail?.file);
                            const meta = [
                                album.author?.nameAr || album.author?.name,
                                album.channel?.title || album.channel?.username,
                                formatWhen(album.createdAt),
                            ].filter(Boolean);

                            return (
                                <Link
                                    key={album.id}
                                    href={`/albums/${album.id}`}
                                    className="group overflow-hidden rounded-lg border border-border bg-card transition-colors hover:bg-muted/45"
                                >
                                    <div className="aspect-[16/9] bg-muted">
                                        {thumb ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img
                                                src={thumb}
                                                alt={album.name}
                                                className="h-full w-full object-cover"
                                                loading="lazy"
                                            />
                                        ) : (
                                            <div className="flex h-full items-center justify-center bg-primary/10 text-3xl font-bold text-primary">
                                                {initials(album.name)}
                                            </div>
                                        )}
                                    </div>
                                    <div className="p-3">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <h2 className="truncate text-base font-semibold group-hover:text-primary">
                                                    {album.name}
                                                </h2>
                                                <p className="mt-1 truncate text-xs text-muted-foreground">
                                                    {meta.join(" · ")}
                                                </p>
                                            </div>
                                            <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                                                {album._count.medias}
                                            </span>
                                        </div>
                                    </div>
                                </Link>
                            );
                        })}
                    </section>
                )}
            </div>
        </main>
    );
}
