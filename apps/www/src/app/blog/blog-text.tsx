"use client";

import { useMemo, useState } from "react";
import { MAX_LINE, isArabicLine, splitTextLinesWithLinks } from "@acme/blog";

function truncateUrlLabel(value: string) {
    const trimmed = value.trim();
    if (trimmed.length <= 34) return trimmed;

    return `${trimmed.slice(0, 22)}...${trimmed.slice(-8)}`;
}

export function BlogText({
    content,
    inline = false,
    size = "default",
}: {
    content: string;
    inline?: boolean;
    size?: "default" | "large";
}) {
    const [expanded, setExpanded] = useState(false);
    const displayContent = useMemo(
        () =>
            inline
                ? content
                      .replace(/[\r\n]+/g, " ")
                      .replace(/[ \t\f\v]+/g, " ")
                      .trim()
                : content,
        [content, inline],
    );
    const lines = useMemo(
        () => splitTextLinesWithLinks(displayContent),
        [displayContent],
    );
    const shouldTruncate =
        displayContent.length > 280 || lines.length > MAX_LINE;
    const maxLines = inline && size !== "large" ? 3 : MAX_LINE;
    const truncatedStyle = !expanded && shouldTruncate
        ? {
              WebkitBoxOrient: "vertical" as const,
              WebkitLineClamp: maxLines,
              display: "-webkit-box",
              maxHeight: `${maxLines * (size === "large" ? 2 : 1.5)}rem`,
          }
        : undefined;

    return (
        <div>
            <div
                className={[
                    "space-y-1 text-foreground",
                    size === "large"
                        ? "text-lg leading-8"
                        : "text-[15px] leading-6",
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
                                            onClick={(event) => {
                                                event.stopPropagation();
                                            }}
                                            className="font-semibold text-primary underline underline-offset-2 hover:opacity-80"
                                        >
                                            {truncateUrlLabel(segment.text)}
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
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-background to-transparent" />
                )}
            </div>

            {shouldTruncate && (
                <button
                    type="button"
                    onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setExpanded((v) => !v);
                    }}
                    className="mt-1 text-xs font-medium text-primary transition-opacity hover:opacity-80"
                >
                    {expanded ? "Show less" : "Read more"}
                </button>
            )}
        </div>
    );
}
