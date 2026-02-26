"use client";

// apps/www/app/blog/[blogId]/page.tsx
// Blog detail — open, delete, tags w/ autocomplete, audio player,
// transcript with seekable timestamps, comments with clickable timestamp tokens

import { useState, useRef, useEffect, use, type RefObject } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "@acme/ui/tanstack";
import { _trpc } from "@/components/static-trpc";
import { AudioPlayer } from "@/components/audio/audio-player";
import { invalidateQueries, invalidateQuery } from "@/lib/invalidate-query";
import type { RouterOutputs } from "@api/trpc/routers/_app";

type Blog = RouterOutputs["blog"]["getBlog"];
type Comment = Blog["blogs"][number];
type BlogTag = Blog["blogTags"][number];

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(sec: number): string {
    const m = Math.floor(sec / 60)
        .toString()
        .padStart(2, "0");
    const s = Math.floor(sec % 60)
        .toString()
        .padStart(2, "0");
    return `${m}:${s}`;
}

function parseTimestamp(label: string): number | null {
    const [m, s] = label.split(":").map(Number);
    if (isNaN(m) || isNaN(s)) return null;
    return m * 60 + s;
}

function isArabic(t: string) {
    return /[\u0600-\u06FF]/.test(t);
}
function cn(...c: (string | false | undefined)[]) {
    return c.filter(Boolean).join(" ");
}

function playFrom(
    audioRef: RefObject<HTMLAudioElement | null>,
    fromSec: number,
    toSec?: number,
) {
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = fromSec;

    if (toSec && toSec > fromSec) {
        const onTimeUpdate = () => {
            if (el.currentTime >= toSec) {
                el.pause();
                el.removeEventListener("timeupdate", onTimeUpdate);
            }
        };
        el.addEventListener("timeupdate", onTimeUpdate);
    }

    el.play();
}

function buildTelegramFileProxy(fileId: string | null | undefined) {
    if (!fileId) return null;
    return `/api/telegram/file/${encodeURIComponent(fileId)}`;
}

// ── Transcript Section ────────────────────────────────────────────────────────

interface TranscriptEntry {
    id: string;
    from: number;
    to: number;
    text: string;
    saved: boolean;
}

function TranscriptSection({
    blogId,
    fileId,
    audioRef,
}: {
    blogId: number;
    fileId: string;
    audioRef: RefObject<HTMLAudioElement | null>;
}) {
    const [entries, setEntries] = useState<TranscriptEntry[]>([]);
    const [fromSec, setFromSec] = useState("");
    const [toSec, setToSec] = useState("");
    const [provider, setProvider] = useState<"openai" | "gemini">("openai");
    const [error, setError] = useState<string | null>(null);

    const { mutate: addComment } = useMutation(
        _trpc.blog.addComment.mutationOptions({
            onSuccess() {
                invalidateQuery("blog.getBlog", { id: blogId });
            },
        }),
    );
    const { mutate: transcribeRange, isPending: isTranscribing } = useMutation(
        _trpc.blog.transcribeRange.mutationOptions({
            onSuccess(data) {
                const newEntries = (data.segments ?? []).map((segment) => ({
                    id: `${segment.id}-${crypto.randomUUID()}`,
                    from: segment.from,
                    to: segment.to,
                    text: segment.text,
                    saved: false,
                }));

                if (newEntries.length === 0) {
                    setError("No transcript text found in this time range.");
                    return;
                }

                setEntries((prev) =>
                    [...prev, ...newEntries].sort((a, b) => a.from - b.from),
                );
            },
            onError(err) {
                setError(err.message || "Transcription failed.");
            },
        }),
    );

    function captureCurrent(field: "from" | "to") {
        const t = Math.floor(audioRef.current?.currentTime ?? 0);
        if (field === "from") setFromSec(String(t));
        else setToSec(String(t));
    }

    function onTranscribeRange() {
        const from = parseFloat(fromSec);
        const to = parseFloat(toSec);
        if (isNaN(from) || isNaN(to) || to <= from) {
            setError("Set a valid time range (to must be greater than from).");
            return;
        }

        setError(null);
        transcribeRange({ fileId, fromSec: from, toSec: to, provider });
    }

    function saveToComment(entry: TranscriptEntry) {
        const content = `[${formatTime(entry.from)}→${formatTime(entry.to)}] ${entry.text}`;
        addComment({ blogId, content });
        setEntries((prev) =>
            prev.map((e) => (e.id === entry.id ? { ...e, saved: true } : e)),
        );
    }

    return (
        <div className="space-y-4">
            <p className="font-mono text-[10px] text-zinc-500 uppercase tracking-widest">
                Transcript
            </p>

            {/* Form */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                    {(["from", "to"] as const).map((field) => (
                        <div key={field} className="space-y-1">
                            <label className="font-mono text-[10px] text-zinc-600 uppercase">
                                {field} (sec)
                            </label>
                            <div className="flex gap-1">
                                <input
                                    type="number"
                                    min={0}
                                    value={field === "from" ? fromSec : toSec}
                                    onChange={(e) =>
                                        field === "from"
                                            ? setFromSec(e.target.value)
                                            : setToSec(e.target.value)
                                    }
                                    placeholder={field === "from" ? "0" : "20"}
                                    className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 font-mono text-xs text-zinc-200 focus:outline-none focus:border-emerald-700 min-w-0"
                                />
                                <button
                                    onClick={() => captureCurrent(field)}
                                    title="Use current playback time"
                                    className="px-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-400 text-xs transition-colors"
                                >
                                    ⏱
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="space-y-1">
                    <label className="font-mono text-[10px] text-zinc-600 uppercase">
                        Provider
                    </label>
                    <select
                        value={provider}
                        onChange={(e) =>
                            setProvider(e.target.value as "openai" | "gemini")
                        }
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 font-mono text-xs text-zinc-200 focus:outline-none focus:border-emerald-700"
                    >
                        <option value="openai">OpenAI (Whisper)</option>
                        <option value="gemini">Gemini</option>
                    </select>
                </div>

                <button
                    onClick={onTranscribeRange}
                    disabled={isTranscribing}
                    className="px-3 py-1.5 rounded-lg bg-emerald-900 hover:bg-emerald-800 border border-emerald-800 font-mono text-xs text-emerald-300 transition-colors disabled:opacity-50"
                >
                    {isTranscribing ? "Transcribing…" : "Transcribe range"}
                </button>

                {error && <p className="text-xs text-red-400">{error}</p>}
            </div>

            {/* Entries */}
            {entries.length === 0 ? (
                <p className="font-mono text-[11px] text-zinc-700 px-1">
                    No segments yet. Set from/to seconds and transcribe.
                </p>
            ) : (
                <div className="space-y-2">
                    {entries.map((entry) => (
                        <div
                            key={entry.id}
                            className={cn(
                                "flex gap-3 items-start rounded-xl p-3 border transition-colors",
                                entry.saved
                                    ? "bg-emerald-950/20 border-emerald-900/40"
                                    : "bg-zinc-900 border-zinc-800",
                            )}
                        >
                            <button
                                onClick={() =>
                                    playFrom(audioRef, entry.from, entry.to)
                                }
                                title={`Seek to ${formatTime(entry.from)}`}
                                className="shrink-0 font-mono text-[11px] text-emerald-500 hover:text-emerald-300 tabular-nums mt-0.5 transition-colors"
                            >
                                {formatTime(entry.from)} -{" "}
                                {formatTime(entry.to)}
                            </button>

                            <p className="flex-1 text-sm text-zinc-300 leading-relaxed">
                                {entry.text}
                            </p>

                            <button
                                onClick={() => saveToComment(entry)}
                                disabled={entry.saved}
                                className={cn(
                                    "shrink-0 font-mono text-[10px] px-2 py-1 rounded-lg border transition-colors",
                                    entry.saved
                                        ? "border-emerald-900 text-emerald-700 cursor-default"
                                        : "border-zinc-700 text-zinc-500 hover:border-emerald-700 hover:text-emerald-400",
                                )}
                            >
                                {entry.saved ? "✓ saved" : "→ comment"}
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ── Tags Section ──────────────────────────────────────────────────────────────

function TagsSection({ blogId, tags }: { blogId: number; tags: BlogTag[] }) {
    const [input, setInput] = useState("");
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [open, setOpen] = useState(false);
    const wrapRef = useRef<HTMLDivElement>(null);

    const { data: allTags = [] } = useQuery(_trpc.blog.getTags.queryOptions());

    const { mutate: addTag } = useMutation(
        _trpc.blog.addTag.mutationOptions({
            onSuccess() {
                invalidateQuery("blog.getBlog", { id: blogId });
                setInput("");
                setOpen(false);
            },
        }),
    );
    const { mutate: removeTag } = useMutation(
        _trpc.blog.removeTag.mutationOptions({
            onSuccess() {
                invalidateQuery("blog.getBlog", { id: blogId });
            },
        }),
    );

    useEffect(() => {
        const q = input.trim().toLowerCase();
        if (!q) {
            setSuggestions([]);
            setOpen(false);
            return;
        }
        const existing = new Set(
            tags.map((t) => t.tags?.title?.toLowerCase()).filter(Boolean),
        );
        const filtered = allTags
            .filter(
                (t) =>
                    t.title.toLowerCase().includes(q) &&
                    !existing.has(t.title.toLowerCase()),
            )
            .map((t) => t.title)
            .slice(0, 6);
        setSuggestions(filtered);
        setOpen(filtered.length > 0);
    }, [input, allTags, tags]);

    useEffect(() => {
        function handler(e: MouseEvent) {
            if (wrapRef.current && !wrapRef.current.contains(e.target as Node))
                setOpen(false);
        }
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    function submit(title: string) {
        if (!title.trim()) return;
        addTag({ blogId, title: title.trim() });
    }

    return (
        <div className="space-y-3">
            <p className="font-mono text-[10px] text-zinc-500 uppercase tracking-widest">
                Tags
            </p>

            <div className="flex flex-wrap gap-1.5">
                {tags.map(
                    (bt) =>
                        bt.tags && (
                            <span
                                key={bt.id}
                                className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-zinc-800 border border-zinc-700 font-mono text-[11px] text-zinc-300"
                            >
                                #{bt.tags.title}
                                <button
                                    onClick={() =>
                                        removeTag({ blogTagId: bt.id })
                                    }
                                    className="text-zinc-600 hover:text-red-400 transition-colors ml-0.5 leading-none"
                                >
                                    ×
                                </button>
                            </span>
                        ),
                )}
            </div>

            <div className="relative" ref={wrapRef}>
                <div className="flex gap-2">
                    <input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onFocus={() => input && setOpen(suggestions.length > 0)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                submit(input);
                            }
                            if (e.key === "Escape") {
                                setOpen(false);
                            }
                        }}
                        placeholder="Add tag…"
                        className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 font-mono text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-700"
                    />
                    <button
                        onClick={() => submit(input)}
                        className="px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 font-mono text-xs text-zinc-300 border border-zinc-700 transition-colors"
                    >
                        + add
                    </button>
                </div>

                {open && (
                    <div className="absolute top-full mt-1 left-0 right-16 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl z-20 overflow-hidden">
                        {suggestions.map((s) => (
                            <button
                                key={s}
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    submit(s);
                                }}
                                className="w-full text-left px-3 py-2 font-mono text-xs text-zinc-300 hover:bg-zinc-800 transition-colors"
                            >
                                #{s}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// ── Comments Section ──────────────────────────────────────────────────────────

function CommentsSection({
    blogId,
    comments,
    audioRef,
}: {
    blogId: number;
    comments: Comment[];
    audioRef?: RefObject<HTMLAudioElement | null>;
}) {
    const [text, setText] = useState("");

    const { mutate: addComment, isPending } = useMutation(
        _trpc.blog.addComment.mutationOptions({
            onSuccess() {
                invalidateQuery("blog.getBlog", { id: blogId });
                setText("");
            },
        }),
    );

    // Render comment content — parse [MM:SS→MM:SS] tokens into seekable buttons
    function renderContent(content: string) {
        const parts = content.split(/(\[\d{2}:\d{2}→\d{2}:\d{2}\])/g);
        return parts.map((part, i) => {
            const match = part.match(/^\[(\d{2}:\d{2})→(\d{2}:\d{2})\]$/);
            if (match && audioRef) {
                const from = parseTimestamp(match[1]);
                const to = parseTimestamp(match[2]);
                return (
                    <button
                        key={i}
                        onClick={() => {
                            if (from === null || !audioRef.current) return;
                            playFrom(audioRef, from, to ?? undefined);
                        }}
                        className="inline-flex items-center gap-1 font-mono text-[11px] text-emerald-400 hover:text-emerald-300 bg-emerald-950/40 border border-emerald-900/50 rounded-md px-1.5 py-0.5 transition-colors mx-0.5 cursor-pointer"
                    >
                        ▶ {match[1]} - {match[2]}
                    </button>
                );
            }
            return <span key={i}>{part}</span>;
        });
    }

    return (
        <div className="space-y-4">
            <p className="font-mono text-[10px] text-zinc-500 uppercase tracking-widest">
                Comments ({comments.length})
            </p>

            {comments.length === 0 && (
                <p className="font-mono text-[11px] text-zinc-700">
                    No comments yet.
                </p>
            )}

            <div className="space-y-2">
                {comments.map((c) => (
                    <div
                        key={c.comment?.id ?? c.id}
                        className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 space-y-1.5"
                    >
                        <div className="font-mono text-[10px] text-zinc-600">
                            {(c as any).comment?.createdAt
                                ? new Date(
                                      (c as any).comment?.createdAt,
                                  ).toLocaleString()
                                : ""}
                        </div>
                        <p className="text-sm text-zinc-300 leading-relaxed">
                            {renderContent((c as any).comment?.content ?? "")}
                        </p>
                    </div>
                ))}
            </div>

            <div className="flex gap-2">
                <input
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            if (text.trim())
                                addComment({ blogId, content: text });
                        }
                    }}
                    placeholder="Add a comment…"
                    className="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-700"
                />
                <button
                    onClick={() => {
                        if (text.trim()) addComment({ blogId, content: text });
                    }}
                    disabled={!text.trim() || isPending}
                    className="px-4 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-700 font-mono text-xs text-emerald-200 transition-colors disabled:opacity-40"
                >
                    {isPending ? "…" : "Post"}
                </button>
            </div>
        </div>
    );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BlogPage({
    params,
}: {
    params: Promise<{ blogId: string }>;
}) {
    const { blogId: blogIdStr } = use(params);
    const router = useRouter();
    const blogId = parseInt(blogIdStr);
    const audioRef = useRef<HTMLAudioElement>(null!);

    const { data: blog, isLoading } = useQuery(
        _trpc.blog.getBlog.queryOptions({ id: blogId }),
    );

    const { mutate: deleteBlog, isPending: isDeleting } = useMutation(
        _trpc.blog.deleteBlog.mutationOptions({
            onSuccess() {
                invalidateQueries("blog.getBlog");
                router.back();
            },
        }),
    );

    if (isLoading)
        return (
            <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
                <span className="font-mono text-xs text-zinc-600 animate-pulse">
                    loading…
                </span>
            </div>
        );

    if (!blog)
        return (
            <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
                <span className="font-mono text-xs text-zinc-500">
                    Blog not found.
                </span>
            </div>
        );

    const isAudio = blog.type === "audio";
    const media = (blog as any).medias?.[0];
    const fileId = media?.file?.fileId ?? null;
    const audioSrc = buildTelegramFileProxy(fileId);
    const mediaTitle = media?.title ?? null;
    const author = media?.author?.nameAr ?? media?.author?.name ?? null;

    return (
        <>
            <style>{`
        ::-webkit-scrollbar{width:5px}
        ::-webkit-scrollbar-track{background:#09090b}
        ::-webkit-scrollbar-thumb{background:#27272a;border-radius:3px}
      `}</style>

            <div className="min-h-screen bg-zinc-950 text-zinc-200">
                {/* Sticky header */}
                <header className="sticky top-0 z-20 bg-zinc-950/95 backdrop-blur border-b border-zinc-800 px-6 py-3 flex items-center gap-3">
                    <button
                        onClick={() => router.back()}
                        className="font-mono text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                        ← back
                    </button>
                    <div className="flex-1" />
                    <span
                        className={cn(
                            "font-mono text-[10px] px-2 py-0.5 rounded-full border",
                            isAudio
                                ? "text-amber-400  border-amber-800  bg-amber-950/30"
                                : blog.type === "image"
                                  ? "text-sky-400    border-sky-800    bg-sky-950/30"
                                  : blog.type === "video"
                                    ? "text-violet-400 border-violet-800 bg-violet-950/30"
                                    : "text-zinc-400   border-zinc-700",
                        )}
                    >
                        {blog.type}
                    </span>
                    <button
                        onClick={() => {
                            if (confirm("Delete this blog?"))
                                deleteBlog({ id: blogId });
                        }}
                        disabled={isDeleting}
                        className="font-mono text-xs text-zinc-600 hover:text-red-400 transition-colors disabled:opacity-40"
                    >
                        {isDeleting ? "deleting…" : "delete"}
                    </button>
                </header>

                <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
                    {/* Meta */}
                    <div className="space-y-1.5">
                        {blog.blogDate && (
                            <p className="font-mono text-[11px] text-zinc-600">
                                {new Date(blog.blogDate).toLocaleDateString(
                                    "en-US",
                                    {
                                        year: "numeric",
                                        month: "long",
                                        day: "numeric",
                                    },
                                )}
                            </p>
                        )}
                        {mediaTitle && (
                            <h1
                                dir={isArabic(mediaTitle) ? "rtl" : "ltr"}
                                className="text-2xl font-semibold text-zinc-100 leading-snug"
                            >
                                {mediaTitle}
                            </h1>
                        )}
                        {author && (
                            <p
                                dir={isArabic(author) ? "rtl" : "ltr"}
                                className="text-sm text-zinc-500"
                            >
                                {author}
                            </p>
                        )}
                    </div>

                    {/* Audio player */}
                    {isAudio && audioSrc && (
                        <AudioPlayer src={audioSrc} audioRef={audioRef} />
                    )}

                    {/* Caption / content */}
                    {blog.content && (
                        <div
                            dir={isArabic(blog.content) ? "rtl" : "ltr"}
                            lang={isArabic(blog.content) ? "ar" : undefined}
                            className="text-sm text-zinc-400 leading-relaxed whitespace-pre-wrap border-l-2 border-zinc-800 pl-4"
                        >
                            {blog.content}
                        </div>
                    )}

                    {/* Tags */}
                    <TagsSection
                        blogId={blogId}
                        tags={(blog as any).blogTags ?? []}
                    />

                    <div className="border-t border-zinc-800/60" />

                    {/* Transcript — audio only */}
                    {isAudio && fileId && (
                        <>
                            <TranscriptSection
                                blogId={blogId}
                                fileId={fileId}
                                audioRef={audioRef}
                            />
                            <div className="border-t border-zinc-800/60" />
                        </>
                    )}

                    {/* Comments */}
                    <CommentsSection
                        blogId={blogId}
                        comments={(blog as any).blogs ?? []}
                        audioRef={isAudio ? audioRef : undefined}
                    />

                    <div className="h-20" />
                </div>
            </div>
        </>
    );
}
