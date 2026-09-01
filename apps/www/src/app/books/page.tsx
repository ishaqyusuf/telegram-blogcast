"use client";

import { BookWebShell } from "@/components/books/book-web-shell";
import { _trpc } from "@/components/static-trpc";
import { useQuery } from "@acme/ui/tanstack";
import { BookOpen, Download, LibraryBig } from "lucide-react";
import Link from "next/link";

export default function BooksPage() {
    const { data, isLoading } = useQuery(
        _trpc.book.getBooks.queryOptions({ limit: 100 }),
    );
    const books = data?.data ?? [];

    return (
        <BookWebShell
            title="الكتب"
            eyebrow="Al-Ghurobaa reader"
            actions={
                <Link
                    href="/books/import"
                    className="inline-flex items-center gap-2 rounded-full border border-[#173f35] px-4 py-2 text-sm font-bold text-[#173f35]"
                >
                    <Download size={16} /> استيراد
                </Link>
            }
        >
            <section className="mx-auto max-w-7xl px-5 py-8 lg:px-8">
                {isLoading ? (
                    <div className="rounded-3xl border border-[#d8d0c2] bg-white/70 p-12 text-center text-[#776d61]">
                        Loading library…
                    </div>
                ) : books.length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-[#b9ae9e] bg-white/60 p-12 text-center">
                        <LibraryBig
                            className="mx-auto mb-4 text-[#173f35]"
                            size={38}
                        />
                        <p className="font-bold">لا توجد كتب بعد</p>
                        <Link
                            href="/books/import"
                            className="mt-3 inline-block text-sm text-[#176b57] underline"
                        >
                            استيراد كتاب من الشاملة
                        </Link>
                    </div>
                ) : (
                    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                        {books.map((book) => {
                            const firstPage = book.pages[0];
                            return (
                                <article
                                    key={book.id}
                                    className="flex min-h-64 flex-col overflow-hidden rounded-3xl border border-[#d8d0c2] bg-[#fffdf8] shadow-[0_18px_50px_rgba(70,52,35,0.08)]"
                                >
                                    <div
                                        className="h-2"
                                        style={{
                                            backgroundColor:
                                                book.coverColor ?? "#173f35",
                                        }}
                                    />
                                    <div
                                        className="flex flex-1 flex-col p-6 text-right"
                                        dir="rtl"
                                    >
                                        <BookOpen
                                            className="mb-5 text-[#176b57]"
                                            size={26}
                                        />
                                        <h2 className="text-xl font-black leading-8">
                                            {book.nameAr ??
                                                book.nameEn ??
                                                `كتاب ${book.id}`}
                                        </h2>
                                        <p className="mt-2 text-sm text-[#776d61]">
                                            {book.authors
                                                .map(
                                                    (author) =>
                                                        author.nameAr ??
                                                        author.name,
                                                )
                                                .join("، ") || "مؤلف غير محدد"}
                                        </p>
                                        <p className="mt-1 text-xs text-[#968979]">
                                            {book.category ?? "المكتبة"} ·{" "}
                                            {book.sourceType === "shamela"
                                                ? "الشاملة"
                                                : "كتاب شخصي"}
                                        </p>
                                        <div className="mt-auto flex gap-2 pt-6">
                                            <Link
                                                href={`/books/${book.id}`}
                                                className="flex-1 rounded-xl border border-[#d8d0c2] px-4 py-2.5 text-center text-sm font-bold"
                                            >
                                                الفهرس
                                            </Link>
                                            {firstPage ? (
                                                <Link
                                                    href={`/books/${book.id}/reader/${firstPage.id}`}
                                                    className="flex-1 rounded-xl bg-[#173f35] px-4 py-2.5 text-center text-sm font-bold text-white"
                                                >
                                                    قراءة
                                                </Link>
                                            ) : null}
                                        </div>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                )}
            </section>
        </BookWebShell>
    );
}
