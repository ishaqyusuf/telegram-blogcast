"use client";

import { _trpc } from "@/components/static-trpc";
import { cn } from "@acme/ui/cn";
import { useMutation, useQuery, useQueryClient } from "@acme/ui/tanstack";
import Link from "next/link";
import { useMemo, useState } from "react";

type AiModel = "gpt-5" | "gpt-4o" | "gemini";

type SyncResult = {
    book: {
        id: number;
        nameAr?: string | null;
        nameEn?: string | null;
        coverUrl?: string | null;
        coverColor?: string | null;
        category?: string | null;
        shamelaUrl?: string | null;
        authors: { id: number; name: string; nameAr?: string | null }[];
        shelf: { id: number; name: string; nameAr?: string | null } | null;
    };
    created: boolean;
    chaptersImported: number;
    historyId: number;
    importedPage: {
        id: number;
        shamelaPageNo: number;
        printedPageNo?: number | null;
        chapterTitle?: string | null;
        topicTitle?: string | null;
        importHistoryId: number;
    } | null;
};

type ManualResult = {
    bookId: number;
    page: {
        id: number;
        chapterTitle?: string | null;
        topicTitle?: string | null;
        shamelaPageNo: number;
        printedPageNo?: number | null;
    };
    historyId: number;
};

type PreviewResult = {
    sourceUrl: string;
    normalizedUrl: string;
    shamelaId: number;
    bookIndexUrl: string;
    linkedPageUrl: string | null;
    aiProvider: "openai" | "gemini";
    aiModel: AiModel;
    previewJson: {
        metadata: Record<string, unknown>;
        toc: {
            volumes: { number: number; title: string | null }[];
            chapterCount: number;
            chapters: {
                shamelaPageNo: number;
                shamelaUrl: string;
                chapterTitle: string | null;
                topicTitle: string | null;
                volumeNumber: number;
            }[];
            truncated: boolean;
        };
        linkedPage: Record<string, unknown> | null;
    };
};

const AI_MODELS: { value: AiModel; label: string; helper: string }[] = [
    { value: "gpt-5", label: "GPT-5", helper: "Best extraction quality" },
    { value: "gpt-4o", label: "GPT-4o", helper: "Balanced speed" },
    { value: "gemini", label: "Gemini", helper: "Alternative parser" },
];

function fmtDate(value?: string | Date | null) {
    if (!value) return "pending";

    const date = typeof value === "string" ? new Date(value) : value;
    if (Number.isNaN(date.getTime())) return "pending";

    return new Intl.DateTimeFormat("en", {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(date);
}

function statusTone(status?: string | null) {
    switch (status) {
        case "success":
            return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
        case "failed":
            return "border-red-500/30 bg-red-500/10 text-red-200";
        default:
            return "border-amber-500/30 bg-amber-500/10 text-amber-100";
    }
}

function bookLabel(book: any) {
    return (
        book?.nameAr ??
        book?.nameEn ??
        (typeof book?.id === "number" ? `Book #${book.id}` : "Untitled book")
    );
}

function readText(
    record: Record<string, unknown> | null | undefined,
    ...keys: string[]
) {
    for (const key of keys) {
        const value = record?.[key];
        if (typeof value === "string" && value.trim()) return value.trim();
    }
    return null;
}

function Metric({
    label,
    value,
    helper,
}: {
    label: string;
    value: string;
    helper?: string;
}) {
    return (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-[11px] uppercase tracking-[0.28em] text-zinc-500">
                {label}
            </div>
            <div className="mt-2 text-2xl font-semibold text-zinc-100">
                {value}
            </div>
            {helper ? (
                <div className="mt-1 text-sm text-zinc-400">{helper}</div>
            ) : null}
        </div>
    );
}

export default function BookImportPage() {
    const queryClient = useQueryClient();

    const [activeLane, setActiveLane] = useState<"url" | "manual">("url");
    const [url, setUrl] = useState("");
    const [aiModel, setAiModel] = useState<AiModel>("gpt-5");
    const [preview, setPreview] = useState<PreviewResult | null>(null);
    const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
    const [syncError, setSyncError] = useState<string | null>(null);

    const [createBookInline, setCreateBookInline] = useState(false);
    const [selectedBookId, setSelectedBookId] = useState<string>("");
    const [manualBookName, setManualBookName] = useState("");
    const [manualLink, setManualLink] = useState("");
    const [manualPageNo, setManualPageNo] = useState("");
    const [manualPrintedPageNo, setManualPrintedPageNo] = useState("");
    const [manualChapterTitle, setManualChapterTitle] = useState("");
    const [manualTopicTitle, setManualTopicTitle] = useState("");
    const [manualText, setManualText] = useState("");
    const [manualError, setManualError] = useState<string | null>(null);
    const [manualResult, setManualResult] = useState<ManualResult | null>(null);

    const { data: booksData } = useQuery(
        _trpc.book.getBooks.queryOptions({ limit: 50 }),
    );
    const { data: importHistory } = useQuery(
        _trpc.book.getBookImportHistory.queryOptions({ limit: 12 }),
    );

    const books = useMemo(
        () =>
            Array.isArray((booksData as any)?.data)
                ? ((booksData as any).data as any[])
                : [],
        [booksData],
    );

    const history = useMemo(
        () => (Array.isArray(importHistory) ? importHistory : []),
        [importHistory],
    );

    const invalidateBookQueries = async () => {
        await Promise.all([
            queryClient.invalidateQueries({
                queryKey: _trpc.book.getBooks.queryKey(),
            }),
            queryClient.invalidateQueries({
                queryKey: _trpc.book.getBookImportHistory.queryKey(),
            }),
        ]);
    };

    const previewMutation = useMutation(
        _trpc.book.previewBookImportFromShamela.mutationOptions({
            onMutate: () => {
                setSyncError(null);
                setSyncResult(null);
            },
            onSuccess: (data) => {
                setPreview(data as PreviewResult);
                setActiveLane("url");
            },
            onError: (error) => {
                setPreview(null);
                setSyncError(error.message);
            },
        }),
    );

    const syncMutation = useMutation(
        _trpc.book.syncBookFromShamela.mutationOptions({
            onMutate: () => {
                setSyncError(null);
                setSyncResult(null);
            },
            onSuccess: async (data) => {
                setSyncResult(data as SyncResult);
                setUrl("");
                await invalidateBookQueries();
            },
            onError: (error) => {
                setSyncError(error.message);
            },
        }),
    );

    const manualMutation = useMutation(
        _trpc.book.importBookPageManually.mutationOptions({
            onMutate: () => {
                setManualError(null);
                setManualResult(null);
            },
            onSuccess: async (data) => {
                setManualResult(data as ManualResult);
                setManualText("");
                setManualPageNo("");
                setManualPrintedPageNo("");
                setManualChapterTitle("");
                setManualTopicTitle("");
                await invalidateBookQueries();
            },
            onError: (error) => {
                setManualError(error.message);
            },
        }),
    );

    const previewMeta = preview?.previewJson?.metadata ?? null;
    const previewToc = preview?.previewJson?.toc ?? null;
    const previewPage = preview?.previewJson?.linkedPage ?? null;

    const previewTitle =
        readText(previewMeta, "nameAr", "titleAr", "nameEn", "title") ??
        "Untitled import";
    const previewAuthor =
        readText(previewMeta, "authorName", "authorNameAr", "author") ??
        "Author not detected";
    const previewCategory =
        readText(previewMeta, "category", "categoryAr") ?? "Unclassified";

    function handlePreview() {
        const trimmed = url.trim();
        if (!trimmed) {
            setSyncError("Paste a Shamela book URL first.");
            return;
        }

        previewMutation.mutate({
            shamelaUrl: trimmed,
            aiModel,
        });
    }

    function handleImport() {
        const sourceUrl = preview?.sourceUrl ?? url.trim();
        if (!sourceUrl) {
            setSyncError("Generate a preview before starting the import.");
            return;
        }

        syncMutation.mutate({
            shamelaUrl: sourceUrl,
            aiModel,
        });
    }

    function handleManualImport() {
        const pageText = manualText.trim();
        if (!pageText) {
            setManualError("Paste the page content before importing.");
            return;
        }

        if (createBookInline && !manualBookName.trim()) {
            setManualError("Enter a book title for the new record.");
            return;
        }

        if (!createBookInline && !selectedBookId) {
            setManualError("Choose an existing book or switch to create new.");
            return;
        }

        const shamelaPageNo = manualPageNo.trim()
            ? Number(manualPageNo.trim())
            : undefined;
        const printedPageNo = manualPrintedPageNo.trim()
            ? Number(manualPrintedPageNo.trim())
            : undefined;

        if (
            shamelaPageNo !== undefined &&
            (!Number.isFinite(shamelaPageNo) || shamelaPageNo <= 0)
        ) {
            setManualError("Shamela page number must be a positive number.");
            return;
        }

        if (
            printedPageNo !== undefined &&
            (!Number.isFinite(printedPageNo) || printedPageNo <= 0)
        ) {
            setManualError("Printed page number must be a positive number.");
            return;
        }

        manualMutation.mutate({
            bookId: createBookInline ? undefined : Number(selectedBookId),
            createBook: createBookInline
                ? {
                      nameAr: manualBookName.trim(),
                      shamelaUrl: manualLink.trim() || undefined,
                  }
                : undefined,
            sourceUrl: manualLink.trim() || undefined,
            shamelaPageNo,
            printedPageNo,
            chapterTitle: manualChapterTitle.trim() || undefined,
            topicTitle: manualTopicTitle.trim() || undefined,
            pageText,
        });
    }

    return (
        <div className="min-h-screen bg-[#07090f] text-zinc-100">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(182,140,54,0.2),transparent_32%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.14),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent_38%)]" />

            <div className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
                <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div className="max-w-3xl">
                        <div className="text-[11px] uppercase tracking-[0.35em] text-emerald-300/80">
                            Library Operations
                        </div>
                        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-zinc-50">
                            Book import workspace
                        </h1>
                        <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
                            Preview and import Shamela books, or manually paste
                            pages when the source needs cleanup before it enters
                            the library.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <Link
                            href="/dashboard"
                            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-200 transition hover:border-emerald-400/40 hover:bg-emerald-400/10"
                        >
                            Back to dashboard
                        </Link>
                        <a
                            href={preview?.bookIndexUrl ?? "https://shamela.ws"}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-full border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-sm text-amber-100 transition hover:border-amber-300/60 hover:bg-amber-300/10"
                        >
                            Open Shamela
                        </a>
                    </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                    <Metric
                        label="Tracked Books"
                        value={String(books.length)}
                        helper="Available for manual page assignment"
                    />
                    <Metric
                        label="Recent Imports"
                        value={String(history.length)}
                        helper="Deduplicated import history entries"
                    />
                    <Metric
                        label="Detected Chapters"
                        value={String(previewToc?.chapterCount ?? 0)}
                        helper={
                            preview
                                ? `Previewed with ${preview.aiModel.toUpperCase()}`
                                : "Run a preview to inspect the TOC"
                        }
                    />
                </div>

                <div className="mt-8 grid gap-6 xl:grid-cols-[1.5fr_1fr]">
                    <div className="space-y-6">
                        <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-2">
                            <div className="grid gap-2 md:grid-cols-2">
                                <button
                                    type="button"
                                    onClick={() => setActiveLane("url")}
                                    className={cn(
                                        "rounded-[22px] px-4 py-3 text-left transition",
                                        activeLane === "url"
                                            ? "bg-zinc-100 text-zinc-950"
                                            : "bg-transparent text-zinc-400 hover:bg-white/5 hover:text-zinc-200",
                                    )}
                                >
                                    <div className="text-sm font-semibold">
                                        Shamela URL import
                                    </div>
                                    <div className="mt-1 text-xs opacity-80">
                                        Preview metadata, TOC, and linked page
                                        before writing to the database.
                                    </div>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveLane("manual")}
                                    className={cn(
                                        "rounded-[22px] px-4 py-3 text-left transition",
                                        activeLane === "manual"
                                            ? "bg-zinc-100 text-zinc-950"
                                            : "bg-transparent text-zinc-400 hover:bg-white/5 hover:text-zinc-200",
                                    )}
                                >
                                    <div className="text-sm font-semibold">
                                        Manual paste
                                    </div>
                                    <div className="mt-1 text-xs opacity-80">
                                        Rescue edge cases or add pages from a
                                        cleaned source.
                                    </div>
                                </button>
                            </div>
                        </div>

                        <section
                            className={cn(
                                "rounded-[32px] border border-white/10 bg-[#0d1118]/90 p-6 shadow-[0_32px_80px_rgba(0,0,0,0.35)] backdrop-blur",
                                activeLane !== "url" && "opacity-70",
                            )}
                        >
                            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                                <div>
                                    <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                                        Source Import
                                    </div>
                                    <h2 className="mt-2 text-2xl font-semibold text-zinc-50">
                                        Shamela preview and sync
                                    </h2>
                                </div>
                                <div className="grid flex-1 gap-2 sm:grid-cols-3 md:max-w-xl">
                                    {AI_MODELS.map((option) => (
                                        <button
                                            key={option.value}
                                            type="button"
                                            onClick={() => setAiModel(option.value)}
                                            className={cn(
                                                "rounded-2xl border px-3 py-3 text-left transition",
                                                aiModel === option.value
                                                    ? "border-emerald-400/50 bg-emerald-400/10 text-emerald-50"
                                                    : "border-white/10 bg-white/[0.03] text-zinc-300 hover:border-white/20 hover:bg-white/[0.06]",
                                            )}
                                        >
                                            <div className="text-sm font-semibold">
                                                {option.label}
                                            </div>
                                            <div className="mt-1 text-xs text-zinc-400">
                                                {option.helper}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="mt-6 rounded-[28px] border border-white/10 bg-black/20 p-4">
                                <label className="text-xs uppercase tracking-[0.28em] text-zinc-500">
                                    Shamela URL
                                </label>
                                <div className="mt-3 flex flex-col gap-3 md:flex-row">
                                    <input
                                        value={url}
                                        onChange={(e) => setUrl(e.target.value)}
                                        placeholder="https://shamela.ws/book/..."
                                        className="h-12 flex-1 rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-emerald-400/40"
                                    />
                                    <button
                                        type="button"
                                        onClick={handlePreview}
                                        disabled={previewMutation.isPending}
                                        className="h-12 rounded-2xl bg-zinc-100 px-5 text-sm font-semibold text-zinc-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        {previewMutation.isPending
                                            ? "Previewing..."
                                            : "Generate preview"}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleImport}
                                        disabled={
                                            syncMutation.isPending ||
                                            previewMutation.isPending
                                        }
                                        className="h-12 rounded-2xl border border-emerald-400/30 bg-emerald-400/15 px-5 text-sm font-semibold text-emerald-50 transition hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        {syncMutation.isPending
                                            ? "Importing..."
                                            : "Import book"}
                                    </button>
                                </div>
                                <div className="mt-3 text-xs text-zinc-500">
                                    Preview first to inspect the extracted title,
                                    author, table of contents, and linked page.
                                </div>
                            </div>

                            {syncError ? (
                                <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                                    {syncError}
                                </div>
                            ) : null}

                            {preview ? (
                                <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                                    <div className="rounded-[28px] border border-amber-300/15 bg-amber-300/[0.06] p-5">
                                        <div className="text-xs uppercase tracking-[0.28em] text-amber-100/70">
                                            Preview Summary
                                        </div>
                                        <h3 className="mt-3 text-2xl font-semibold text-zinc-50">
                                            {previewTitle}
                                        </h3>
                                        <div className="mt-3 flex flex-wrap gap-2 text-xs">
                                            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-zinc-300">
                                                {previewAuthor}
                                            </span>
                                            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-zinc-300">
                                                {previewCategory}
                                            </span>
                                            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-zinc-300">
                                                Shamela #{preview.shamelaId}
                                            </span>
                                        </div>
                                        <div className="mt-5 grid gap-3 sm:grid-cols-3">
                                            <Metric
                                                label="Volumes"
                                                value={String(
                                                    previewToc?.volumes?.length ??
                                                        0,
                                                )}
                                            />
                                            <Metric
                                                label="Chapters"
                                                value={String(
                                                    previewToc?.chapterCount ?? 0,
                                                )}
                                            />
                                            <Metric
                                                label="Linked Page"
                                                value={
                                                    preview.linkedPageUrl
                                                        ? "Yes"
                                                        : "No"
                                                }
                                            />
                                        </div>
                                        <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-zinc-300">
                                            <div className="font-medium text-zinc-100">
                                                Source URL
                                            </div>
                                            <div className="mt-2 break-all text-zinc-400">
                                                {preview.normalizedUrl}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
                                        <div className="text-xs uppercase tracking-[0.28em] text-zinc-500">
                                            Linked Page
                                        </div>
                                        <div className="mt-4 space-y-3 text-sm">
                                            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                                <div className="text-zinc-500">
                                                    Chapter
                                                </div>
                                                <div className="mt-1 text-zinc-100">
                                                    {readText(
                                                        previewPage,
                                                        "chapterTitle",
                                                    ) ?? "Not detected"}
                                                </div>
                                            </div>
                                            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                                <div className="text-zinc-500">
                                                    Topic
                                                </div>
                                                <div className="mt-1 text-zinc-100">
                                                    {readText(
                                                        previewPage,
                                                        "topicTitle",
                                                    ) ?? "Not detected"}
                                                </div>
                                            </div>
                                            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                                <div className="text-zinc-500">
                                                    Extractor
                                                </div>
                                                <div className="mt-1 text-zinc-100">
                                                    {preview.aiModel.toUpperCase()} via{" "}
                                                    {preview.aiProvider}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : null}

                            {syncResult ? (
                                <div className="mt-6 rounded-[28px] border border-emerald-400/30 bg-emerald-400/10 p-5">
                                    <div className="text-xs uppercase tracking-[0.28em] text-emerald-100/70">
                                        Import Complete
                                    </div>
                                    <h3 className="mt-3 text-2xl font-semibold text-white">
                                        {bookLabel(syncResult.book)}
                                    </h3>
                                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                                        <Metric
                                            label="History ID"
                                            value={String(syncResult.historyId)}
                                        />
                                        <Metric
                                            label="Chapters Imported"
                                            value={String(
                                                syncResult.chaptersImported,
                                            )}
                                        />
                                        <Metric
                                            label="Action"
                                            value={
                                                syncResult.created
                                                    ? "Created"
                                                    : "Updated"
                                            }
                                        />
                                    </div>
                                    {syncResult.importedPage ? (
                                        <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-zinc-200">
                                            Linked page #{syncResult.importedPage.shamelaPageNo}
                                            {syncResult.importedPage.chapterTitle
                                                ? ` · ${syncResult.importedPage.chapterTitle}`
                                                : ""}
                                        </div>
                                    ) : null}
                                </div>
                            ) : null}
                        </section>

                        <section
                            className={cn(
                                "rounded-[32px] border border-white/10 bg-[#0d1118]/90 p-6 shadow-[0_32px_80px_rgba(0,0,0,0.35)] backdrop-blur",
                                activeLane !== "manual" && "opacity-70",
                            )}
                        >
                            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                                <div>
                                    <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                                        Manual Recovery
                                    </div>
                                    <h2 className="mt-2 text-2xl font-semibold text-zinc-50">
                                        Paste page content
                                    </h2>
                                </div>

                                <button
                                    type="button"
                                    onClick={() =>
                                        setCreateBookInline((value) => !value)
                                    }
                                    className={cn(
                                        "rounded-full px-4 py-2 text-sm font-medium transition",
                                        createBookInline
                                            ? "bg-amber-300 text-zinc-950"
                                            : "border border-white/10 bg-white/[0.04] text-zinc-200 hover:bg-white/[0.08]",
                                    )}
                                >
                                    {createBookInline
                                        ? "Creating new book"
                                        : "Attach to existing book"}
                                </button>
                            </div>

                            <div className="mt-6 grid gap-4 md:grid-cols-2">
                                {createBookInline ? (
                                    <label className="block">
                                        <div className="mb-2 text-sm text-zinc-400">
                                            New book title
                                        </div>
                                        <input
                                            value={manualBookName}
                                            onChange={(e) =>
                                                setManualBookName(
                                                    e.target.value,
                                                )
                                            }
                                            placeholder="كتاب جديد"
                                            className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-amber-300/40"
                                        />
                                    </label>
                                ) : (
                                    <label className="block">
                                        <div className="mb-2 text-sm text-zinc-400">
                                            Existing book
                                        </div>
                                        <select
                                            value={selectedBookId}
                                            onChange={(e) =>
                                                setSelectedBookId(
                                                    e.target.value,
                                                )
                                            }
                                            className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-zinc-100 outline-none transition focus:border-amber-300/40"
                                        >
                                            <option value="">
                                                Select a book
                                            </option>
                                            {books.map((book) => (
                                                <option
                                                    key={book.id}
                                                    value={String(book.id)}
                                                >
                                                    {bookLabel(book)}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                )}

                                <label className="block">
                                    <div className="mb-2 text-sm text-zinc-400">
                                        Source URL
                                    </div>
                                    <input
                                        value={manualLink}
                                        onChange={(e) =>
                                            setManualLink(e.target.value)
                                        }
                                        placeholder="https://shamela.ws/book/..."
                                        className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-amber-300/40"
                                    />
                                </label>

                                <label className="block">
                                    <div className="mb-2 text-sm text-zinc-400">
                                        Shamela page number
                                    </div>
                                    <input
                                        value={manualPageNo}
                                        onChange={(e) =>
                                            setManualPageNo(e.target.value)
                                        }
                                        placeholder="112"
                                        className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-amber-300/40"
                                    />
                                </label>

                                <label className="block">
                                    <div className="mb-2 text-sm text-zinc-400">
                                        Printed page number
                                    </div>
                                    <input
                                        value={manualPrintedPageNo}
                                        onChange={(e) =>
                                            setManualPrintedPageNo(
                                                e.target.value,
                                            )
                                        }
                                        placeholder="77"
                                        className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-amber-300/40"
                                    />
                                </label>

                                <label className="block">
                                    <div className="mb-2 text-sm text-zinc-400">
                                        Chapter title
                                    </div>
                                    <input
                                        value={manualChapterTitle}
                                        onChange={(e) =>
                                            setManualChapterTitle(
                                                e.target.value,
                                            )
                                        }
                                        placeholder="باب ..."
                                        className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-amber-300/40"
                                    />
                                </label>

                                <label className="block">
                                    <div className="mb-2 text-sm text-zinc-400">
                                        Topic title
                                    </div>
                                    <input
                                        value={manualTopicTitle}
                                        onChange={(e) =>
                                            setManualTopicTitle(e.target.value)
                                        }
                                        placeholder="فصل ..."
                                        className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-amber-300/40"
                                    />
                                </label>
                            </div>

                            <div className="mt-4">
                                <label className="block">
                                    <div className="mb-2 text-sm text-zinc-400">
                                        Page content
                                    </div>
                                    <textarea
                                        value={manualText}
                                        onChange={(e) =>
                                            setManualText(e.target.value)
                                        }
                                        placeholder="Paste cleaned paragraphs here..."
                                        className="min-h-[260px] w-full rounded-[28px] border border-white/10 bg-black/20 px-4 py-4 text-sm leading-7 text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-amber-300/40"
                                    />
                                </label>
                            </div>

                            {manualError ? (
                                <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                                    {manualError}
                                </div>
                            ) : null}

                            {manualResult ? (
                                <div className="mt-4 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-50">
                                    Added page #{manualResult.page.shamelaPageNo} to
                                    book #{manualResult.bookId}. History entry #
                                    {manualResult.historyId}.
                                </div>
                            ) : null}

                            <div className="mt-5 flex flex-wrap gap-3">
                                <button
                                    type="button"
                                    onClick={handleManualImport}
                                    disabled={manualMutation.isPending}
                                    className="rounded-2xl bg-amber-300 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {manualMutation.isPending
                                        ? "Saving page..."
                                        : "Import pasted page"}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setManualText("");
                                        setManualError(null);
                                        setManualResult(null);
                                    }}
                                    className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-zinc-200 transition hover:bg-white/[0.08]"
                                >
                                    Clear pasted text
                                </button>
                            </div>
                        </section>
                    </div>

                    <aside className="space-y-6">
                        <section className="rounded-[32px] border border-white/10 bg-white/[0.04] p-6">
                            <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                                Recent Activity
                            </div>
                            <h2 className="mt-2 text-2xl font-semibold text-zinc-50">
                                Import history
                            </h2>

                            <div className="mt-5 space-y-3">
                                {history.length === 0 ? (
                                    <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 px-4 py-8 text-sm text-zinc-500">
                                        No import history yet.
                                    </div>
                                ) : (
                                    history.map((entry: any) => (
                                        <div
                                            key={entry.id}
                                            className="rounded-[24px] border border-white/10 bg-black/20 p-4"
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <div className="text-sm font-semibold text-zinc-100">
                                                        {bookLabel(entry.book)}
                                                    </div>
                                                    <div className="mt-1 text-xs text-zinc-500">
                                                        {fmtDate(
                                                            entry.finishedAt ??
                                                                entry.createdAt,
                                                        )}
                                                    </div>
                                                </div>
                                                <span
                                                    className={cn(
                                                        "rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.2em]",
                                                        statusTone(entry.status),
                                                    )}
                                                >
                                                    {entry.status ?? "pending"}
                                                </span>
                                            </div>

                                            <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-zinc-400">
                                                <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                                                    {entry.importMode ?? "link"}
                                                </span>
                                                {entry.provider ? (
                                                    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                                                        {entry.provider}
                                                    </span>
                                                ) : null}
                                                <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                                                    {entry.chaptersImported ?? 0} chapters
                                                </span>
                                            </div>

                                            <div className="mt-3 break-all text-xs leading-5 text-zinc-500">
                                                {entry.normalizedUrl ??
                                                    entry.sourceUrl}
                                            </div>

                                            {entry.errorMessage ? (
                                                <div className="mt-3 rounded-2xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs leading-5 text-red-100">
                                                    {entry.errorMessage}
                                                </div>
                                            ) : null}
                                        </div>
                                    ))
                                )}
                            </div>
                        </section>

                        <section className="rounded-[32px] border border-white/10 bg-white/[0.04] p-6">
                            <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                                Notes
                            </div>
                            <div className="mt-4 space-y-3 text-sm leading-6 text-zinc-400">
                                <p>
                                    Use URL import when the Shamela structure is
                                    clean and you want metadata, TOC, and a
                                    linked page pulled together.
                                </p>
                                <p>
                                    Use manual paste when OCR cleanup or custom
                                    editorial fixes are needed before the page
                                    enters the reading flow.
                                </p>
                                <p>
                                    Existing books are loaded from the same
                                    catalog used by the mobile reader, so manual
                                    imports land in the shared library.
                                </p>
                            </div>
                        </section>
                    </aside>
                </div>
            </div>
        </div>
    );
}
