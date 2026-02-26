"use client";

import { useMemo, useState } from "react";

function isArabicLine(text: string) {
    return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(text);
}

export function BlogText({ content }: { content: string }) {
    const [expanded, setExpanded] = useState(false);
    const lines = useMemo(() => content.split("\n"), [content]);
    const shouldTruncate = content.length > 280 || lines.length > 6;

    return (
        <div>
            <div
                className={[
                    "space-y-1 text-[15px] leading-7 text-zinc-200",
                    !expanded && shouldTruncate
                        ? "relative max-h-[12.5rem] overflow-hidden"
                        : "",
                ].join(" ")}
            >
                {lines.map((line, idx) => {
                    const rtl = isArabicLine(line);
                    if (!line.trim()) {
                        return <div key={`line-${idx}`} className="h-3" />;
                    }
                    return (
                        <p
                            key={`line-${idx}`}
                            dir={rtl ? "rtl" : "ltr"}
                            className={rtl ? "text-right" : "text-left"}
                        >
                            {line}
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

