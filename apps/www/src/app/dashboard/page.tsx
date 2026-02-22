"use client";

// apps/www/app/dashboard/page.tsx

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "@acme/ui/tanstack";
import { _trpc, _qc } from "@/components/static-trpc";
import { useMessageFetcher } from "@/hooks/use-message-fetcher";
import type { FetchedMessage, FetcherState } from "@/hooks/use-message-fetcher";
import {
    invalidateQueries,
    invalidateInfiniteQueries,
    invalidateQuery,
} from "@/lib/invalidate-query";
import { arabic } from "@/fonts";
import { RouterOutputs } from "@api/trpc/routers/_app";

// ── Types ─────────────────────────────────────────────────────────────────────

type Channel = RouterOutputs["channel"]["getChannels"][number];

interface LogLine {
    kind: "system" | "info" | "success" | "error" | "msg" | "cmd";
    text: string;
    time: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function cn(...classes: (string | false | undefined)[]) {
    return classes.filter(Boolean).join(" ");
}

function ts() {
    return new Date().toTimeString().slice(0, 8);
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusDot({ status }: { status: FetcherState["status"] | "idle" }) {
    const colors: Record<string, string> = {
        running: "bg-emerald-400 shadow-emerald-400/50 shadow-sm animate-pulse",
        retrying: "bg-amber-400 shadow-amber-400/50 shadow-sm animate-pulse",
        stopped: "bg-zinc-500",
        idle: "bg-zinc-600",
    };
    return (
        <span
            className={cn(
                "inline-block w-2 h-2 rounded-full",
                colors[status] ?? colors.idle,
            )}
        />
    );
}

function LogEntry({ line }: { line: LogLine }) {
    const colors: Record<LogLine["kind"], string> = {
        system: "text-zinc-500",
        info: "text-sky-400",
        success: "text-emerald-400",
        error: "text-red-400",
        msg: "text-zinc-200",
        cmd: "text-amber-400",
    };
    const prefixes: Record<LogLine["kind"], string> = {
        system: "SYS",
        info: "INF",
        success: "OK ",
        error: "ERR",
        msg: "MSG",
        cmd: "CMD",
    };
    return (
        <div className="flex gap-3 font-mono text-xs leading-5">
            <span className="text-zinc-600 shrink-0 select-none">
                {line.time}
            </span>
            <span
                className={cn(
                    "shrink-0 select-none font-semibold",
                    colors[line.kind],
                )}
            >
                {prefixes[line.kind]}
            </span>
            <span className={cn("break-all", colors[line.kind])}>
                {line.text}
            </span>
        </div>
    );
}

function ChannelRow({
    channel,
    active,
    onSelect,
    onToggleFetchable,
    isTogglingId,
}: {
    channel: Channel;
    active: boolean;
    onSelect: () => void;
    onToggleFetchable: (id: number, value: boolean) => void;
    isTogglingId: number | null;
}) {
    const isFetchable = channel.isFetchable ?? false;

    return (
        <div
            className={cn(
                "group w-full px-3 py-2 rounded border transition-all duration-150 space-y-1",
                active
                    ? "bg-emerald-950/50 border-emerald-700"
                    : "bg-transparent border-transparent hover:border-zinc-700",
            )}
        >
            {/* Title row */}
            <button onClick={onSelect} className="w-full text-left">
                <div
                    dir={channel.rtl ? "rtl" : "ltr"}
                    lang={channel.rtl ? "ar" : undefined}
                    className={cn(
                        channel.rtl
                            ? `${arabic.className} text-sm leading-relaxed`
                            : "font-mono text-xs",
                        "font-semibold truncate",
                        active ? "text-emerald-300" : "text-zinc-300",
                    )}
                >
                    {channel.title ?? channel.username}
                </div>
                <div className="font-mono text-[10px] text-zinc-600 truncate">
                    @{channel.username}
                </div>
            </button>

            {/* isFetchable toggle */}
            <div className="flex items-center justify-between pt-0.5">
                <span className="font-mono text-[10px] text-zinc-600">
                    fetchable
                </span>
                <button
                    onClick={() => onToggleFetchable(channel.id, !isFetchable)}
                    disabled={isTogglingId === channel.id}
                    className={cn(
                        "relative w-8 h-4 rounded-full transition-colors duration-200",
                        isFetchable ? "bg-emerald-700" : "bg-zinc-700",
                        "disabled:opacity-50",
                    )}
                >
                    <span
                        className={cn(
                            "absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform duration-200",
                            isFetchable ? "translate-x-4" : "translate-x-0",
                        )}
                    />
                </button>
            </div>
        </div>
    );
}

function MessageCard({ msg }: { msg: FetchedMessage }) {
    return (
        <div className="shrink-0 w-48 border border-zinc-700 rounded bg-zinc-900 p-2 space-y-1">
            <div className="flex items-center justify-between">
                <span className="font-mono text-[9px] text-zinc-600">
                    #{msg.id}
                </span>
                {msg.fileId && (
                    <span className="font-mono text-[9px] text-sky-500">
                        📎 media
                    </span>
                )}
            </div>
            <p className="font-mono text-[10px] text-zinc-300 line-clamp-3 leading-4">
                {msg.text ?? (
                    <span className="text-zinc-600 italic">media only</span>
                )}
            </p>
            <p className="font-mono text-[9px] text-zinc-700">
                {new Date(msg.date).toLocaleTimeString()}
            </p>
        </div>
    );
}

// ── Main dashboard ────────────────────────────────────────────────────────────

export default function DashboardPage() {
    const router = useRouter();
    const { messages, state, connecting, start, stop, clearMessages } =
        useMessageFetcher();

    const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
    const [log, setLog] = useState<LogLine[]>([]);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [cmdInput, setCmdInput] = useState("");
    const [cmdHistory, setCmdHistory] = useState<string[]>([]);
    const [historyIdx, setHistoryIdx] = useState(-1);
    const [isTogglingId, setIsTogglingId] = useState<number | null>(null);
    // Track last persisted message count to know when a new batch landed
    const lastPersistedCount = useRef(0);

    const logEndRef = useRef<HTMLDivElement>(null);

    // ── tRPC queries ────────────────────────────────────────────────────────────

    const { data: channels = [], isFetching: isLoadingChannels } = useQuery(
        _trpc.channel.getChannels.queryOptions(),
    );

    const { mutate: syncChannels, isPending: isSyncing } = useMutation(
        _trpc.channel.syncChannels.mutationOptions({
            onSuccess(data) {
                addLog(
                    "success",
                    `synced ${data.length} channels from Telegram`,
                );
                invalidateQueries("channel.getChannels");
            },
            onError(err) {
                addLog("error", `sync failed: ${err.message}`);
            },
        }),
    );

    const { mutate: toggleFetchable } = useMutation(
        _trpc.channel.toggleFetchable.mutationOptions({
            onMutate(vars) {
                setIsTogglingId(vars.channelId);
            },
            onSuccess(_, vars) {
                addLog(
                    "info",
                    `channel ${vars.channelId} fetchable → ${vars.isFetchable}`,
                );
                invalidateQueries("channel.getChannels");
            },
            onSettled() {
                setIsTogglingId(null);
            },
        }),
    );

    // Called after each completed batch to persist messages as Blog records
    const { mutate: createBlogs } = useMutation(
        _trpc.channel.createBlogsFromMessages.mutationOptions({
            onSuccess(data) {
                addLog(
                    "success",
                    `batch persisted → ${data.created} blog(s) created`,
                );
            },
            onError(err) {
                addLog("error", `blog creation failed: ${err.message}`);
            },
        }),
    );

    // ── Helpers ─────────────────────────────────────────────────────────────────

    const addLog = useCallback((kind: LogLine["kind"], text: string) => {
        setLog((prev) => [...prev.slice(-500), { kind, text, time: ts() }]);
    }, []);

    // Auto-scroll log
    useEffect(() => {
        logEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [log]);

    // Boot log
    useEffect(() => {
        addLog("system", "tg-blogcast dashboard initialized");
        addLog("system", "channels loaded from Prisma");
    }, [addLog]);

    // SSE connection
    useEffect(() => {
        if (!connecting && state) {
            addLog("success", `stream connected · fetcher=${state.status}`);
        }
    }, [connecting]); // eslint-disable-line

    // Fetcher errors
    useEffect(() => {
        if (state?.error) {
            addLog("error", `${state.error} (retry #${state.retryCount})`);
        }
    }, [state?.error, state?.retryCount]); // eslint-disable-line

    // ── Batch persistence: fires when messages array grows ────────────────────
    // The fetcher emits a batch of new messages each poll tick.
    // We detect the boundary by comparing the previous count and persist the
    // newly arrived slice as Blog records immediately after each batch lands.
    useEffect(() => {
        if (!activeChannel || messages.length === 0) return;
        if (messages.length === lastPersistedCount.current) return;

        const newBatch = messages.slice(lastPersistedCount.current);
        lastPersistedCount.current = messages.length;

        addLog(
            "cmd",
            `batch complete — persisting ${newBatch.length} message(s)`,
        );

        createBlogs({
            channelId: activeChannel.id,
            messages: newBatch.map((m) => ({
                id: m.id,
                text: m.text,
                fileId: m.fileId,
                date: m.date,
            })),
        });
    }, [messages.length]); // eslint-disable-line

    // New message log line
    useEffect(() => {
        if (messages.length === 0) return;
        const latest = messages[messages.length - 1];
        addLog(
            "msg",
            `[${latest.id}] ${latest.text?.slice(0, 100) ?? "(media)"} ${latest.fileId ? `· file=${latest.fileId.slice(0, 18)}…` : ""}`,
        );
    }, [messages.length]); // eslint-disable-line

    // ── Channel actions ─────────────────────────────────────────────────────────

    async function selectChannel(ch: Channel) {
        setActiveChannel(ch);
        clearMessages();
        lastPersistedCount.current = 0;
        addLog(
            "cmd",
            `selected channel: ${ch.title ?? ch.username} (id=${ch.id})`,
        );

        if (!ch.isFetchable) {
            addLog(
                "info",
                "channel is not marked fetchable — toggle to enable auto-fetch",
            );
        }
    }

    async function startFetcher() {
        // Only start for channels with isFetchable=true
        const fetchableChannels = channels.filter((c) => c.isFetchable);
        if (fetchableChannels.length === 0) {
            addLog(
                "error",
                "no channels marked as fetchable — enable at least one",
            );
            return;
        }

        const target = activeChannel ?? fetchableChannels[0];

        setActiveChannel(target);
        clearMessages();
        lastPersistedCount.current = 0;

        addLog("cmd", `start fetcher · channel=${target.username}`);
        await start(target.username);
        addLog(
            "success",
            `fetcher running for ${target.title ?? target.username}`,
        );
    }

    // ── CMD handler ─────────────────────────────────────────────────────────────

    async function handleCmd(e: React.FormEvent) {
        e.preventDefault();
        const raw = cmdInput.trim();
        if (!raw) return;

        setCmdHistory((prev) => [raw, ...prev].slice(0, 50));
        setHistoryIdx(-1);
        setCmdInput("");
        addLog("cmd", raw);

        const [cmd, ...args] = raw.split(" ");

        switch (cmd) {
            case "start":
                await startFetcher();
                break;
            case "stop":
                await stop();
                addLog("info", "fetcher stopped");
                break;
            case "clear":
                setLog([]);
                clearMessages();
                lastPersistedCount.current = 0;
                break;
            case "sync":
                addLog("cmd", "syncing channels from Telegram…");
                syncChannels();
                break;
            case "status":
                addLog("info", JSON.stringify(state));
                break;
            case "logout":
                await stop();
                await fetch("/api/auth/logout", { method: "POST" });
                router.push("/login");
                break;
            case "help":
                [
                    "start           – start fetcher for fetchable channel(s)",
                    "stop            – stop the fetcher",
                    "clear           – clear log + message buffer",
                    "sync            – pull missing channels from Telegram into DB",
                    "status          – print fetcher state JSON",
                    "logout          – end session",
                ].forEach((l) => addLog("info", l));
                break;
            default:
                addLog("error", `unknown: ${cmd}. type 'help'.`);
        }
    }

    function handleCmdKeyDown(e: React.KeyboardEvent) {
        if (e.key === "ArrowUp") {
            const idx = Math.min(historyIdx + 1, cmdHistory.length - 1);
            setHistoryIdx(idx);
            setCmdInput(cmdHistory[idx] ?? "");
        }
        if (e.key === "ArrowDown") {
            const idx = Math.max(historyIdx - 1, -1);
            setHistoryIdx(idx);
            setCmdInput(idx === -1 ? "" : cmdHistory[idx]);
        }
    }

    // ── Logout ──────────────────────────────────────────────────────────────────

    async function handleLogout() {
        await stop();
        await fetch("/api/auth/logout", { method: "POST" });
        router.push("/login");
    }

    // ── Render ─────────────────────────────────────────────────────────────────

    return (
        <>
            <style>{`
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
        ::-webkit-scrollbar{width:6px;height:6px}
        ::-webkit-scrollbar-track{background:#09090b}
        ::-webkit-scrollbar-thumb{background:#27272a;border-radius:3px}
        ::-webkit-scrollbar-thumb:hover{background:#3f3f46}
      `}</style>

            <div className="h-screen bg-zinc-950 flex flex-col overflow-hidden text-zinc-200">
                {/* ── Top bar ── */}
                <header className="flex items-center justify-between px-4 py-2 bg-zinc-900 border-b border-zinc-800 shrink-0">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setSidebarOpen((v) => !v)}
                            className="font-mono text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                        >
                            {sidebarOpen ? "◀" : "▶"}
                        </button>
                        <span className="font-mono text-sm text-zinc-300 tracking-wider">
                            tg
                            <span className="text-emerald-400">-blogcast</span>
                        </span>
                        {activeChannel && (
                            <>
                                <span className="text-zinc-700">/</span>
                                <span className="font-mono text-xs text-emerald-400 truncate max-w-[180px]">
                                    {activeChannel.title ??
                                        activeChannel.username}
                                </span>
                            </>
                        )}
                    </div>

                    <div className="flex items-center gap-4">
                        {/* Fetcher status */}
                        <div className="flex items-center gap-2 font-mono text-xs text-zinc-500">
                            <StatusDot status={state?.status ?? "idle"} />
                            <span>{state?.status ?? "idle"}</span>
                            {state && state.totalFetched > 0 && (
                                <span className="text-zinc-600">
                                    · {state.totalFetched} msgs
                                </span>
                            )}
                        </div>

                        {/* SSE badge */}
                        <div className="flex items-center gap-1.5 font-mono text-[10px] text-zinc-600">
                            <span
                                className={cn(
                                    "w-1.5 h-1.5 rounded-full",
                                    connecting
                                        ? "bg-amber-500 animate-pulse"
                                        : "bg-emerald-500",
                                )}
                            />
                            SSE
                        </div>

                        {/* Start / Stop */}
                        {state?.status === "running" ||
                        state?.status === "retrying" ? (
                            <button
                                onClick={() => {
                                    stop();
                                    addLog("cmd", "stop");
                                }}
                                className="font-mono text-xs px-2 py-1 rounded border border-red-800 text-red-400 hover:bg-red-950/40 transition-colors"
                            >
                                ■ stop
                            </button>
                        ) : (
                            <button
                                onClick={startFetcher}
                                className="font-mono text-xs px-2 py-1 rounded border border-emerald-800 text-emerald-400 hover:bg-emerald-950/40 transition-colors"
                            >
                                ▶ start
                            </button>
                        )}

                        <button
                            onClick={handleLogout}
                            className="font-mono text-xs text-zinc-500 hover:text-red-400 transition-colors"
                        >
                            logout
                        </button>
                    </div>
                </header>

                <div className="flex flex-1 overflow-hidden">
                    {/* ── Sidebar ── */}
                    {sidebarOpen && (
                        <aside className="w-60 shrink-0 border-r border-zinc-800 bg-zinc-950 flex flex-col overflow-hidden">
                            <div className="px-3 py-2 border-b border-zinc-800 flex items-center justify-between">
                                <span className="font-mono text-[10px] text-zinc-500 tracking-widest uppercase">
                                    Channels
                                    {isLoadingChannels && (
                                        <span className="ml-1 text-zinc-600">
                                            …
                                        </span>
                                    )}
                                </span>
                                <button
                                    onClick={() => syncChannels()}
                                    disabled={isSyncing}
                                    className="font-mono text-[10px] text-zinc-600 hover:text-emerald-400 transition-colors disabled:opacity-40"
                                    title="Sync from Telegram"
                                >
                                    {isSyncing ? "syncing…" : "⟳ sync"}
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                                {channels.length === 0 &&
                                    !isLoadingChannels && (
                                        <p className="font-mono text-[10px] text-zinc-600 px-2 py-4 text-center">
                                            No channels — press ⟳ sync
                                        </p>
                                    )}
                                {channels.map((ch) => (
                                    <ChannelRow
                                        key={ch.id}
                                        channel={ch as Channel}
                                        active={activeChannel?.id === ch.id}
                                        onSelect={() =>
                                            selectChannel(ch as Channel)
                                        }
                                        onToggleFetchable={(id, val) =>
                                            toggleFetchable({
                                                channelId: id,
                                                isFetchable: val,
                                            })
                                        }
                                        isTogglingId={isTogglingId}
                                    />
                                ))}
                            </div>

                            <div className="px-3 py-2 border-t border-zinc-800">
                                <p className="font-mono text-[10px] text-zinc-600">
                                    {channels.length} channels ·{" "}
                                    {
                                        channels.filter((c) => c.isFetchable)
                                            .length
                                    }{" "}
                                    fetchable
                                </p>
                            </div>
                        </aside>
                    )}

                    {/* ── Terminal main ── */}
                    <main className="flex-1 flex flex-col overflow-hidden">
                        {/* Log */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-0.5 bg-zinc-950">
                            {log.length === 0 && (
                                <p className="font-mono text-xs text-zinc-700">
                                    Awaiting output… type{" "}
                                    <span className="text-amber-500">help</span>{" "}
                                    for commands.
                                </p>
                            )}
                            {log.map((line, i) => (
                                <LogEntry key={i} line={line} />
                            ))}
                            <div ref={logEndRef} />
                        </div>

                        {/* Latest message cards */}
                        {messages.length > 0 && (
                            <div className="shrink-0 border-t border-zinc-800 bg-zinc-900/50 p-3">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="font-mono text-[10px] text-zinc-500 tracking-widest uppercase">
                                        Latest
                                    </span>
                                    <span className="font-mono text-[10px] text-zinc-700">
                                        ({messages.length} buffered)
                                    </span>
                                </div>
                                <div className="flex gap-2 overflow-x-auto pb-1">
                                    {[...messages]
                                        .reverse()
                                        .slice(0, 8)
                                        .map((msg) => (
                                            <MessageCard
                                                key={msg.id}
                                                msg={msg}
                                            />
                                        ))}
                                </div>
                            </div>
                        )}

                        {/* CMD input */}
                        <div className="shrink-0 border-t border-zinc-800 bg-zinc-900 px-4 py-3">
                            <form
                                onSubmit={handleCmd}
                                className="flex items-center gap-2"
                            >
                                <span className="font-mono text-sm text-emerald-400 select-none shrink-0">
                                    ❯
                                </span>
                                <input
                                    value={cmdInput}
                                    onChange={(e) =>
                                        setCmdInput(e.target.value)
                                    }
                                    onKeyDown={handleCmdKeyDown}
                                    placeholder="type a command… (help)"
                                    className="flex-1 bg-transparent font-mono text-sm text-zinc-200 placeholder:text-zinc-700 focus:outline-none caret-emerald-400"
                                    autoComplete="off"
                                    spellCheck={false}
                                />
                            </form>
                        </div>
                    </main>
                </div>
            </div>
        </>
    );
}

