import { db } from "@acme/db";
import { formatDistanceToNow } from "date-fns";
import { Activity, AlertCircle, CheckCircle2, Clock3, FileText } from "lucide-react";
import Link from "next/link";

function statusTone(status: string) {
    if (status === "completed") return "bg-emerald-500/10 text-emerald-600";
    if (status === "running") return "bg-sky-500/10 text-sky-600";
    if (status === "failed") return "bg-destructive/10 text-destructive";
    return "bg-amber-500/10 text-amber-600";
}

function statusIcon(status: string) {
    if (status === "completed") return <CheckCircle2 size={15} />;
    if (status === "running") return <Activity size={15} />;
    if (status === "failed") return <AlertCircle size={15} />;
    return <Clock3 size={15} />;
}

function formatWhen(date?: Date | null) {
    if (!date) return "unknown";
    return formatDistanceToNow(date, { addSuffix: true });
}

function formatDuration(seconds?: number | null) {
    if (!seconds || seconds <= 0) return null;
    const minutes = Math.floor(seconds / 60);
    const remaining = Math.round(seconds % 60);
    return `${minutes}:${String(remaining).padStart(2, "0")}`;
}

export default async function TranscriptionQueuePage() {
    const jobs = await db.transcriptionJob.findMany({
        include: {
            media: {
                include: {
                    file: {
                        select: {
                            fileName: true,
                            duration: true,
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
                },
            },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 120,
    });

    const counts = jobs.reduce<Record<string, number>>((acc, job) => {
        acc[job.status] = (acc[job.status] ?? 0) + 1;
        return acc;
    }, {});

    return (
        <main className="min-h-screen bg-background text-foreground">
            <div className="mx-auto w-full max-w-3xl pb-16">
                <header className="sticky top-0 z-20 border-b border-border bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                    <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                            <h1 className="text-2xl font-semibold tracking-normal">
                                Transcription queue
                            </h1>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                                {jobs.length} jobs · {counts.queued ?? 0} queued ·{" "}
                                {counts.running ?? 0} running
                            </p>
                        </div>
                        <Link
                            href="/blog"
                            className="inline-flex h-10 items-center rounded-full border border-border bg-card px-3 text-sm font-medium transition-colors hover:bg-muted"
                        >
                            Blog
                        </Link>
                    </div>
                </header>

                <section className="grid grid-cols-2 gap-2 px-4 py-4 sm:grid-cols-4">
                    {["queued", "running", "completed", "failed"].map((status) => (
                        <div
                            key={status}
                            className="rounded-lg border border-border bg-card px-3 py-2"
                        >
                            <p className="text-[10px] font-semibold uppercase text-muted-foreground">
                                {status}
                            </p>
                            <p className="mt-1 text-2xl font-semibold">
                                {counts[status] ?? 0}
                            </p>
                        </div>
                    ))}
                </section>

                {jobs.length === 0 ? (
                    <section className="border-t border-border px-6 py-16 text-center">
                        <FileText className="mx-auto text-muted-foreground" size={30} />
                        <h2 className="mt-4 text-lg font-semibold">No queued work</h2>
                        <p className="mt-2 text-sm text-muted-foreground">
                            Queue an audio item from a blog card or audio page.
                        </p>
                    </section>
                ) : (
                    <section className="border-t border-border">
                        {jobs.map((job) => {
                            const title =
                                job.media.title ||
                                job.media.file?.fileName ||
                                job.media.blog?.content ||
                                `Media ${job.mediaId}`;
                            const channel =
                                job.media.blog?.channel?.title ||
                                job.media.blog?.channel?.username ||
                                "Unknown channel";
                            const duration = formatDuration(job.media.file?.duration);
                            const href = job.media.blog?.id
                                ? `/blog/${job.media.blog.id}`
                                : null;
                            const content = (
                                <>
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <span
                                                    className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusTone(job.status)}`}
                                                >
                                                    {statusIcon(job.status)}
                                                    {job.status}
                                                </span>
                                                <span className="truncate text-xs text-muted-foreground">
                                                    {formatWhen(job.createdAt)}
                                                </span>
                                            </div>
                                            <h2 className="mt-2 line-clamp-2 text-sm font-semibold">
                                                {title}
                                            </h2>
                                            <p className="mt-1 truncate text-xs text-muted-foreground">
                                                {channel}
                                                {duration ? ` · ${duration}` : ""}
                                            </p>
                                        </div>
                                        <p className="shrink-0 text-sm font-semibold">
                                            {job.progressPercent ?? 0}%
                                        </p>
                                    </div>

                                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                                        <div
                                            className="h-full rounded-full bg-primary"
                                            style={{
                                                width: `${Math.min(100, Math.max(0, job.progressPercent ?? 0))}%`,
                                            }}
                                        />
                                    </div>

                                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                                        {job.stage ? <span>stage: {job.stage}</span> : null}
                                        {job.workerId ? <span>worker: {job.workerId}</span> : null}
                                        {job.currentChunk && job.totalChunks ? (
                                            <span>
                                                chunk {job.currentChunk}/{job.totalChunks}
                                            </span>
                                        ) : null}
                                        {job.errorMessage ? (
                                            <span className="text-destructive">
                                                {job.errorMessage}
                                            </span>
                                        ) : null}
                                    </div>
                                </>
                            );

                            return href ? (
                                <Link
                                    key={job.id}
                                    href={href}
                                    className="block border-b border-border px-4 py-4 transition-colors hover:bg-muted/40"
                                >
                                    {content}
                                </Link>
                            ) : (
                                <article
                                    key={job.id}
                                    className="border-b border-border px-4 py-4"
                                >
                                    {content}
                                </article>
                            );
                        })}
                    </section>
                )}
            </div>
        </main>
    );
}
