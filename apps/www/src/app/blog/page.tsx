import { db } from "@acme/db";
import { formatDistanceToNow } from "date-fns";
import { Space_Grotesk, IBM_Plex_Sans_Arabic } from "next/font/google";

const headingFont = Space_Grotesk({
    subsets: ["latin"],
    weight: ["500", "700"],
});

const bodyFont = IBM_Plex_Sans_Arabic({
    subsets: ["latin", "arabic"],
    weight: ["400", "500", "600"],
});

type BlogCardItem = {
    id: number;
    content: string | null;
    blogDate: Date | null;
    publishedAt: Date | null;
    channelName: string;
    channelUsername: string;
    audioSrc: string | null;
    imageSrc: string | null;
    imageAlt: string;
    mimeType: string | null;
};

function buildTelegramFileProxy(fileId: string | null | undefined) {
    if (!fileId) return null;
    return `/api/telegram/file/${encodeURIComponent(fileId)}`;
}

function pickAudioMedia(
    medias: Array<{
        mimeType: string;
        file: { fileId: string } | null;
    }>,
) {
    const media = medias.find(
        (m) => m.file?.fileId && m.mimeType?.toLowerCase().startsWith("audio/"),
    );
    return buildTelegramFileProxy(media?.file?.fileId);
}

function pickImageMedia(
    medias: Array<{
        mimeType: string;
        title: string | null;
        file: { fileId: string } | null;
    }>,
) {
    const media = medias.find(
        (m) => m.file?.fileId && m.mimeType?.toLowerCase().startsWith("image/"),
    );
    return {
        src: buildTelegramFileProxy(media?.file?.fileId),
        alt: media?.title ?? "Blog image",
        mimeType: media?.mimeType ?? null,
    };
}

function formatPostTime(date: Date | null) {
    if (!date) return "unknown date";
    return formatDistanceToNow(date, { addSuffix: true });
}

function isArabicLine(text: string) {
    return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(text);
}

async function getBlogFeed(): Promise<BlogCardItem[]> {
    const rows = await db.blog.findMany({
        where: {
            deletedAt: null,
            published: true,
        },
        include: {
            channel: {
                select: {
                    title: true,
                    username: true,
                },
            },
            medias: {
                where: {
                    // deletedAt: null,
                },
                include: {
                    file: {
                        select: {
                            fileId: true,
                        },
                    },
                },
            },
        },
        orderBy: [{ blogDate: "desc" }, { createdAt: "desc" }],
        take: 80,
    });

    return rows.map((row) => {
        const image = pickImageMedia(row.medias);
        return {
            id: row.id,
            content: row.content,
            blogDate: row.blogDate,
            publishedAt: row.publishedAt,
            channelName:
                row.channel?.title ?? `@${row.channel?.username ?? "channel"}`,
            channelUsername: row.channel?.username ?? "unknown",
            audioSrc: pickAudioMedia(row.medias),
            imageSrc: image.src,
            imageAlt: image.alt,
            mimeType: image.mimeType,
        };
    });
}

export default async function BlogPage() {
    const posts = await getBlogFeed();

    return (
        <main
            className={[
                "min-h-screen text-zinc-100",
                "bg-[radial-gradient(110%_90%_at_12%_0%,#203027_0%,#09090b_48%),linear-gradient(180deg,#09090b_0%,#0f1115_100%)]",
                bodyFont.className,
            ].join(" ")}
        >
            <div className="mx-auto w-full max-w-3xl px-3 pb-20 pt-4 sm:px-6">
                <header className="sticky top-3 z-20 rounded-2xl border border-zinc-800/80 bg-zinc-950/80 px-4 py-3 backdrop-blur">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="text-[11px] uppercase tracking-[0.22em] text-emerald-400">
                                Blog Stream
                            </p>
                            <h1
                                className={`${headingFont.className} text-xl font-semibold text-white sm:text-2xl`}
                            >
                                Spotify mood. X timeline pace.
                            </h1>
                        </div>
                        <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 px-3 py-1 text-right">
                            <p className="text-[10px] uppercase tracking-wide text-zinc-500">
                                posts
                            </p>
                            <p className="text-lg font-semibold leading-none text-emerald-300">
                                {posts.length}
                            </p>
                        </div>
                    </div>
                </header>

                {posts.length === 0 ? (
                    <section className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8 text-center">
                        <h2
                            className={`${headingFont.className} text-xl font-semibold text-zinc-100`}
                        >
                            No published blog posts yet
                        </h2>
                        <p className="mt-2 text-sm text-zinc-400">
                            Once data lands in Prisma Blog, this feed will
                            render text, image, and audio cards automatically.
                        </p>
                    </section>
                ) : (
                    <section className="mt-5 space-y-4">
                        {posts.map((post) => {
                            const hasImage = !!post.imageSrc;
                            const hasAudio = !!post.audioSrc;
                            const hasText = !!post.content?.trim();
                            const variant = hasAudio
                                ? "audio"
                                : hasImage && hasText
                                  ? "text+image"
                                  : hasImage
                                    ? "image"
                                    : "text";

                            return (
                                <article
                                    key={post.id}
                                    className="group overflow-hidden rounded-2xl border border-zinc-800/90 bg-[linear-gradient(150deg,#18181b_0%,#111827_45%,#0a0a0a_100%)] shadow-[0_12px_30px_rgba(0,0,0,0.28)]"
                                >
                                    <div className="flex items-start justify-between gap-3 px-4 pb-2 pt-4">
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-semibold text-zinc-100">
                                                {post.channelName}
                                            </p>
                                            <p className="truncate text-xs text-zinc-500">
                                                @{post.channelUsername} ·{" "}
                                                {formatPostTime(
                                                    post.blogDate ??
                                                        post.publishedAt,
                                                )}
                                            </p>
                                        </div>
                                        <span className="rounded-full border border-zinc-700/80 bg-zinc-900/70 px-2.5 py-1 text-[10px] uppercase tracking-wide text-emerald-300">
                                            {variant}
                                        </span>
                                    </div>

                                    {hasImage && (
                                        <div className="px-4 pb-3">
                                            <div className="overflow-hidden rounded-xl border border-zinc-800">
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img
                                                    src={post.imageSrc!}
                                                    alt={post.imageAlt}
                                                    className="h-auto max-h-[420px] w-full object-cover transition-transform duration-300 group-hover:scale-[1.01]"
                                                    loading="lazy"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {hasText && (
                                        <div className="px-4 pb-4">
                                            <div className="space-y-1 text-[15px] leading-7 text-zinc-200">
                                                {post.content!
                                                    .split("\n")
                                                    .map((line, idx) => {
                                                        const rtl =
                                                            isArabicLine(line);
                                                        if (!line.trim()) {
                                                            return (
                                                                <div
                                                                    key={`${post.id}-line-${idx}`}
                                                                    className="h-3"
                                                                />
                                                            );
                                                        }
                                                        return (
                                                            <p
                                                                key={`${post.id}-line-${idx}`}
                                                                dir={
                                                                    rtl
                                                                        ? "rtl"
                                                                        : "ltr"
                                                                }
                                                                className={
                                                                    rtl
                                                                        ? "text-right"
                                                                        : "text-left"
                                                                }
                                                            >
                                                                {line}
                                                            </p>
                                                        );
                                                    })}
                                            </div>
                                        </div>
                                    )}

                                    {hasAudio && (
                                        <div className="px-4 pb-4">
                                            <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-3">
                                                <p className="mb-2 text-xs uppercase tracking-wide text-zinc-400">
                                                    Audio
                                                </p>
                                                <audio
                                                    controls
                                                    preload="none"
                                                    className="w-full"
                                                    src={post.audioSrc!}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {!hasText && !hasImage && !hasAudio && (
                                        <div className="px-4 pb-4">
                                            <p className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-400">
                                                Post has no renderable media
                                                payload.
                                            </p>
                                        </div>
                                    )}
                                </article>
                            );
                        })}
                    </section>
                )}
            </div>
        </main>
    );
}
