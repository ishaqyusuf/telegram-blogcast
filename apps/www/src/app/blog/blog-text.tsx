"use client";

import { useMemo, useState } from "react";
import { MAX_LINE, isArabicLine, splitTextLinesWithLinks } from "@acme/blog";

export function BlogText({ content }: { content: string }) {
    const [expanded, setExpanded] = useState(false);
    const lines = useMemo(() => splitTextLinesWithLinks(content), [content]);
    const shouldTruncate = content.length > 280 || lines.length > MAX_LINE;
    const truncatedStyle = !expanded && shouldTruncate
        ? { maxHeight: `${MAX_LINE * 2.1}rem` }
        : undefined;

    return (
        <div>
            <div
                className={[
                    "space-y-1 text-[15px] leading-7 text-zinc-200",
                    !expanded && shouldTruncate
                        ? "relative overflow-hidden"
                        : "",
                ].join(" ")}
                style={truncatedStyle}
            >
                {lines.map((lineSegments, idx) => {
                    const rawLine = lineSegments.map((part) => part.text).join("");
                    const rtl = isArabicLine(rawLine);
                    if (!rawLine.trim()) {
                        return <div key={`line-${idx}`} className="h-3" />;
                    }
                    return (
                        <p
                            key={`line-${idx}`}
                            dir={rtl ? "rtl" : "ltr"}
                            className={rtl ? "text-right" : "text-left"}
                        >
                            {lineSegments.map((segment, segmentIdx) => {
                                if (segment.type === "link" && segment.href) {
                                    return (
                                        <a
                                            key={`seg-${idx}-${segmentIdx}`}
                                            href={segment.href}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="underline text-emerald-300 hover:text-emerald-200"
                                        >
                                            {segment.text}
                                        </a>
                                    );
                                }

                                return (
                                    <span key={`seg-${idx}-${segmentIdx}`}>
                                        {segment.text}
                                    </span>
                                );
                            })}
                        </p>
                    );
                })}
                {!expanded && shouldTruncate && (
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-[#0f1012] to-transparent" />
                )}
            </div>

            {shouldTruncate && (
                <button
                    type="button"
                    onClick={() => setExpanded((v) => !v)}
                    className="mt-1 text-xs font-medium text-emerald-300 transition-colors hover:text-emerald-200"
                >
                    {expanded ? "Show less" : "Read more"}
                </button>
            )}
        </div>
    );
}
