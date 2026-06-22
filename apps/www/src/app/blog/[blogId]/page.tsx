"use client";

// apps/www/app/blog/[blogId]/page.tsx
// Blog detail — open, delete, tags w/ autocomplete, audio player,
// transcript with seekable timestamps, comments with clickable timestamp tokens

import {
    useState,
    useRef,
    useEffect,
    use,
    useCallback,
    useMemo,
    type RefObject,
} from "react";
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

const TRANSCRIPT_CHUNK_SEC = 30;
const TRANSCRIPT_PREFETCH_AT_SEC = 20;
const TRANSCRIPT_CHUNK_CACHE_ENABLED = false;

interface TranscriptWord {
    word: string;
    startSec: number;
    endSec: number;
}

interface TranscriptSegment {
    id?: string | number;
    from?: number;
    to?: number;
    startSec?: number;
    endSec?: number;
    text: string;
    words?: TranscriptWord[];
}

interface TranscriptChunk {
    chunkStartSec: number;
    chunkEndSec: number;
    cached: boolean;
    status: "done";
    segments: TranscriptSegment[];
}

function getTranscriptChunkStart(sec: number) {
    return (
        Math.floor(Math.max(0, sec) / TRANSCRIPT_CHUNK_SEC) *
        TRANSCRIPT_CHUNK_SEC
    );
}

function getSegmentStart(segment: TranscriptSegment) {
    return segment.startSec ?? segment.from ?? 0;
}

function getSegmentEnd(segment: TranscriptSegment) {
    return segment.endSec ?? segment.to ?? getSegmentStart(segment);
}

function wordIsActive(word: TranscriptWord, positionSec: number) {
    return positionSec >= word.startSec && positionSec < word.endSec;
}

function TranscriptSection({
    mediaId,
    fileId,
    audioSrc,
    audioRef,
}: {
    mediaId: number;
    fileId: string;
    audioSrc: string;
    audioRef: RefObject<HTMLAudioElement | null>;
}) {
    const [chunks, setChunks] = useState<Record<number, TranscriptChunk>>({});
    const [pendingChunks, setPendingChunks] = useState<number[]>([]);
    const [positionSec, setPositionSec] = useState(0);
    const [activeChunkStart, setActiveChunkStart] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [testResult, setTestResult] = useState<{
        segments: TranscriptSegment[];
        elapsedMs: number;
    } | null>(null);
    const [testElapsedMs, setTestElapsedMs] = useState(0);
    const [testError, setTestError] = useState<string | null>(null);
    const chunkCacheRef = useRef(chunks);
    const pendingChunksRef = useRef(pendingChunks);
    const failedChunksRef = useRef<Set<number>>(new Set());
    const testStartedAtRef = useRef<number | null>(null);
    const { data: localTranscriberHealth, isFetching: checkingLocalWhisper } =
        useQuery({
            ..._trpc.blog.checkLocalTranscriber.queryOptions(),
            refetchInterval: 3000,
            retry: false,
        });
    const localWhisperOnline = Boolean(localTranscriberHealth?.ok);
    const localWhisperStatus = localTranscriberHealth?.status ?? "checking";

    const testTranscript = useMutation(
        _trpc.blog.testTranscriptRange.mutationOptions({
            onMutate() {
                testStartedAtRef.current = Date.now();
                setTestElapsedMs(0);
                setTestResult(null);
                setTestError(null);
            },
            onSuccess(data) {
                setTestResult({
                    segments: data.segments as TranscriptSegment[],
                    elapsedMs: data.elapsedMs,
                });
            },
            onError(err) {
                setTestError(err.message || "Transcription test failed.");
            },
            onSettled() {
                const startedAt = testStartedAtRef.current;
                if (startedAt) setTestElapsedMs(Date.now() - startedAt);
                testStartedAtRef.current = null;
            },
        }),
    );

    useEffect(() => {
        chunkCacheRef.current = chunks;
    }, [chunks]);

    useEffect(() => {
        pendingChunksRef.current = pendingChunks;
    }, [pendingChunks]);

    useEffect(() => {
        if (!testTranscript.isPending) return;
        const interval = window.setInterval(() => {
            const startedAt = testStartedAtRef.current;
            if (startedAt) setTestElapsedMs(Date.now() - startedAt);
        }, 250);
        return () => window.clearInterval(interval);
    }, [testTranscript.isPending]);

    const { mutate: getTranscriptChunk } = useMutation(
        _trpc.blog.getTranscriptChunk.mutationOptions({
            onSuccess(data) {
                failedChunksRef.current.delete(data.chunkStartSec);
                setChunks((prev) => {
                    const next = {
                        ...prev,
                        [data.chunkStartSec]: data as TranscriptChunk,
                    };
                    chunkCacheRef.current = next;
                    return next;
                });
                setError(null);
            },
            onError(err, variables) {
                const chunkStart = variables?.chunkStartSec ?? activeChunkStart;
                failedChunksRef.current.add(chunkStart);
                setError(
                    `Chunk ${formatTime(chunkStart)} could not be transcribed: ${
                        err.message || "Transcription failed."
                    }`,
                );
            },
            onSettled(_data, _err, variables) {
                const chunkStart = variables?.chunkStartSec;
                if (typeof chunkStart !== "number") return;
                pendingChunksRef.current = pendingChunksRef.current.filter(
                    (value) => value !== chunkStart,
                );
                setPendingChunks(pendingChunksRef.current);
            },
        }),
    );
    const getTranscriptChunkRef = useRef(getTranscriptChunk);

    useEffect(() => {
        getTranscriptChunkRef.current = getTranscriptChunk;
    }, [getTranscriptChunk]);

    const requestChunk = useCallback(
        (chunkStartSec: number, options?: { force?: boolean }) => {
            if (chunkStartSec < 0) return;
            if (!localWhisperOnline) return;
            if (
                TRANSCRIPT_CHUNK_CACHE_ENABLED &&
                !options?.force &&
                chunkCacheRef.current[chunkStartSec]
            ) {
                return;
            }
            if (pendingChunksRef.current.includes(chunkStartSec)) return;
            if (!options?.force && failedChunksRef.current.has(chunkStartSec)) {
                return;
            }
            failedChunksRef.current.delete(chunkStartSec);

            pendingChunksRef.current = [
                ...pendingChunksRef.current,
                chunkStartSec,
            ];
            setPendingChunks(pendingChunksRef.current);
            getTranscriptChunkRef.current({
                mediaId,
                fileId,
                chunkStartSec,
                chunkDurationSec: TRANSCRIPT_CHUNK_SEC,
                model: "whisper-local",
                force: options?.force || !TRANSCRIPT_CHUNK_CACHE_ENABLED,
            });
        },
        [fileId, localWhisperOnline, mediaId],
    );

    useEffect(() => {
        const el = audioRef.current;
        if (!el) return;

        const syncPlaybackChunk = () => {
            const currentSec = el.currentTime || 0;
            const chunkStart = getTranscriptChunkStart(currentSec);
            setPositionSec(currentSec);
            setActiveChunkStart(chunkStart);
            requestChunk(chunkStart);

            if (currentSec - chunkStart >= TRANSCRIPT_PREFETCH_AT_SEC) {
                requestChunk(chunkStart + TRANSCRIPT_CHUNK_SEC);
            }
        };

        el.addEventListener("play", syncPlaybackChunk);
        el.addEventListener("timeupdate", syncPlaybackChunk);
        el.addEventListener("seeked", syncPlaybackChunk);

        return () => {
            el.removeEventListener("play", syncPlaybackChunk);
            el.removeEventListener("timeupdate", syncPlaybackChunk);
            el.removeEventListener("seeked", syncPlaybackChunk);
        };
    }, [audioRef, requestChunk]);

    const transcriptSegments = useMemo(
        () =>
            Object.values(chunks)
                .sort((a, b) => a.chunkStartSec - b.chunkStartSec)
                .flatMap((chunk) => chunk.segments)
                .sort((a, b) => getSegmentStart(a) - getSegmentStart(b)),
        [chunks],
    );
    const visibleTranscriptSegments = useMemo(() => {
        if (transcriptSegments.length === 0) return [];

        const activeIndex = transcriptSegments.findIndex((segment) => {
            const start = getSegmentStart(segment);
            const end = getSegmentEnd(segment);
            return positionSec >= start && positionSec < end;
        });
        const nearbyIndex =
            activeIndex >= 0
                ? activeIndex
                : transcriptSegments.findIndex(
                      (segment) => getSegmentEnd(segment) >= positionSec,
                  );
        const centerIndex =
            nearbyIndex >= 0 ? nearbyIndex : transcriptSegments.length - 1;
        const startIndex = Math.max(0, centerIndex - 1);

        return transcriptSegments.slice(startIndex, startIndex + 3);
    }, [positionSec, transcriptSegments]);

    const activeChunk = chunks[activeChunkStart];
    const activeChunkPending = pendingChunks.includes(activeChunkStart);
    const testText =
        testResult?.segments.map((segment) => segment.text).join("\n").trim() ??
        "";
    const chunkButtonLabel = checkingLocalWhisper
        ? "checking local…"
        : !localWhisperOnline
          ? "local offline"
          : activeChunkPending
            ? "transcribing…"
            : activeChunk?.cached
              ? "chunk cached"
              : "load chunk";
    const testButtonLabel = testTranscript.isPending
        ? `running ${(testElapsedMs / 1000).toFixed(1)}s`
        : checkingLocalWhisper
          ? "checking"
          : !localWhisperOnline
            ? "waiting"
            : "test 0-20s";
    const compactTranscriptText = visibleTranscriptSegments
        .map((segment) => segment.text)
        .join(" ")
        .trim();
    const compactTranscript = (
        <div className="mb-3 rounded-lg border border-zinc-800 bg-zinc-950/80 px-3 py-2">
            {visibleTranscriptSegments.length === 0 ? (
                <p className="py-2 text-center text-xs text-zinc-500">
                    Press play and transcript text will appear here.
                </p>
            ) : (
                <p
                    dir={isArabic(compactTranscriptText) ? "rtl" : "ltr"}
                    className={cn(
                        "line-clamp-4 text-sm leading-7 text-zinc-300",
                        isArabic(compactTranscriptText) && "text-right",
                    )}
                >
                    {visibleTranscriptSegments.map((segment, index) => {
                        const words =
                            segment.words && segment.words.length > 0
                                ? segment.words
                                : [];

                        return (
                            <span
                                key={
                                    segment.id ??
                                    `${getSegmentStart(segment)}-${index}`
                                }
                            >
                                {words.length > 0
                                    ? words.map((word, wordIndex) => (
                                          <span
                                              key={`${word.startSec}-${wordIndex}`}
                                              className={cn(
                                                  "rounded px-0.5 transition-colors",
                                                  wordIsActive(
                                                      word,
                                                      positionSec,
                                                  ) &&
                                                      "bg-emerald-400 text-zinc-950",
                                              )}
                                          >
                                              {word.word}{" "}
                                          </span>
                                      ))
                                    : `${segment.text} `}
                            </span>
                        );
                    })}
                </p>
            )}
        </div>
    );

    return (
        <div className="space-y-4">
            <AudioPlayer
                src={audioSrc}
                audioRef={audioRef}
                beforeControls={compactTranscript}
            />
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl shadow-black/30">
                <div className="border-b border-zinc-800 bg-zinc-900/70 px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <p className="font-mono text-[10px] uppercase text-emerald-400">
                                Podcast transcript
                            </p>
                            <p className="mt-1 text-xs text-zinc-500">
                                Showing the current transcript text
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() =>
                                requestChunk(activeChunkStart, { force: true })
                            }
                            disabled={
                                activeChunkPending ||
                                checkingLocalWhisper ||
                                !localWhisperOnline
                            }
                            className="rounded-lg border border-emerald-800 bg-emerald-950/60 px-3 py-1.5 font-mono text-xs text-emerald-300 transition-colors hover:bg-emerald-900/60 disabled:opacity-50"
                        >
                            {chunkButtonLabel}
                        </button>
                    </div>

                    {pendingChunks.length > 0 && (
                        <p className="mt-2 font-mono text-[10px] text-zinc-500">
                            Working on{" "}
                            {[...pendingChunks]
                                .sort((a, b) => a - b)
                                .map((chunk) => formatTime(chunk))
                                .join(", ")}
                        </p>
                    )}
                    {!checkingLocalWhisper && !localWhisperOnline && (
                        <p className="mt-2 text-xs text-amber-300">
                            {localWhisperStatus === "loading"
                                ? `Local Whisper is warming up${
                                      localTranscriberHealth?.loadSeconds
                                          ? ` (${localTranscriberHealth.loadSeconds.toFixed(1)}s)`
                                          : ""
                                  }.`
                                : "Local Whisper is required."}{" "}
                            Run{" "}
                            <code className="rounded bg-zinc-800 px-1 py-0.5 font-mono text-[11px] text-amber-200">
                                bun run transcriber:dev
                            </code>{" "}
                            and retry when ready.
                        </p>
                    )}
                    {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
                </div>

                <div className="border-b border-zinc-800 px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <p className="font-mono text-[10px] uppercase text-sky-400">
                                Transcribe test
                            </p>
                            <p className="mt-1 font-mono text-[11px] text-zinc-500">
                                00:00-00:20 ·{" "}
                                {(testElapsedMs / 1000).toFixed(1)}s
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() =>
                                testTranscript.mutate({
                                    fileId,
                                    language: "ar",
                                })
                            }
                            disabled={
                                testTranscript.isPending ||
                                checkingLocalWhisper ||
                                !localWhisperOnline
                            }
                            className="rounded-lg border border-sky-800 bg-sky-950/60 px-3 py-1.5 font-mono text-xs text-sky-300 transition-colors hover:bg-sky-900/60 disabled:opacity-50"
                        >
                            {testButtonLabel}
                        </button>
                    </div>

                    {testError && (
                        <p className="mt-2 text-xs text-red-400">{testError}</p>
                    )}
                    {testResult && (
                        <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-900/70 p-3">
                            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 font-mono text-[10px] uppercase text-zinc-500">
                                <span>
                                    {testResult.segments.length} segments ·{" "}
                                    {(testResult.elapsedMs / 1000).toFixed(1)}s
                                </span>
                                <span>not saved</span>
                            </div>
                            <p
                                dir={isArabic(testText) ? "rtl" : "ltr"}
                                className={cn(
                                    "whitespace-pre-wrap text-sm leading-7 text-zinc-300",
                                    isArabic(testText) && "text-right",
                                )}
                            >
                                {testText || "No transcript text returned."}
                            </p>
                        </div>
                    )}
                </div>

                <div className="space-y-2 p-3">
                    {transcriptSegments.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-zinc-800 px-4 py-8 text-center">
                            <p className="text-sm text-zinc-500">
                                Press play and the first 30-second chunk will
                                transcribe here.
                            </p>
                        </div>
                    ) : (
                        <p
                            dir={
                                isArabic(compactTranscriptText)
                                    ? "rtl"
                                    : "ltr"
                            }
                            className={cn(
                                "rounded-xl border border-zinc-800 bg-zinc-900/70 p-3 text-sm leading-7 text-zinc-300",
                                isArabic(compactTranscriptText) && "text-right",
                            )}
                        >
                            {visibleTranscriptSegments.map((segment, index) => {
                                const words =
                                    segment.words && segment.words.length > 0
                                        ? segment.words
                                        : [];

                                return (
                                    <span
                                        key={
                                            segment.id ??
                                            `${getSegmentStart(segment)}-${index}`
                                        }
                                    >
                                        {words.length > 0
                                            ? words.map((word, wordIndex) => (
                                                  <span
                                                      key={`${word.startSec}-${wordIndex}`}
                                                      className={cn(
                                                          "rounded px-0.5 transition-colors",
                                                          wordIsActive(
                                                              word,
                                                              positionSec,
                                                          ) &&
                                                              "bg-emerald-400 text-zinc-950",
                                                      )}
                                                  >
                                                      {word.word}{" "}
                                                  </span>
                                              ))
                                            : `${segment.text} `}
                                    </span>
                                );
                            })}
                        </p>
                    )}
                </div>
            </div>
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
            setSuggestions((prev) => (prev.length > 0 ? [] : prev));
            setOpen((prev) => (prev ? false : prev));
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
        setSuggestions((prev) =>
            prev.length === filtered.length &&
            prev.every((value, index) => value === filtered[index])
                ? prev
                : filtered,
        );
        setOpen((prev) => {
            const next = filtered.length > 0;
            return prev === next ? prev : next;
        });
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

                    {/* Audio player + compact transcript */}
                    {isAudio && audioSrc && fileId && media?.id && (
                        <TranscriptSection
                            mediaId={media.id}
                            fileId={fileId}
                            audioSrc={audioSrc}
                            audioRef={audioRef}
                        />
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
