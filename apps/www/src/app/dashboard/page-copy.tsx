"use client";

// app/dashboard/page.tsx
// Main dashboard: channel selector + live message fetcher with CMD-style output.

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useMessageFetcher } from "@/hooks/use-message-fetcher";
import type { FetchedMessage, FetcherState } from "@/hooks/use-message-fetcher";
import { cn } from "@acme/ui/cn";

function ts() {
    return new Date().toTimeString().slice(0, 8);
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface Channel {
    id: string;
    title: string;
    username: string | null;
}

interface LogLine {
    kind: "system" | "info" | "success" | "error" | "msg" | "cmd";
    text: string;
    time: string;
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
        <div className="flex gap-3 font-mono text-xs leading-5 group">
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

function ChannelBadge({
    channel,
    active,
    onClick,
}: {
    channel: Channel;
    active: boolean;
    onClick: () => void;
}) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "w-full text-left px-3 py-2 rounded font-mono text-xs transition-all duration-150",
                "border",
                active
                    ? "bg-emerald-950/50 border-emerald-700 text-emerald-300"
                    : "bg-transparent border-transparent text-zinc-400 hover:border-zinc-700 hover:text-zinc-200",
            )}
        >
            <div className="truncate font-semibold">{channel.title}</div>
            {channel.username && (
                <div className="text-zinc-600 truncate">
                    @{channel.username}
                </div>
            )}
        </button>
    );
}

// ── Main dashboard ────────────────────────────────────────────────────────────

export default function DashboardPage() {
    const router = useRouter();
    const { messages, state, connecting, start, stop, clearMessages } =
        useMessageFetcher();

    const [channels, setChannels] = useState<Channel[]>([]);
    const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
    const [channelsLoading, setChannelsLoading] = useState(false);
    const [log, setLog] = useState<LogLine[]>([]);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [cmdInput, setCmdInput] = useState("");
    const [cmdHistory, setCmdHistory] = useState<string[]>([]);
    const [historyIdx, setHistoryIdx] = useState(-1);

    const logEndRef = useRef<HTMLDivElement>(null);
    const cmdRef = useRef<HTMLInputElement>(null);

    // ── Logging helper ──────────────────────────────────────────────────────────
    const addLog = useCallback((kind: LogLine["kind"], text: string) => {
        setLog((prev) => [...prev.slice(-500), { kind, text, time: ts() }]);
    }, []);

    // ── Auto-scroll ─────────────────────────────────────────────────────────────
    useEffect(() => {
        logEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [log]);

    // ── Boot sequence ────────────────────────────────────────────────────────────
    useEffect(() => {
        addLog("system", "tg-proxy dashboard initialized");
        addLog("system", "connecting to event stream…");
    }, [addLog]);

    // ── SSE state → log ─────────────────────────────────────────────────────────
    useEffect(() => {
        if (!connecting && state) {
            addLog("success", `stream connected · fetcher=${state.status}`);
        }
    }, [connecting, addLog]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── New messages → log ───────────────────────────────────────────────────────
    useEffect(() => {
        if (messages.length === 0) return;
        const latest = messages[messages.length - 1];
        addLog(
            "msg",
            `[${latest.id}] ${latest.text?.slice(0, 120) ?? "(media)"} ${latest.fileId ? `· file=${latest.fileId.slice(0, 20)}…` : ""}`,
        );
    }, [messages, addLog]);

    // ── Fetcher error → log ──────────────────────────────────────────────────────
    useEffect(() => {
        if (state?.error) {
            addLog("error", `${state.error} (retry #${state.retryCount})`);
        }
    }, [state?.error, state?.retryCount, addLog]);

    // ── Load channels ────────────────────────────────────────────────────────────
    async function loadChannels() {
        setChannelsLoading(true);
        addLog("cmd", "GET /api/telegram/channels");
        try {
            const res = await fetch("/api/telegram/channels");
            const data = await res.json();
            setChannels(data.channels ?? []);
            addLog("success", `loaded ${data.channels?.length ?? 0} channels`);
        } catch (err) {
            addLog("error", `failed to load channels: ${err}`);
        } finally {
            setChannelsLoading(false);
        }
    }

    useEffect(() => {
        loadChannels();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Select channel ───────────────────────────────────────────────────────────
    async function selectChannel(ch: Channel) {
        setActiveChannel(ch);
        clearMessages();
        addLog("cmd", `start fetcher · channel=${ch.id} (${ch.title})`);
        await start(ch.id);
        addLog("success", `fetcher started for ${ch.title}`);
    }

    // ── Logout ───────────────────────────────────────────────────────────────────
    async function handleLogout() {
        addLog("cmd", "POST /api/auth/logout");
        await stop();
        await fetch("/api/auth/logout", { method: "POST" });
        router.push("/login");
    }

    // ── CMD input ────────────────────────────────────────────────────────────────
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
                if (activeChannel) {
                    clearMessages();
                    await start(
                        activeChannel.id,
                        args[0] ? parseInt(args[0]) : undefined,
                    );
                    addLog(
                        "success",
                        `fetcher started${args[0] ? ` from id=${args[0]}` : ""}`,
                    );
                } else {
                    addLog("error", "no channel selected");
                }
                break;
            case "stop":
                await stop();
                addLog("info", "fetcher stopped");
                break;
            case "clear":
                setLog([]);
                clearMessages();
                break;
            case "channels":
                await loadChannels();
                break;
            case "status":
                addLog("info", JSON.stringify(state));
                break;
            case "logout":
                await handleLogout();
                break;
            case "help":
                [
                    "start [startId]  – start fetcher for selected channel",
                    "stop             – stop the fetcher",
                    "clear            – clear log and message buffer",
                    "channels         – reload channel list",
                    "status           – print fetcher state",
                    "logout           – end session",
                ].forEach((l) => addLog("info", l));
                break;
            default:
                addLog(
                    "error",
                    `unknown command: ${cmd}. type 'help' for commands.`,
                );
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

    // ── Render ────────────────────────────────────────────────────────────────────
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
                            className="font-mono text-xs text-zinc-500 hover:text-zinc-300 transition-colors px-1"
                            title="Toggle sidebar"
                        >
                            {sidebarOpen ? "◀" : "▶"}
                        </button>
                        <span className="font-mono text-sm text-zinc-300 tracking-wider">
                            tg<span className="text-emerald-400">-proxy</span>
                        </span>
                        {activeChannel && (
                            <>
                                <span className="text-zinc-700">/</span>
                                <span className="font-mono text-xs text-emerald-400 truncate max-w-[200px]">
                                    {activeChannel.title}
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

                        {/* SSE indicator */}
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
                        <aside className="w-56 shrink-0 border-r border-zinc-800 bg-zinc-950 flex flex-col overflow-hidden">
                            <div className="px-3 py-2 border-b border-zinc-800 flex items-center justify-between">
                                <span className="font-mono text-[10px] text-zinc-500 tracking-widest uppercase">
                                    Channels
                                </span>
                                <button
                                    onClick={loadChannels}
                                    disabled={channelsLoading}
                                    className="font-mono text-[10px] text-zinc-600 hover:text-zinc-300 transition-colors disabled:opacity-40"
                                    title="Reload channels"
                                >
                                    {channelsLoading ? "…" : "⟳"}
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
                                {channels.length === 0 && (
                                    <p className="font-mono text-[10px] text-zinc-600 px-2 py-3 text-center">
                                        {channelsLoading
                                            ? "Loading…"
                                            : "No channels found"}
                                    </p>
                                )}
                                {channels.map((ch) => (
                                    <ChannelBadge
                                        key={ch.id}
                                        channel={ch}
                                        active={activeChannel?.id === ch.id}
                                        onClick={() => selectChannel(ch)}
                                    />
                                ))}
                            </div>

                            {/* Sidebar footer */}
                            <div className="px-3 py-2 border-t border-zinc-800">
                                <p className="font-mono text-[10px] text-zinc-600">
                                    {channels.length} channels
                                </p>
                            </div>
                        </aside>
                    )}

                    {/* ── Main terminal ── */}
                    <main className="flex-1 flex flex-col overflow-hidden">
                        {/* Log output */}
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

                        {/* Message cards strip (latest 5) */}
                        {messages.length > 0 && (
                            <div className="shrink-0 border-t border-zinc-800 bg-zinc-900/50 p-3">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="font-mono text-[10px] text-zinc-500 tracking-widest uppercase">
                                        Latest messages
                                    </span>
                                    <span className="font-mono text-[10px] text-zinc-700">
                                        ({messages.length} total)
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
                                    ref={cmdRef}
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

// ── Message card ──────────────────────────────────────────────────────────────

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

