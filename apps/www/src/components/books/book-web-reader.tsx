"use client";

import { BookWebShell } from "@/components/books/book-web-shell";
import { _trpc } from "@/components/static-trpc";
import {
    getSwipeBookDirection,
    normalizeBookmarkedPageIds,
    resolveBookTextSegments,
    resolveAdjacentPageAction,
    toggleBookmarkedPageId,
    type BookSourceMark,
} from "@acme/document/book";
import { useMutation, useQuery, useQueryClient } from "@acme/ui/tanstack";
import {
    Bookmark,
    BookmarkCheck,
    ChevronLeft,
    ChevronRight,
    ListTree,
    LoaderCircle,
    Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

const BOOKMARK_KEY = "al-ghurobaa:web-bookmarks:v1";
const HIGHLIGHT_COLORS = [
    "#8b5cf6",
    "#facc15",
    "#22c55e",
    "#38bdf8",
    "#fb7185",
    "#f97316",
];

type SelectionRange = {
    paragraphId: number;
    startOffset: number;
    endOffset: number;
    quoteText: string;
};

function readBookmarks() {
    try {
        return normalizeBookmarkedPageIds(
            JSON.parse(localStorage.getItem(BOOKMARK_KEY) ?? "[]"),
        );
    } catch {
        return [];
    }
}

function paragraphSelection(
    element: HTMLElement,
    paragraphId: number,
): SelectionRange | null {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed)
        return null;
    const range = selection.getRangeAt(0);
    if (!element.contains(range.commonAncestorContainer)) return null;
    const before = document.createRange();
    before.selectNodeContents(element);
    before.setEnd(range.startContainer, range.startOffset);
    const startOffset = before.toString().length;
    const quoteText = range.toString();
    if (!quoteText.trim()) return null;
    return {
        paragraphId,
        startOffset,
        endOffset: startOffset + quoteText.length,
        quoteText,
    };
}

export function BookWebReader({
    bookId,
    pageId,
}: {
    bookId: number;
    pageId: number;
}) {
    const router = useRouter();
    const queryClient = useQueryClient();
    const touchStart = useRef<number | null>(null);
    const [selection, setSelection] = useState<SelectionRange | null>(null);
    const [bookmarked, setBookmarked] = useState(false);
    const { data: page, isLoading } = useQuery(
        _trpc.book.getPage.queryOptions({ pageId }),
    );
    const addHighlight = useMutation(_trpc.book.addHighlight.mutationOptions());
    const deleteHighlight = useMutation(
        _trpc.book.deleteHighlight.mutationOptions(),
    );
    const fetchAdjacent = useMutation(
        _trpc.book.captureShamelaPageFromUrl.mutationOptions(),
    );
    const fetchCurrent = useMutation(
        _trpc.book.captureShamelaPageFromUrl.mutationOptions(),
    );

    useEffect(() => setBookmarked(readBookmarks().includes(pageId)), [pageId]);

    const invalidatePage = async () => {
        await queryClient.invalidateQueries({
            queryKey: _trpc.book.getPage.queryKey({ pageId }),
        });
    };

    const toggleBookmark = () => {
        const next = toggleBookmarkedPageId(readBookmarks(), pageId);
        localStorage.setItem(BOOKMARK_KEY, JSON.stringify(next));
        setBookmarked(next.includes(pageId));
    };

    const saveHighlight = async (color: string) => {
        if (!selection || !page) return;
        const overlaps = page.highlights.filter(
            (highlight) =>
                highlight.paragraphId === selection.paragraphId &&
                highlight.startOffset < selection.endOffset &&
                highlight.endOffset > selection.startOffset,
        );
        for (const highlight of overlaps) {
            await deleteHighlight.mutateAsync({ id: highlight.id });
        }
        await addHighlight.mutateAsync({
            pageId,
            paragraphId: selection.paragraphId,
            startOffset: selection.startOffset,
            endOffset: selection.endOffset,
            color,
        });
        window.getSelection()?.removeAllRanges();
        setSelection(null);
        await invalidatePage();
    };

    const removeHighlight = async (id: number) => {
        await deleteHighlight.mutateAsync({ id });
        await invalidatePage();
    };

    const navigate = async (direction: "previous" | "next") => {
        if (!page || fetchAdjacent.isPending) return;
        const target = page.adjacentPages[direction];
        const action = resolveAdjacentPageAction(target);
        if (action.type === "reader") {
            router.push(`/books/${bookId}/reader/${action.pageId}`);
            return;
        }
        if (action.type === "boundary") return;
        const imported = await fetchAdjacent.mutateAsync({
            bookId,
            shamelaUrl: action.shamelaUrl,
        });
        router.push(`/books/${bookId}/reader/${imported.importedPage.id}`);
    };

    const paragraphs = page?.paragraphs ?? [];
    const currentLabel =
        page?.printedPageNo != null
            ? `ص ${page.printedPageNo}`
            : `#${page?.shamelaPageNo ?? ""}`;

    return (
        <BookWebShell
            title={page?.chapterTitle ?? page?.topicTitle ?? "قارئ الكتاب"}
            eyebrow={currentLabel}
            actions={
                <div className="flex items-center gap-2">
                    <Link
                        href={`/books/${bookId}`}
                        className="grid size-10 place-items-center rounded-full border border-[#d8d0c2]"
                        aria-label="فهرس الكتاب"
                    >
                        <ListTree size={18} />
                    </Link>
                    <button
                        type="button"
                        onClick={toggleBookmark}
                        className="grid size-10 place-items-center rounded-full border border-[#d8d0c2]"
                        aria-label="حفظ علامة"
                    >
                        {bookmarked ? (
                            <BookmarkCheck
                                size={18}
                                className="text-[#176b57]"
                            />
                        ) : (
                            <Bookmark size={18} />
                        )}
                    </button>
                </div>
            }
        >
            <div
                className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[1fr_260px] lg:px-8"
                onTouchStart={(event) => {
                    touchStart.current =
                        event.changedTouches[0]?.clientX ?? null;
                }}
                onTouchEnd={(event) => {
                    if (touchStart.current == null) return;
                    const delta =
                        (event.changedTouches[0]?.clientX ??
                            touchStart.current) - touchStart.current;
                    touchStart.current = null;
                    const direction = getSwipeBookDirection(delta, true);
                    if (direction) void navigate(direction);
                }}
            >
                <article className="rounded-[2rem] border border-[#d8d0c2] bg-[#fffdf8] shadow-[0_22px_70px_rgba(70,52,35,0.09)]">
                    <div className="flex items-center justify-between border-b border-[#e5ded2] px-5 py-3">
                        <button
                            type="button"
                            disabled={
                                !page?.adjacentPages.next.shamelaUrl ||
                                fetchAdjacent.isPending
                            }
                            onClick={() => void navigate("next")}
                            className="inline-flex min-h-10 items-center gap-2 rounded-full px-3 text-sm font-bold disabled:opacity-30"
                        >
                            <ChevronLeft size={17} /> التالية
                        </button>
                        <span className="rounded-full bg-[#ece5d9] px-3 py-1 text-xs font-bold text-[#776d61]">
                            {currentLabel}
                        </span>
                        <button
                            type="button"
                            disabled={
                                !page?.adjacentPages.previous.shamelaUrl ||
                                fetchAdjacent.isPending
                            }
                            onClick={() => void navigate("previous")}
                            className="inline-flex min-h-10 items-center gap-2 rounded-full px-3 text-sm font-bold disabled:opacity-30"
                        >
                            السابقة <ChevronRight size={17} />
                        </button>
                    </div>
                    {isLoading ? (
                        <div className="grid min-h-96 place-items-center">
                            <LoaderCircle className="animate-spin" />
                        </div>
                    ) : page?.status !== "fetched" ||
                      paragraphs.length === 0 ? (
                        <div className="p-12 text-center" dir="rtl">
                            <p className="font-bold">
                                هذه الصفحة لم تُحمّل بعد.
                            </p>
                            {page?.shamelaUrl ? (
                                <button
                                    type="button"
                                    className="mt-4 rounded-xl bg-[#173f35] px-5 py-3 font-bold text-white"
                                    onClick={async () => {
                                        const imported =
                                            await fetchCurrent.mutateAsync({
                                                bookId,
                                                shamelaUrl: page.shamelaUrl,
                                            });
                                        router.replace(
                                            `/books/${bookId}/reader/${imported.importedPage.id}`,
                                        );
                                        await invalidatePage();
                                    }}
                                >
                                    تحميل الصفحة
                                </button>
                            ) : null}
                        </div>
                    ) : (
                        <div
                            className="space-y-6 px-6 py-9 text-right md:px-12 md:py-12"
                            dir="rtl"
                        >
                            {page.topicTitle ? (
                                <h2 className="text-center text-lg font-black text-[#176b57]">
                                    {page.topicTitle}
                                </h2>
                            ) : null}
                            {paragraphs.map((paragraph) => {
                                const highlights = page.highlights
                                    .filter(
                                        (highlight) =>
                                            highlight.paragraphId ===
                                            paragraph.id,
                                    )
                                    .map((highlight) => ({
                                        start: highlight.startOffset,
                                        end: highlight.endOffset,
                                        color: `${highlight.color}55`,
                                    }));
                                const segments = resolveBookTextSegments({
                                    text: paragraph.text,
                                    sourceMarks: paragraph.sourceMarks as
                                        | BookSourceMark[]
                                        | null,
                                    highlights,
                                });
                                return (
                                    <p
                                        key={paragraph.id}
                                        onMouseUp={(event) =>
                                            setSelection(
                                                paragraphSelection(
                                                    event.currentTarget,
                                                    paragraph.id,
                                                ),
                                            )
                                        }
                                        className="select-text text-[20px] leading-[2.15] text-[#302920]"
                                    >
                                        {segments.map((segment) => (
                                            <span
                                                key={`${segment.start}-${segment.end}`}
                                                style={{
                                                    color:
                                                        segment.foregroundColor ??
                                                        undefined,
                                                    backgroundColor:
                                                        segment.backgroundColor ??
                                                        undefined,
                                                }}
                                            >
                                                {segment.text}
                                            </span>
                                        ))}
                                    </p>
                                );
                            })}
                        </div>
                    )}
                </article>
                <aside className="space-y-4">
                    <section
                        className="rounded-3xl border border-[#d8d0c2] bg-[#fffdf8] p-5"
                        dir="rtl"
                    >
                        <h3 className="font-black">التحديد والتظليل</h3>
                        <p className="mt-2 text-sm leading-6 text-[#776d61]">
                            حدّد نصاً في الصفحة، ثم اختر لون التظليل.
                        </p>
                        <div className="mt-4 flex flex-wrap gap-2">
                            {HIGHLIGHT_COLORS.map((color) => (
                                <button
                                    key={color}
                                    type="button"
                                    disabled={
                                        !selection || addHighlight.isPending
                                    }
                                    onClick={() => void saveHighlight(color)}
                                    className="size-9 rounded-full border-2 border-white shadow disabled:opacity-25"
                                    style={{ backgroundColor: color }}
                                    aria-label={`Highlight ${color}`}
                                />
                            ))}
                        </div>
                        {selection ? (
                            <p className="mt-3 line-clamp-3 rounded-xl bg-[#f4f0e8] p-3 text-xs">
                                {selection.quoteText}
                            </p>
                        ) : null}
                    </section>
                    {page?.highlights.length ? (
                        <section
                            className="rounded-3xl border border-[#d8d0c2] bg-[#fffdf8] p-5"
                            dir="rtl"
                        >
                            <h3 className="font-black">التظليلات في الصفحة</h3>
                            <div className="mt-3 space-y-2">
                                {page.highlights.map((highlight) => (
                                    <button
                                        key={highlight.id}
                                        type="button"
                                        onClick={() =>
                                            void removeHighlight(highlight.id)
                                        }
                                        className="flex w-full items-center gap-2 rounded-xl bg-[#f4f0e8] p-3 text-right text-xs"
                                    >
                                        <span
                                            className="size-3 rounded-full"
                                            style={{
                                                backgroundColor:
                                                    highlight.color,
                                            }}
                                        />
                                        <span className="min-w-0 flex-1 truncate">
                                            {highlight.quoteText ?? "نص مظلل"}
                                        </span>
                                        <Trash2 size={14} />
                                    </button>
                                ))}
                            </div>
                        </section>
                    ) : null}
                    {page?.footnotes.length ? (
                        <section
                            className="rounded-3xl border border-[#d8d0c2] bg-[#fffdf8] p-5"
                            dir="rtl"
                        >
                            <h3 className="font-black">الحواشي</h3>
                            <div className="mt-3 space-y-3 text-sm leading-6 text-[#62584c]">
                                {page.footnotes.map((footnote) => (
                                    <p key={footnote.id}>
                                        <b>{footnote.marker}</b>{" "}
                                        {footnote.content}
                                    </p>
                                ))}
                            </div>
                        </section>
                    ) : null}
                </aside>
            </div>
        </BookWebShell>
    );
}
