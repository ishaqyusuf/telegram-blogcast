"use client";

// apps/www/app/dashboard/page.tsx
// 🧩 Updated: fetcher fully moved to tRPC API — no SSE hook, no local fetcher

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "@acme/ui/tanstack";
import { _trpc } from "@/components/static-trpc";
import { invalidateQueries } from "@/lib/invalidate-query";
import type { RouterOutputs } from "@api/trpc/routers/_app";

// ── Types ─────────────────────────────────────────────────────────────────────

type Channel = RouterOutputs["channel"]["getChannels"][number];
type FetcherState = RouterOutputs["channel"]["getFetcherState"];

interface LogLine {
    kind: "system" | "info" | "success" | "error" | "cmd";
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

function StatusDot({ status }: { status: FetcherState["status"] }) {
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
        cmd: "text-amber-400",
    };
    const prefixes: Record<LogLine["kind"], string> = {
        system: "SYS",
        info: "INF",
        success: "OK ",
        error: "ERR",
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
    onToggleFetchable: (id: number, val: boolean) => void;
    isTogglingId: number | null;
}) {
    const isFetchable = channel.isFetchable ?? false;

    return (
        <div
            className={cn(
                "w-full px-3 py-2 rounded border transition-all duration-150 space-y-1",
                active
                    ? "bg-emerald-950/50 border-emerald-700"
                    : "border-transparent hover:border-zinc-700",
            )}
        >
            <button onClick={onSelect} className="w-full text-left">
                <div
                    dir={channel.rtl ? "rtl" : "ltr"}
                    lang={channel.rtl ? "ar" : undefined}
                    className={cn(
                        channel.rtl
                            ? "text-sm leading-relaxed"
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

// ── Main ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
    const router = useRouter();

    const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
    const [log, setLog] = useState<LogLine[]>([]);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [cmdInput, setCmdInput] = useState("");
    const [cmdHistory, setCmdHistory] = useState<string[]>([]);
    const [historyIdx, setHistoryIdx] = useState(-1);
    const [isTogglingId, setIsTogglingId] = useState<number | null>(null);
    const logEndRef = useRef<HTMLDivElement>(null);

    // ── tRPC queries ────────────────────────────────────────────────────────────

    const { data: channels = [], isFetching: isLoadingChannels } = useQuery(
        _trpc.channel.getChannels.queryOptions(),
    );

    // Poll fetcher state from API every 2s while running
    const { data: fetcherState } = useQuery(
        _trpc.channel.getFetcherState.queryOptions(undefined, {
            refetchInterval: (q) => {
                const status = q.state.data?.status;
                return status === "running" || status === "retrying"
                    ? 2000
                    : false;
            },
        }),
    );

    // ── Mutations ───────────────────────────────────────────────────────────────

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
            onSuccess(_, v) {
                addLog(
                    "info",
                    `channel ${v.channelId} fetchable → ${v.isFetchable}`,
                );
                invalidateQueries("channel.getChannels");
            },
            onSettled() {
                setIsTogglingId(null);
            },
        }),
    );

    const { mutate: startFetch, isPending: isStarting } = useMutation(
        _trpc.channel.startFetch.mutationOptions({
            onSuccess(data) {
                addLog(
                    "success",
                    `fetcher started · channelId=${data.channelId} · cursor=${data.lastMessageId ?? "fresh"}`,
                );
                invalidateQueries("channel.getFetcherState");
            },
            onError(err) {
                addLog("error", `start failed: ${err.message}`);
            },
        }),
    );

    const { mutate: stopFetch } = useMutation(
        _trpc.channel.stopFetch.mutationOptions({
            onSuccess() {
                addLog("info", "fetcher stopped");
                invalidateQueries("channel.getFetcherState");
            },
        }),
    );

    // ── Log helper ──────────────────────────────────────────────────────────────

    const addLog = useCallback((kind: LogLine["kind"], text: string) => {
        setLog((prev) => [...prev.slice(-500), { kind, text, time: ts() }]);
    }, []);

    // Auto-scroll
    useEffect(() => {
        logEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [log]);

    // Boot
    useEffect(() => {
        addLog("system", "tg-blogcast dashboard initialized");
        addLog("system", "channels loaded from Prisma");
    }, []); // eslint-disable-line

    // Reflect fetcher errors from polled state
    const prevError = useRef<string | null>(null);
    useEffect(() => {
        if (fetcherState?.error && fetcherState.error !== prevError.current) {
            addLog(
                "error",
                `${fetcherState.error} (retry #${fetcherState.retryCount})`,
            );
            prevError.current = fetcherState.error;
        }
    }, [fetcherState?.error]); // eslint-disable-line

    // ── Actions ─────────────────────────────────────────────────────────────────
    const [maxTotalFetch, setMaxTotalFetch] = useState<number | undefined>();
    function handleStartFetch() {
        const fetchable = channels.filter((c) => c.isFetchable);
        if (fetchable.length === 0) {
            addLog("error", "no channels marked as fetchable");
            return;
        }
        const target = activeChannel?.isFetchable
            ? activeChannel
            : fetchable[0];
        setActiveChannel(target);
        addLog("cmd", `startFetch · channel=${target.username}`);
        startFetch({ channelId: target.id, maxTotalFetch });
    }

    function handleStopFetch() {
        addLog("cmd", "stopFetch");
        stopFetch();
    }

    async function handleLogout() {
        stopFetch();
        await fetch("/api/auth/logout", { method: "POST" });
        router.push("/login");
    }

    // ── CMD ─────────────────────────────────────────────────────────────────────

    async function handleCmd(e: React.FormEvent) {
        e.preventDefault();
        const raw = cmdInput.trim();
        if (!raw) return;

        setCmdHistory((prev) => [raw, ...prev].slice(0, 50));
        setHistoryIdx(-1);
        setCmdInput("");
        addLog("cmd", raw);

        const [cmd] = raw.split(" ");
        switch (cmd) {
            case "start":
                handleStartFetch();
                break;
            case "stop":
                handleStopFetch();
                break;
            case "sync":
                addLog("cmd", "syncing…");
                syncChannels();
                break;
            case "clear":
                setLog([]);
                break;
            case "status":
                addLog("info", JSON.stringify(fetcherState));
                break;
            case "logout":
                await handleLogout();
                break;
            case "help":
                [
                    "start    – start fetcher for selected fetchable channel",
                    "stop     – stop the fetcher",
                    "sync     – pull missing channels from Telegram into DB",
                    "clear    – clear log",
                    "status   – print fetcher state",
                    "logout   – end session",
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

    const fetcherRunning =
        fetcherState?.status === "running" ||
        fetcherState?.status === "retrying";

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <>
            <style>{`
        ::-webkit-scrollbar{width:6px;height:6px}
        ::-webkit-scrollbar-track{background:#09090b}
        ::-webkit-scrollbar-thumb{background:#27272a;border-radius:3px}
      `}</style>

            <div className="h-screen bg-zinc-950 flex flex-col overflow-hidden text-zinc-200">
                {/* Top bar */}
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
                        <div className="flex items-center gap-2 font-mono text-xs text-zinc-500">
                            <StatusDot
                                status={fetcherState?.status ?? "idle"}
                            />
                            <span>{fetcherState?.status ?? "idle"}</span>
                            {fetcherState && fetcherState.totalFetched > 0 && (
                                <span className="text-zinc-600">
                                    · {fetcherState.totalFetched} fetched
                                </span>
                            )}
                        </div>
                        <input
                            type="number"
                            min={1}
                            value={maxTotalFetch ?? ""}
                            onChange={(e) =>
                                setMaxTotalFetch(
                                    e.target.value
                                        ? parseInt(e.target.value)
                                        : undefined,
                                )
                            }
                            placeholder="max (∞)"
                            className="w-20 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 font-mono text-xs text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-700"
                        />
                        {fetcherRunning ? (
                            <button
                                onClick={handleStopFetch}
                                className="font-mono text-xs px-2 py-1 rounded border border-red-800 text-red-400 hover:bg-red-950/40 transition-colors"
                            >
                                ■ stop
                            </button>
                        ) : (
                            <button
                                onClick={handleStartFetch}
                                disabled={isStarting}
                                className="font-mono text-xs px-2 py-1 rounded border border-emerald-800 text-emerald-400 hover:bg-emerald-950/40 transition-colors disabled:opacity-40"
                            >
                                {isStarting ? "starting…" : "▶ start"}
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
                    {/* Sidebar */}
                    {sidebarOpen && (
                        <aside className="w-60 shrink-0 border-r border-zinc-800 bg-zinc-950 flex flex-col overflow-hidden">
                            <div className="px-3 py-2 border-b border-zinc-800 flex items-center justify-between">
                                <span className="font-mono text-[10px] text-zinc-500 tracking-widest uppercase">
                                    Channels{" "}
                                    {isLoadingChannels && (
                                        <span className="text-zinc-700">…</span>
                                    )}
                                </span>
                                <button
                                    onClick={() => syncChannels()}
                                    disabled={isSyncing}
                                    className="font-mono text-[10px] text-zinc-600 hover:text-emerald-400 transition-colors disabled:opacity-40"
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
                                        channel={ch}
                                        active={activeChannel?.id === ch.id}
                                        onSelect={() => setActiveChannel(ch)}
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
                                    {channels.length} total ·{" "}
                                    {
                                        channels.filter((c) => c.isFetchable)
                                            .length
                                    }{" "}
                                    fetchable
                                </p>
                            </div>
                        </aside>
                    )}

                    {/* Terminal */}
                    <main className="flex-1 flex flex-col overflow-hidden">
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

                        {/* CMD */}
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

