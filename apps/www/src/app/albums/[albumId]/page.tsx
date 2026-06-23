import { db } from "@acme/db";
import { format } from "date-fns";
import { ArrowLeft, Music2, PlayCircle } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

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

function formatDuration(seconds?: number | null) {
    if (!seconds || seconds <= 0) return null;
    const total = Math.round(seconds);
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const remaining = total % 60;
    if (hours > 0) {
        return `${hours}:${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;
    }
    return `${minutes}:${String(remaining).padStart(2, "0")}`;
}

function formatDate(date?: Date | null) {
    if (!date) return null;
    const now = new Date();
    const pattern = date.getFullYear() === now.getFullYear() ? "MMM d" : "MMM d, yyyy";
    return format(date, pattern);
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

export default async function AlbumDetailPage({
    params,
}: {
    params: Promise<{ albumId: string }> | { albumId: string };
}) {
    const { albumId } = await params;
    const id = Number(albumId);
    if (!Number.isFinite(id)) notFound();

    const album = await db.album.findFirst({
        where: { id, deletedAt: null },
        include: {
            author: { select: { name: true, nameAr: true } },
            channel: { select: { title: true, username: true } },
            medias: {
                include: {
                    file: {
                        select: {
                            source: true,
                            fileId: true,
                            fileName: true,
                            duration: true,
                            fileSize: true,
                            blobDownloadUrl: true,
                            blobUrl: true,
                        },
                    },
                    blog: {
                        select: {
                            id: true,
                            content: true,
                            blogDate: true,
                            channel: {
                                select: {
                                    title: true,
                                    username: true,
                                },
                            },
                        },
                    },
                    transcript: {
                        select: {
                            status: true,
                        },
                    },
                    albumAudioIndex: true,
                },
                orderBy: [{ albumAudioIndex: { index: "asc" } }, { id: "asc" }],
            },
        },
    });

    if (!album) notFound();

    const meta = [
        album.author?.nameAr || album.author?.name,
        album.channel?.title || album.channel?.username,
        album.albumType,
    ].filter(Boolean);

    return (
        <main className="min-h-screen bg-background text-foreground">
            <div className="mx-auto w-full max-w-3xl pb-16">
                <header className="sticky top-0 z-20 border-b border-border bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                    <div className="flex items-center gap-3">
                        <Link
                            href="/albums"
                            aria-label="Back to albums"
                            className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-card transition-colors hover:bg-muted"
                        >
                            <ArrowLeft size={18} />
                        </Link>
                        <div className="min-w-0">
                            <h1 className="truncate text-2xl font-semibold tracking-normal">
                                {album.name}
                            </h1>
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                {album.medias.length} tracks
                                {meta.length ? ` · ${meta.join(" · ")}` : ""}
                            </p>
                        </div>
                    </div>
                </header>

                <section className="border-b border-border px-4 py-5">
                    <div className="flex items-start gap-4">
                        <div className="flex size-20 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xl font-bold text-primary">
                            {initials(album.name)}
                        </div>
                        <div className="min-w-0 flex-1">
                            <h2 className="text-lg font-semibold">{album.name}</h2>
                            {album.description ? (
                                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                    {album.description}
                                </p>
                            ) : null}
                        </div>
                    </div>
                </section>

                {album.medias.length === 0 ? (
                    <section className="px-6 py-16 text-center">
                        <Music2 className="mx-auto text-muted-foreground" size={30} />
                        <h2 className="mt-4 text-lg font-semibold">No tracks yet</h2>
                        <p className="mt-2 text-sm text-muted-foreground">
                            Add audio from the blog feed to build this album.
                        </p>
                    </section>
                ) : (
                    <section>
                        {album.medias.map((media, index) => {
                            const title =
                                media.title ||
                                media.file?.fileName ||
                                media.blog?.content ||
                                `Track ${index + 1}`;
                            const date = formatDate(media.blog?.blogDate);
                            const duration = formatDuration(media.file?.duration);
                            const source = fileUrl(media.file);
                            const channel =
                                media.blog?.channel?.title ||
                                media.blog?.channel?.username ||
                                "Unknown channel";

                            return (
                                <article
                                    key={media.id}
                                    className="flex items-center gap-3 border-b border-border px-4 py-3"
                                >
                                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                                        {media.albumAudioIndex?.index ?? index + 1}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <h2 className="line-clamp-2 text-sm font-semibold">
                                            {media.blog?.id ? (
                                                <Link
                                                    href={`/blog/${media.blog.id}`}
                                                    className="hover:text-primary"
                                                >
                                                    {title}
                                                </Link>
                                            ) : (
                                                title
                                            )}
                                        </h2>
                                        <p className="mt-1 truncate text-xs text-muted-foreground">
                                            {[channel, date, duration].filter(Boolean).join(" · ")}
                                        </p>
                                    </div>
                                    {media.transcript?.status ? (
                                        <span className="hidden rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary sm:inline-flex">
                                            {media.transcript.status}
                                        </span>
                                    ) : null}
                                    {source ? (
                                        <a
                                            href={source}
                                            aria-label={`Play ${title}`}
                                            className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors hover:bg-primary/15"
                                        >
                                            <PlayCircle size={20} />
                                        </a>
                                    ) : null}
                                </article>
                            );
                        })}
                    </section>
                )}
            </div>
        </main>
    );
}
