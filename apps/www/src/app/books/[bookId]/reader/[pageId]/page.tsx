"use client";

import { BookWebReader } from "@/components/books/book-web-reader";
import { useParams } from "next/navigation";

export default function BookReaderPage() {
    const params = useParams<{ bookId: string; pageId: string }>();
    return (
        <BookWebReader
            bookId={Number(params.bookId)}
            pageId={Number(params.pageId)}
        />
    );
}
