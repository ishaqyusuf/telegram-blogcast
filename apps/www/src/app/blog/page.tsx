import { db } from "@acme/db";
import { formatDistanceToNow } from "date-fns";
import {
    Album,
    Bookmark,
    FileText,
    Heart,
    MoreHorizontal,
    Share2,
} from "lucide-react";
import { Space_Grotesk, IBM_Plex_Sans_Arabic } from "next/font/google";
import Link from "next/link";
import { BlogText } from "./blog-text";
import { BlogFeedAlbumAction } from "./blog-feed-album-action";
import { BlogFeedAudioButton } from "./blog-feed-audio-button";
import { BlogFeedTranscriptPreview } from "./blog-feed-transcript-preview";
import { BlogFilterArea } from "./blog-filter-area";
import {
    type BlogFilterType,
    loadBlogFilterParams,
    normalizeBlogFilterType,
} from "@/hooks/use-blog-filter-params";

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
    type: string | null;
    content: string | null;
    blogDate: Date | null;
    publishedAt: Date | null;
    channelName: string;
    audioSrc: string | null;
    audioMediaId: number | null;
    audioTitle: string | null;
    audioDuration: number | null;
    audioSize: number | null;
    albumName: string | null;
    transcriptStatus: string | null;
    transcriptSegments: BlogTranscriptSegment[];
    imageSrc: string | null;
    imageAlt: string;
    mimeType: string | null;
};

type BlogMediaFile = {
    source: string | null;
    fileId: string | null;
    fileName: string | null;
    fileSize: number | null;
    duration: number | null;
    blobUrl: string | null;
    blobDownloadUrl: string | null;
};

type BlogMediaItem = {
    mimeType: string;
    title: string | null;
    album: { name: string | null } | null;
    transcript: {
        status: string | null;
        segments: BlogTranscriptSegment[];
    } | null;
    file: BlogMediaFile | null;
    id: number;
};

type BlogTranscriptSegment = {
    id: number;
    startSec: number;
    endSec: number;
    text: string;
};

function buildTelegramFileProxy(fileId: string | null | undefined) {
    if (!fileId) return null;
    return `/api/telegram/file/${encodeURIComponent(fileId)}`;
}

function getMediaFileUrl(file: BlogMediaFile | null | undefined) {
    if (!file) return null;
    if (file.source === "vercel_blob") {
        return file.blobDownloadUrl || file.blobUrl;
    }
    return buildTelegramFileProxy(file.fileId);
}

function pickAudioMedia(medias: BlogMediaItem[]) {
    const media = medias.find(
        (m) =>
            getMediaFileUrl(m.file) &&
            m.mimeType?.toLowerCase().startsWith("audio/"),
    );
    return {
        src: getMediaFileUrl(media?.file),
        mediaId: media?.id ?? null,
        title: media?.title ?? media?.file?.fileName ?? null,
        duration: media?.file?.duration ?? null,
        size: media?.file?.fileSize ?? null,
        albumName: media?.album?.name ?? null,
        transcriptStatus: media?.transcript?.status ?? null,
        transcriptSegments: media?.transcript?.segments ?? [],
    };
}

function appendDistinct(primary: string | null, secondary: string | null) {
    const cleanedPrimary = primary?.trim() || null;
    const cleanedSecondary = secondary?.trim() || null;
    if (!cleanedPrimary) return cleanedSecondary;
    if (!cleanedSecondary || cleanedPrimary === cleanedSecondary) {
        return cleanedPrimary;
    }
    return `${cleanedPrimary} - ${cleanedSecondary}`;
}

function pickImageMedia(
    medias: Array<{
        mimeType: string;
        title: string | null;
        file: BlogMediaFile | null;
    }>,
) {
    const media = medias.find(
        (m) =>
            getMediaFileUrl(m.file) &&
            m.mimeType?.toLowerCase().startsWith("image/"),
    );
    return {
        src: getMediaFileUrl(media?.file),
        alt: media?.title ?? "Blog image",
        mimeType: media?.mimeType ?? null,
    };
}

function formatPostTime(date: Date | null) {
    if (!date) return "unknown date";
    return formatDistanceToNow(date, { addSuffix: true });
}

function formatDuration(seconds: number | null) {
    if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return null;

    const totalSeconds = Math.round(seconds);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const remainingSeconds = totalSeconds % 60;

    if (hours > 0) {
        return `${hours}:${String(minutes).padStart(2, "0")}:${String(
            remainingSeconds,
        ).padStart(2, "0")}`;
    }

    return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

function formatMediaSizeMb(size: number | null) {
    if (!size || !Number.isFinite(size) || size <= 0) return null;

    const mb = size / (1024 * 1024);
    return `${mb >= 10 ? Math.round(mb) : mb.toFixed(1)} MB`;
}

function getInitials(value: string) {
    const initials = value
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join("");

    return initials || "AG";
}

function getPostVariant(post: BlogCardItem) {
    const hasImage = !!post.imageSrc;
    const hasAudio = !!post.audioSrc;
    const hasText = !!post.content?.trim();

    if (hasAudio) return "audio";
    if (post.type === "video") return "video";
    if (hasImage && hasText) return "text+image";
    if (hasImage) return "image";
    if (hasText) return "text";
    return "unknown";
}

function hasUsableFile(file?: BlogMediaFile | null) {
    if (!file) return false;
    if (file.source === "vercel_blob") {
        return Boolean(file.blobDownloadUrl || file.blobUrl || file.fileId);
    }
    return Boolean(file.fileId);
}

function hasMediaPayload(
    row: {
        medias?: Array<{
            mimeType?: string | null;
            file?: BlogMediaFile | null;
        }>;
    },
    mediaType: "audio" | "image" | "video" | "document",
) {
    return row.medias?.some((media) => {
        const mimeType = media.mimeType?.toLowerCase() ?? "";
        const matchesType =
            mediaType === "document"
                ? mimeType === "application/pdf" ||
                  mimeType.startsWith("document/")
                : mimeType.startsWith(`${mediaType}/`);

        return matchesType && hasUsableFile(media.file);
    });
}

function hasBlogPayload(row: {
    type?: string | null;
    content?: string | null;
    medias?: Array<{
        mimeType?: string | null;
        file?: BlogMediaFile | null;
    }>;
}) {
    if (row.type === "text") return Boolean(row.content?.trim());
    if (row.type === "audio") return Boolean(hasMediaPayload(row, "audio"));
    if (row.type === "image") return Boolean(hasMediaPayload(row, "image"));
    if (row.type === "video") return Boolean(hasMediaPayload(row, "video"));
    if (row.type === "pdf" || row.type === "document") {
        return Boolean(hasMediaPayload(row, "document"));
    }

    return Boolean(
        row.content?.trim() ||
            row.medias?.some((media) => hasUsableFile(media.file)),
    );
}

const visibleMainBlogWhere = {
    OR: [
        { source: null },
        { source: { not: "facebook" } },
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

async function getBlogFeed(input: {
    query: string;
    filterType: BlogFilterType;
}): Promise<BlogCardItem[]> {
    const where: any = {
        deletedAt: null,
        published: true,
        AND: [
            {
                OR: [
                    {
                        AND: [
                            { content: { not: null } },
                            { content: { not: "" } },
                        ],
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
            },
            visibleMainBlogWhere,
        ],
    };

    if (input.filterType !== "all") {
        where.type = input.filterType;
    }

    if (input.query) {
        where.OR = [
            {
                content: {
                    contains: input.query,
                    mode: "insensitive",
                },
            },
            {
                channel: {
                    title: {
                        contains: input.query,
                        mode: "insensitive",
                    },
                },
            },
            {
                channel: {
                    username: {
                        contains: input.query,
                        mode: "insensitive",
                    },
                },
            },
            {
                medias: {
                    some: {
                        title: {
                            contains: input.query,
                            mode: "insensitive",
                        },
                    },
                },
            },
        ];
    }

    const rows = await db.blog.findMany({
        where,
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
                    album: {
                        select: {
                            name: true,
                        },
                    },
                    transcript: {
                        select: {
                            status: true,
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
                    file: {
                        select: {
                            source: true,
                            fileId: true,
                            fileName: true,
                            fileSize: true,
                            duration: true,
                            blobUrl: true,
                            blobDownloadUrl: true,
                        },
                    },
                },
            },
        },
        orderBy: [{ blogDate: "desc" }, { createdAt: "desc" }],
        take: 80,
    });

    return rows.filter(hasBlogPayload).map((row) => {
        const image = pickImageMedia(row.medias);
        const audio = pickAudioMedia(row.medias);
        return {
            id: row.id,
            type: row.type,
            content: row.content,
            blogDate: row.blogDate,
            publishedAt: row.publishedAt,
            channelName:
                row.channel?.title ?? `@${row.channel?.username ?? "channel"}`,
            audioSrc: audio.src,
            audioMediaId: audio.mediaId,
            audioTitle: appendDistinct(row.content, audio.title),
            audioDuration: audio.duration,
            audioSize: audio.size,
            albumName: audio.albumName,
            transcriptStatus: audio.transcriptStatus,
            transcriptSegments: audio.transcriptSegments,
            imageSrc: image.src,
            imageAlt: image.alt,
            mimeType: image.mimeType,
        };
    });
}

export default async function BlogPage({
    searchParams,
}: {
    searchParams?:
        | Promise<{ q?: string; type?: string }>
        | { q?: string; type?: string };
}) {
    const resolvedSearchParams = searchParams ? await searchParams : {};
    const loadedFilters = loadBlogFilterParams(resolvedSearchParams);
    const query = loadedFilters.q?.trim() ?? "";
    const filterType = normalizeBlogFilterType(loadedFilters.type);
    const posts = await getBlogFeed({ query, filterType });
    const hasActiveFilters = query.length > 0 || filterType !== "all";

    return (
        <main
            className={[
                "min-h-screen bg-background text-foreground",
                bodyFont.className,
            ].join(" ")}
        >
            <div className="mx-auto w-full max-w-2xl pb-20">
                <header className="sticky top-0 z-20 border-b border-border bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                    <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                            <h1
                                className={`${headingFont.className} text-2xl font-semibold tracking-normal text-foreground`}
                            >
                                Blog
                            </h1>
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                {posts.length} posts from Telegram channels
                            </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                            <Link
                                href="/transcription-queue"
                                aria-label="Open transcription queue"
                                className="inline-flex size-10 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:bg-muted"
                                title="Transcription queue"
                            >
                                <FileText size={18} />
                            </Link>
                            <Link
                                href="/albums"
                                aria-label="Open albums"
                                className="inline-flex size-10 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:bg-muted"
                                title="Albums"
                            >
                                <Album size={18} />
                            </Link>
                            <Link
                                href="/dashboard"
                                className="inline-flex h-10 items-center rounded-full border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                            >
                                Telegram
                            </Link>
                        </div>
                    </div>
                    <BlogFilterArea />
                </header>

                {posts.length === 0 ? (
                    <section className="border-b border-border px-6 py-16 text-center">
                        <h2
                            className={`${headingFont.className} text-xl font-semibold text-foreground`}
                        >
                            {hasActiveFilters
                                ? "No posts match your search/filter"
                                : "No published blog posts yet"}
                        </h2>
                        <p className="mt-2 text-sm text-muted-foreground">
                            {hasActiveFilters
                                ? "Try another keyword or switch the type filter."
                                : "Once data lands in Prisma Blog, this feed will render text, image, and audio cards automatically."}
                        </p>
                    </section>
                ) : (
                    <section>
                        {posts.map((post) => {
                            const hasImage = !!post.imageSrc;
                            const hasAudio = !!post.audioSrc;
                            const hasText = !!post.content?.trim();
                            const variant = getPostVariant(post);
                            const postDate = post.blogDate ?? post.publishedAt;
                            const subtitleParts = [
                                formatPostTime(postDate),
                                formatDuration(post.audioDuration),
                                formatMediaSizeMb(post.audioSize),
                            ].filter(Boolean);
                            const showTranscriptBadge =
                                post.transcriptStatus === "done" ||
                                post.transcriptStatus === "processing";

                            return (
                                <article
                                    key={post.id}
                                    className="border-b border-border bg-background transition-colors hover:bg-muted/35"
                                >
                                    <Link
                                        href={`/blog/${post.id}`}
                                        className="group block px-4 py-4"
                                    >
                                        <div className="mb-3 flex items-center justify-between gap-3">
                                            <div className="flex min-w-0 flex-1 items-center gap-3">
                                                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-bold text-foreground">
                                                    {getInitials(
                                                        post.channelName,
                                                    )}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="truncate text-[15px] font-semibold text-foreground">
                                                        {post.channelName}
                                                    </p>
                                                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                                        {subtitleParts.join(
                                                            " · ",
                                                        )}
                                                    </p>
                                                </div>
                                            </div>

                                            <span className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors group-hover:bg-muted">
                                                <MoreHorizontal size={20} />
                                            </span>
                                        </div>

                                        {variant === "text" && hasText ? (
                                            <div className="border-t border-border pt-3">
                                                <BlogText
                                                    content={post.content!}
                                                    inline
                                                    size="large"
                                                />
                                            </div>
                                        ) : (
                                            <>
                                                {hasImage && (
                                                    <div className="mb-3 overflow-hidden rounded-xl border border-border bg-black">
                                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                                        <img
                                                            src={post.imageSrc!}
                                                            alt={post.imageAlt}
                                                            className="h-44 w-full object-cover sm:h-72"
                                                            loading="lazy"
                                                        />
                                                    </div>
                                                )}

                                                {hasText && (
                                                    <div className="mb-3">
                                                        <BlogText
                                                            content={
                                                                post.content!
                                                            }
                                                            inline
                                                        />
                                                    </div>
                                                )}

                                                {!hasText &&
                                                    post.audioTitle && (
                                                        <div className="mb-3">
                                                            <BlogText
                                                                content={
                                                                    post.audioTitle
                                                                }
                                                                inline
                                                            />
                                                        </div>
                                                    )}
                                            </>
                                        )}

                                        {!hasText && !hasImage && !hasAudio && (
                                            <div className="mb-3 rounded-lg border border-border bg-card px-3 py-2">
                                                <p className="text-sm text-muted-foreground">
                                                    Post has no renderable media
                                                    payload.
                                                </p>
                                            </div>
                                        )}
                                    </Link>

                                    {hasAudio &&
                                    post.transcriptSegments.length > 0 ? (
                                        <BlogFeedTranscriptPreview
                                            blogId={post.id}
                                            segments={post.transcriptSegments}
                                        />
                                    ) : null}

                                    <div className="flex items-center justify-between gap-3 px-4 pb-3">
                                        <div className="flex min-w-0 flex-1 items-center gap-1.5">
                                            {showTranscriptBadge ? (
                                                <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                                                    <FileText size={14} />
                                                </span>
                                            ) : null}
                                            {post.albumName ? (
                                                <span className="max-w-[140px] truncate rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                                                    {post.albumName}
                                                </span>
                                            ) : null}
                                            {hasAudio &&
                                            post.audioMediaId &&
                                            !post.albumName ? (
                                                <BlogFeedAlbumAction
                                                    mediaId={post.audioMediaId}
                                                />
                                            ) : null}
                                        </div>

                                        <div className="flex shrink-0 items-center gap-1 text-muted-foreground">
                                            <button
                                                type="button"
                                                className="inline-flex min-h-11 items-center gap-1 rounded-full px-2 transition-colors hover:bg-muted"
                                            >
                                                <Heart size={18} />
                                                <span className="text-xs font-medium">
                                                    0
                                                </span>
                                            </button>
                                            <button
                                                type="button"
                                                aria-label="Bookmark"
                                                className="inline-flex size-11 items-center justify-center rounded-full transition-colors hover:bg-muted"
                                            >
                                                <Bookmark size={18} />
                                            </button>
                                            <button
                                                type="button"
                                                aria-label="Share"
                                                className="inline-flex size-11 items-center justify-center rounded-full transition-colors hover:bg-muted"
                                            >
                                                <Share2 size={18} />
                                            </button>
                                            {hasAudio && post.audioSrc ? (
                                                <BlogFeedAudioButton
                                                    id={post.id}
                                                    src={post.audioSrc}
                                                    title={
                                                        post.audioTitle ??
                                                        "Audio"
                                                    }
                                                />
                                            ) : null}
                                        </div>
                                    </div>
                                </article>
                            );
                        })}
                    </section>
                )}
            </div>
        </main>
    );
}
