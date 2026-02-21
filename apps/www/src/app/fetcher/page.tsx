// app/example/page.tsx  (or wherever you want to use it)
//
// Example component showing how to wire up useMessageFetcher.
// Replace with your own UI as needed.
"use client";

import { useState } from "react";
import { useMessageFetcher } from "@/hooks/use-message-fetcher";

export default function FetcherExamplePage() {
    const { messages, state, connecting, start, stop, clearMessages } =
        useMessageFetcher();

    const [channelId, setChannelId] = useState("@username_or_id");

    return (
        <div style={{ fontFamily: "monospace", padding: 24 }}>
            <h1>Telegram Message Fetcher</h1>

            {/* Controls */}
            <div style={{ marginBottom: 16, display: "flex", gap: 8 }}>
                <input
                    value={channelId}
                    onChange={(e) => setChannelId(e.target.value)}
                    placeholder="Channel id or @username"
                    style={{ width: 260, padding: "4px 8px" }}
                />
                <button onClick={() => start(channelId)}>▶ Start</button>
                <button onClick={stop}>■ Stop</button>
                <button onClick={clearMessages}>🗑 Clear</button>
            </div>

            {/* Status badge */}
            <div style={{ marginBottom: 16 }}>
                {connecting && (
                    <span style={{ color: "orange" }}>
                        ● Connecting to stream…
                    </span>
                )}
                {!connecting && state && (
                    <span
                        style={{
                            color:
                                state.status === "running"
                                    ? "green"
                                    : state.status === "retrying"
                                      ? "orange"
                                      : state.status === "stopped"
                                        ? "gray"
                                        : "inherit",
                        }}
                    >
                        ● {state.status.toUpperCase()}
                        {state.status === "retrying" &&
                            ` (attempt ${state.retryCount}) – ${state.error}`}
                        {" | "}
                        cursor: {state.lastMessageId ?? "none"}
                        {" | "}
                        fetched: {state.totalFetched}
                    </span>
                )}
            </div>

            {/* Message list */}
            <div
                style={{
                    maxHeight: 500,
                    overflowY: "auto",
                    border: "1px solid #ddd",
                    padding: 8,
                }}
            >
                {messages.length === 0 && (
                    <div style={{ color: "#888" }}>No messages yet.</div>
                )}
                {messages.map((msg) => (
                    <div
                        key={msg.id}
                        style={{
                            borderBottom: "1px solid #eee",
                            padding: "6px 0",
                        }}
                    >
                        <span style={{ color: "#888", fontSize: 11 }}>
                            #{msg.id} · {msg.date}
                        </span>
                        {msg.fileId && (
                            <span
                                style={{
                                    marginLeft: 8,
                                    background: "#e8f4ff",
                                    borderRadius: 4,
                                    padding: "1px 5px",
                                    fontSize: 11,
                                }}
                            >
                                📎 {msg.fileId.slice(0, 20)}…
                            </span>
                        )}
                        <div>
                            {msg.text ?? (
                                <em style={{ color: "#aaa" }}>(media only)</em>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

