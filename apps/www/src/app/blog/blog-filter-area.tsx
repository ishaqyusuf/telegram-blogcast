"use client";

import { Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useBlogFilterParams } from "@/hooks/use-blog-filter-params";

const typeOptions = [
    { value: "all", label: "All" },
    { value: "text", label: "Text" },
    { value: "image", label: "Image" },
    { value: "audio", label: "Audio" },
] as const;

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
        <div className="mt-3 space-y-3">
            <div className="relative">
                <Search
                    size={17}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <input
                    value={queryInput}
                    onChange={(e) => setQueryInput(e.target.value)}
                    placeholder="Search content, channel, or media title"
                    className="h-11 w-full rounded-full border border-border bg-muted/45 px-10 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:bg-background focus:outline-none"
                />
                {hasFilters && (
                    <Link
                        href="/blog"
                        aria-label="Reset filters"
                        className="absolute right-1.5 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                        <X size={16} />
                    </Link>
                )}
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {typeOptions.map((option) => {
                    const active = filters.type === option.value;

                    return (
                        <button
                            key={option.value}
                            type="button"
                            onClick={() =>
                                void setFilters(
                                    {
                                        type:
                                            option.value === "all"
                                                ? null
                                                : option.value,
                                    },
                                    { shallow: false, scroll: false },
                                )
                            }
                            className={[
                                "h-9 shrink-0 rounded-full border px-3 text-sm font-medium transition-colors",
                                active
                                    ? "border-primary bg-primary text-primary-foreground"
                                    : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
                            ].join(" ")}
                        >
                            {option.label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
