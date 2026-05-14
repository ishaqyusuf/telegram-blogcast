"use client";

import { cn } from "@acme/ui/cn";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type FetchPreview = {
    requestedUrl: string;
    finalUrl: string;
    ok: boolean;
    status: number;
    statusText: string;
    contentType: string | null;
    contentLength: string | null;
    html: string;
    snippet: string;
};

type StreamEvent =
    | {
          type: "log";
          level: "SYS" | "CMD" | "INF" | "OK" | "ERR";
          message: string;
          time: string;
      }
    | { type: "preview"; preview: FetchPreview }
    | { type: "done"; ok: boolean };

type LogLine = Extract<StreamEvent, { type: "log" }>;

function StatusDot({
    tone,
}: {
    tone: "idle" | "running" | "success" | "error";
}) {
    const classes = {
        idle: "bg-zinc-600",
        running: "bg-amber-400 shadow-amber-400/50 shadow-sm animate-pulse",
        success: "bg-emerald-400 shadow-emerald-400/50 shadow-sm",
        error: "bg-red-400 shadow-red-400/50 shadow-sm",
    };

    return (
        <span
            className={cn("inline-block h-2 w-2 rounded-full", classes[tone])}
        />
    );
}

function LogEntry({ line }: { line: LogLine }) {
    const colors: Record<LogLine["level"], string> = {
        SYS: "text-zinc-500",
        CMD: "text-amber-400",
        INF: "text-sky-400",
        OK: "text-emerald-400",
        ERR: "text-red-400",
    };

    return (
        <div className="flex gap-3 font-mono text-xs leading-5">
            <span className="shrink-0 select-none text-zinc-600">
                {new Date(line.time).toLocaleTimeString()}
            </span>
            <span className={cn("shrink-0 font-semibold", colors[line.level])}>
                {line.level}
            </span>
            <span className={cn("break-all", colors[line.level])}>
                {line.message}
            </span>
        </div>
    );
}

export default function BookDebuggerPage() {
    const [url, setUrl] = useState("");
    const [logs, setLogs] = useState<LogLine[]>([]);
    const [preview, setPreview] = useState<FetchPreview | null>(null);
    const [status, setStatus] = useState<"idle" | "running" | "success" | "error">(
        "idle",
    );

    const logEndRef = useRef<HTMLDivElement>(null);
    const abortRef = useRef<AbortController | null>(null);

    useEffect(() => {
        logEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [logs]);

    async function runDebug(e: React.FormEvent) {
        e.preventDefault();

        const nextUrl = url.trim();
        if (!nextUrl) return;

        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        setLogs([]);
        setPreview(null);
        setStatus("running");

        const response = await fetch("/api/books/debug", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: nextUrl }),
            signal: controller.signal,
        });

        if (!response.ok || !response.body) {
            const errorText = await response.text();
            setLogs([
                {
                    type: "log",
                    level: "ERR",
                    message: errorText || "Debugger request failed.",
                    time: new Date().toISOString(),
                },
            ]);
            setStatus("error");
            return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        try {
            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() ?? "";

                for (const line of lines) {
                    if (!line.trim()) continue;

                    const event = JSON.parse(line) as StreamEvent;

                    if (event.type === "log") {
                        setLogs((prev) => [...prev.slice(-599), event]);
                        continue;
                    }

                    if (event.type === "preview") {
                        setPreview(event.preview);
                        continue;
                    }

                    setStatus(event.ok ? "success" : "error");
                }
            }
        } catch (error) {
            if ((error as Error).name !== "AbortError") {
                setLogs((prev) => [
                    ...prev,
                    {
                        type: "log",
                        level: "ERR",
                        message:
                            error instanceof Error
                                ? error.message
                                : "Stream failed unexpectedly.",
                        time: new Date().toISOString(),
                    },
                ]);
                setStatus("error");
            }
        }
    }

    function stopDebug() {
        abortRef.current?.abort();
        abortRef.current = null;
        setStatus((current) => (current === "running" ? "idle" : current));
    }

    return (
        <>
            <style>{`
                ::-webkit-scrollbar{width:6px;height:6px}
                ::-webkit-scrollbar-track{background:#09090b}
                ::-webkit-scrollbar-thumb{background:#27272a;border-radius:3px}
            `}</style>

            <div className="flex h-screen flex-col overflow-hidden bg-zinc-950 text-zinc-200">
                <header className="shrink-0 border-b border-zinc-800 bg-zinc-900 px-4 py-3">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <span className="font-mono text-sm tracking-wider text-zinc-300">
                                book
                                <span className="text-emerald-400">-debugger</span>
                            </span>
                            <Link
                                href="/books/import"
                                className="font-mono text-[11px] text-zinc-500 transition-colors hover:text-amber-300"
                            >
                                /books/import
                            </Link>
                        </div>

                        <div className="flex items-center gap-2 font-mono text-xs text-zinc-500">
                            <StatusDot tone={status} />
                            <span>{status}</span>
                        </div>
                    </div>

                    <form
                        onSubmit={runDebug}
                        className="mt-3 flex items-center gap-3"
                    >
                        <input
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            placeholder="Paste a Shamela book URL..."
                            className="flex-1 rounded border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-700 focus:outline-none"
                            autoComplete="off"
                            spellCheck={false}
                        />
                        <button
                            type="submit"
                            disabled={status === "running"}
                            className="rounded border border-emerald-800 px-3 py-2 font-mono text-xs text-emerald-400 transition-colors hover:bg-emerald-950/40 disabled:opacity-40"
                        >
                            {status === "running" ? "running..." : "run"}
                        </button>
                        <button
                            type="button"
                            onClick={stopDebug}
                            className="rounded border border-zinc-700 px-3 py-2 font-mono text-xs text-zinc-300 transition-colors hover:bg-zinc-800"
                        >
                            stop
                        </button>
                    </form>
                </header>

                <main className="grid min-h-0 flex-1 grid-cols-1 gap-px bg-zinc-800 lg:grid-cols-2">
                    <section className="flex min-h-0 flex-col bg-zinc-950">
                        <div className="shrink-0 border-b border-zinc-800 px-4 py-2">
                            <span className="font-mono text-[11px] uppercase tracking-[0.28em] text-zinc-500">
                                Server Stream
                            </span>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4">
                            {logs.length === 0 ? (
                                <p className="font-mono text-xs text-zinc-700">
                                    Awaiting output...
                                </p>
                            ) : (
                                <div className="space-y-0.5">
                                    {logs.map((line, index) => (
                                        <LogEntry
                                            key={`${line.time}-${index}`}
                                            line={line}
                                        />
                                    ))}
                                    <div ref={logEndRef} />
                                </div>
                            )}
                        </div>
                    </section>

                    <section className="flex min-h-0 flex-col bg-zinc-950">
                        <div className="shrink-0 border-b border-zinc-800 px-4 py-2">
                            <span className="font-mono text-[11px] uppercase tracking-[0.28em] text-zinc-500">
                                Preview
                            </span>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4">
                            {!preview ? (
                                <p className="font-mono text-xs text-zinc-700">
                                    HTML preview will appear here.
                                </p>
                            ) : (
                                <div className="space-y-4">
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <div className="rounded border border-zinc-800 bg-zinc-900/70 p-3">
                                            <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-zinc-500">
                                                Requested URL
                                            </div>
                                            <div className="mt-2 break-all text-sm text-zinc-100">
                                                {preview.requestedUrl}
                                            </div>
                                        </div>
                                        <div className="rounded border border-zinc-800 bg-zinc-900/70 p-3">
                                            <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-zinc-500">
                                                Final URL
                                            </div>
                                            <div className="mt-2 break-all text-sm text-zinc-100">
                                                {preview.finalUrl}
                                            </div>
                                        </div>
                                        <div className="rounded border border-zinc-800 bg-zinc-900/70 p-3">
                                            <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-zinc-500">
                                                Response
                                            </div>
                                            <div className="mt-2 text-sm text-zinc-100">
                                                {preview.status} {preview.statusText}
                                            </div>
                                        </div>
                                        <div className="rounded border border-zinc-800 bg-zinc-900/70 p-3">
                                            <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-zinc-500">
                                                Content Type
                                            </div>
                                            <div className="mt-2 text-sm text-zinc-100">
                                                {preview.contentType ?? "unknown"}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="rounded border border-zinc-800 bg-zinc-900/70 p-3">
                                        <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-zinc-500">
                                            Snippet
                                        </div>
                                        <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-xs leading-6 text-zinc-300">
                                            {preview.snippet}
                                        </pre>
                                    </div>

                                    <pre className="overflow-x-auto rounded border border-zinc-800 bg-zinc-900/80 p-4 font-mono text-xs leading-6 text-zinc-300">
                                        {preview.html}
                                    </pre>
                                </div>
                            )}
                        </div>
                    </section>
                </main>
            </div>
        </>
    );
}
