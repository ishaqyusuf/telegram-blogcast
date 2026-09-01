"use client";

import { BookWebShell } from "@/components/books/book-web-shell";
import { _trpc } from "@/components/static-trpc";
import { useMutation, useQuery } from "@acme/ui/tanstack";
import { ChevronLeft, Download, ExternalLink } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type TocNode = {
    id: number;
    parentId: number | null;
    pageId: number | null;
    title: string;
    depth: number;
    shamelaPath: string | null;
    page?: { id: number; status: string; shamelaUrl: string | null } | null;
};

function TocBranch({
    node,
    childrenByParent,
    onOpen,
}: {
    node: TocNode;
    childrenByParent: Map<number | null, TocNode[]>;
    onOpen: (node: TocNode) => void;
}) {
    const [expanded, setExpanded] = useState(node.depth < 2);
    const children = childrenByParent.get(node.id) ?? [];
    return (
        <div>
            <button
                type="button"
                onClick={() =>
                    children.length
                        ? setExpanded((value) => !value)
                        : onOpen(node)
                }
                className="flex min-h-12 w-full items-center gap-3 border-b border-[#e5ded2] px-4 py-3 text-right hover:bg-[#f4f0e8]"
                style={{ paddingRight: 16 + node.depth * 18 }}
                dir="rtl"
            >
                {children.length ? (
                    <ChevronLeft
                        className={expanded ? "-rotate-90" : ""}
                        size={15}
                    />
                ) : node.page?.status === "fetched" ? (
                    <span className="size-2 rounded-full bg-[#176b57]" />
                ) : (
                    <Download size={14} />
                )}
                <span className="flex-1 text-sm font-semibold">
                    {node.title}
                </span>
            </button>
            {expanded
                ? children.map((child) => (
                      <TocBranch
                          key={child.id}
                          node={child}
                          childrenByParent={childrenByParent}
                          onOpen={onOpen}
                      />
                  ))
                : null}
        </div>
    );
}

export default function BookDetailPage() {
    const params = useParams<{ bookId: string }>();
    const router = useRouter();
    const bookId = Number(params.bookId);
    const { data: book, isLoading } = useQuery(
        _trpc.book.getBook.queryOptions({ id: bookId }),
    );
    const fetchPage = useMutation(
        _trpc.book.captureShamelaPageFromUrl.mutationOptions(),
    );
    const tocNodes = (book?.tocNodes ?? []) as TocNode[];
    const childrenByParent = useMemo(() => {
        const map = new Map<number | null, TocNode[]>();
        for (const node of tocNodes) {
            const key = node.parentId ?? null;
            map.set(key, [...(map.get(key) ?? []), node]);
        }
        return map;
    }, [tocNodes]);

    const openNode = async (node: TocNode) => {
        if (node.page?.status === "fetched") {
            router.push(`/books/${bookId}/reader/${node.page.id}`);
            return;
        }
        const shamelaUrl = node.page?.shamelaUrl ?? node.shamelaPath;
        if (!shamelaUrl) return;
        const result = await fetchPage.mutateAsync({ bookId, shamelaUrl });
        router.push(`/books/${bookId}/reader/${result.importedPage.id}`);
    };

    return (
        <BookWebShell
            title={book?.nameAr ?? book?.nameEn ?? "كتاب"}
            eyebrow={book?.authors
                .map((author) => author.nameAr ?? author.name)
                .join("، ")}
            actions={
                book?.shamelaUrl ? (
                    <a
                        href={`https://shamela.ws${book.shamelaUrl}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-full border border-[#d8d0c2] px-4 py-2 text-sm font-bold"
                    >
                        المصدر <ExternalLink size={15} />
                    </a>
                ) : null
            }
        >
            <section className="mx-auto grid max-w-7xl gap-6 px-5 py-8 lg:grid-cols-[320px_1fr] lg:px-8">
                <aside
                    className="rounded-3xl border border-[#d8d0c2] bg-[#173f35] p-6 text-right text-white"
                    dir="rtl"
                >
                    <p className="text-xs font-bold tracking-widest text-white/60">
                        BOOK PROFILE
                    </p>
                    <h2 className="mt-4 text-2xl font-black leading-9">
                        {book?.nameAr ?? book?.nameEn}
                    </h2>
                    <p className="mt-4 text-sm leading-7 text-white/70">
                        {book?.blog.content}
                    </p>
                    <dl className="mt-8 grid grid-cols-2 gap-3 text-sm">
                        <div className="rounded-2xl bg-white/10 p-3">
                            <dt className="text-white/55">الصفحات</dt>
                            <dd className="mt-1 text-xl font-black">
                                {book?.pages.length ?? 0}
                            </dd>
                        </div>
                        <div className="rounded-2xl bg-white/10 p-3">
                            <dt className="text-white/55">الفهرس</dt>
                            <dd className="mt-1 text-xl font-black">
                                {tocNodes.length}
                            </dd>
                        </div>
                    </dl>
                </aside>
                <div className="overflow-hidden rounded-3xl border border-[#d8d0c2] bg-[#fffdf8]">
                    <div
                        className="border-b border-[#d8d0c2] p-5 text-right"
                        dir="rtl"
                    >
                        <h2 className="text-lg font-black">فصول الكتاب</h2>
                        <p className="mt-1 text-sm text-[#776d61]">
                            افتح أي فصل؛ الصفحات غير المحمّلة تُستورد عند الطلب.
                        </p>
                    </div>
                    {isLoading ? (
                        <p className="p-8 text-center">Loading…</p>
                    ) : (
                        (childrenByParent.get(null) ?? []).map((node) => (
                            <TocBranch
                                key={node.id}
                                node={node}
                                childrenByParent={childrenByParent}
                                onOpen={openNode}
                            />
                        ))
                    )}
                </div>
            </section>
        </BookWebShell>
    );
}
