"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useBlogFilterParams } from "@/hooks/use-blog-filter-params";

export function BlogFilterArea() {
    const { filters, hasFilters, setFilters } = useBlogFilterParams();
    const [queryInput, setQueryInput] = useState(filters.q);

    useEffect(() => {
        setQueryInput(filters.q);
    }, [filters.q]);

    useEffect(() => {
        const timer = setTimeout(() => {
            const nextValue = queryInput.trim();
            const currentValue = filters.q.trim();
            if (nextValue === currentValue) return;
            void setFilters(
                { q: nextValue || null },
                { shallow: false, scroll: false },
            );
        }, 250);
        return () => clearTimeout(timer);
    }, [queryInput, filters.q, setFilters]);

    return (
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_160px_auto]">
            <input
                value={queryInput}
                onChange={(e) => setQueryInput(e.target.value)}
                placeholder="Search content, channel, or media title"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900/70 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-emerald-700"
            />
            <select
                value={filters.type}
                onChange={(e) =>
                    void setFilters(
                        { type: e.target.value === "all" ? null : e.target.value },
                        { shallow: false, scroll: false },
                    )
                }
                className="rounded-lg border border-zinc-700 bg-zinc-900/70 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-emerald-700"
            >
                <option value="all">All types</option>
                <option value="text">Text</option>
                <option value="image">Image</option>
                <option value="audio">Audio</option>
            </select>
            <div className="flex gap-2">
                {hasFilters && (
                    <Link
                        href="/blog"
                        className="rounded-lg border border-zinc-700 bg-zinc-900/70 px-3 py-2 text-sm text-zinc-300 transition-colors hover:border-zinc-600 hover:text-white"
                    >
                        Reset
                    </Link>
                )}
            </div>
        </div>
    );
}
