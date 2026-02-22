"use client";

// app/login/page.tsx
// Terminal-aesthetic login with two steps: phone number → OTP verification
import { cn } from "@acme/ui/cn";
import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { useRouter } from "next/navigation";

// ── Types ─────────────────────────────────────────────────────────────────────
type Step = "phone" | "otp" | "loading";

// ── Sub-components ────────────────────────────────────────────────────────────

function TerminalLine({
    prompt = ">",
    children,
    dim,
}: {
    prompt?: string;
    children: React.ReactNode;
    dim?: boolean;
}) {
    return (
        <div
            className={cn(
                "flex gap-2 font-mono text-sm",
                dim ? "text-zinc-500" : "text-zinc-300",
            )}
        >
            <span className="text-emerald-400 select-none">{prompt}</span>
            <span>{children}</span>
        </div>
    );
}

function Cursor() {
    return (
        <span className="inline-block w-2 h-4 bg-emerald-400 ml-0.5 animate-[blink_1s_step-end_infinite]" />
    );
}

function ErrorBanner({ message }: { message: string }) {
    return (
        <div className="border border-red-800 bg-red-950/40 rounded px-3 py-2 font-mono text-xs text-red-400 flex gap-2 items-start">
            <span className="text-red-500 mt-px">✗</span>
            <span>{message}</span>
        </div>
    );
}

// ── OTP input — 5 separate digit boxes ───────────────────────────────────────

function OtpInput({ onComplete }: { onComplete: (code: string) => void }) {
    const [digits, setDigits] = useState<string[]>(["", "", "", "", ""]);
    const refs = useRef<(HTMLInputElement | null)[]>([]);

    function handleChange(idx: number, val: string) {
        const char = val.replace(/\D/g, "").slice(-1);
        const next = [...digits];
        next[idx] = char;
        setDigits(next);
        if (char && idx < 4) refs.current[idx + 1]?.focus();
        if (next.every((d) => d !== "")) onComplete(next.join(""));
    }

    function handleKeyDown(idx: number, e: KeyboardEvent<HTMLInputElement>) {
        if (e.key === "Backspace" && !digits[idx] && idx > 0) {
            refs.current[idx - 1]?.focus();
        }
        if (e.key === "ArrowLeft" && idx > 0) refs.current[idx - 1]?.focus();
        if (e.key === "ArrowRight" && idx < 4) refs.current[idx + 1]?.focus();
    }

    function handlePaste(e: React.ClipboardEvent) {
        const pasted = e.clipboardData
            .getData("text")
            .replace(/\D/g, "")
            .slice(0, 5);
        if (pasted.length === 5) {
            setDigits(pasted.split(""));
            onComplete(pasted);
        }
    }

    return (
        <div className="flex gap-3" onPaste={handlePaste}>
            {digits.map((d, i) => (
                <input
                    key={i}
                    ref={(el) => {
                        refs.current[i] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={d}
                    onChange={(e) => handleChange(i, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(i, e)}
                    className={cn(
                        "w-11 h-14 text-center text-xl font-mono font-bold",
                        "bg-zinc-900 border rounded",
                        "text-emerald-300 caret-emerald-400",
                        "focus:outline-none focus:ring-1 focus:ring-emerald-500",
                        d ? "border-emerald-600" : "border-zinc-700",
                        "transition-colors duration-150",
                    )}
                    autoFocus={i === 0}
                />
            ))}
        </div>
    );
}

// ── Main login page ───────────────────────────────────────────────────────────

export default function LoginPage() {
    const router = useRouter();
    const [step, setStep] = useState<Step>("phone");
    const [phone, setPhone] = useState("");
    const [error, setError] = useState("");
    const [log, setLog] = useState<string[]>([]);
    const phoneRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        phoneRef.current?.focus();
    }, []);

    function addLog(line: string) {
        setLog((prev) => [...prev, line]);
    }

    // ── Step 1: send code ───────────────────────────────────────────────────────
    async function handleSendCode(e: React.FormEvent) {
        e.preventDefault();
        setError("");
        setStep("loading");
        addLog(`Dialing ${phone}…`);

        try {
            const res = await fetch("/api/auth/send-code", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phoneNumber: phone }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            addLog("Code dispatched via Telegram.");
            setStep("otp");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unknown error");
            setStep("phone");
        }
    }

    // 🧩 Restore on mount
    useEffect(() => {
        const saved = localStorage.getItem("tg_login_phone");
        if (saved) setPhone(saved);
    }, []);

    // 🧩 Persist on change
    function handlePhoneChange(e: React.ChangeEvent<HTMLInputElement>) {
        setPhone(e.target.value);
        localStorage.setItem("tg_login_phone", e.target.value);
    }
    // ── Step 2: verify OTP ──────────────────────────────────────────────────────
    async function handleVerify(code: string) {
        setError("");
        setStep("loading");
        addLog(`Verifying code ${code}…`);

        try {
            const res = await fetch("/api/auth/verify-code", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phoneNumber: phone, code }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            addLog("Authentication successful. Redirecting…");
            router.push("/dashboard");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unknown error");
            setStep("otp");
        }
    }

    const isLoading = step === "loading";

    return (
        <>
            {/* Global blink keyframe */}
            <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes scanline {
          0% { background-position: 0 0; }
          100% { background-position: 0 100%; }
        }
      `}</style>

            <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4 relative overflow-hidden">
                {/* Scanline overlay */}
                <div
                    className="pointer-events-none absolute inset-0 opacity-[0.03]"
                    style={{
                        backgroundImage:
                            "repeating-linear-gradient(0deg, transparent, transparent 2px, #fff 2px, #fff 4px)",
                        backgroundSize: "100% 4px",
                    }}
                />

                {/* Ambient glow */}
                <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-emerald-900/10 blur-3xl" />

                <div className="relative w-full max-w-md">
                    {/* Terminal window chrome */}
                    <div className="border border-zinc-800 rounded-lg overflow-hidden shadow-2xl shadow-black/60 bg-zinc-950">
                        {/* Title bar */}
                        <div className="flex items-center gap-2 px-4 py-3 bg-zinc-900 border-b border-zinc-800">
                            <span className="w-3 h-3 rounded-full bg-red-500/80" />
                            <span className="w-3 h-3 rounded-full bg-yellow-500/80" />
                            <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
                            <span className="ml-3 font-mono text-xs text-zinc-500 tracking-widest uppercase">
                                tg-proxy — auth
                            </span>
                        </div>

                        <div className="p-6 space-y-5">
                            {/* Session log */}
                            {log.length > 0 && (
                                <div className="space-y-1 border-b border-zinc-800 pb-4">
                                    {log.map((line, i) => (
                                        <TerminalLine key={i} dim>
                                            {line}
                                        </TerminalLine>
                                    ))}
                                </div>
                            )}

                            {/* ── PHONE STEP ── */}
                            {(step === "phone" ||
                                (isLoading && log.length <= 1)) && (
                                <div className="space-y-4">
                                    <TerminalLine>
                                        Authenticate with Telegram
                                    </TerminalLine>
                                    <TerminalLine dim>
                                        Enter your phone number to receive a
                                        one-time code.
                                    </TerminalLine>

                                    {error && <ErrorBanner message={error} />}

                                    <form
                                        onSubmit={handleSendCode}
                                        className="space-y-3"
                                    >
                                        <div className="flex items-center gap-2 font-mono text-sm border border-zinc-700 rounded bg-zinc-900 px-3 py-2 focus-within:border-emerald-600 transition-colors">
                                            <span className="text-emerald-400 select-none">
                                                $
                                            </span>
                                            <input
                                                onChange={handlePhoneChange}
                                                ref={phoneRef}
                                                type="tel"
                                                value={phone}
                                                // onChange={(e) =>
                                                //     setPhone(e.target.value)
                                                // }
                                                placeholder="+1 555 000 0000"
                                                disabled={isLoading}
                                                className="flex-1 bg-transparent text-zinc-200 placeholder:text-zinc-600 focus:outline-none"
                                            />
                                            {!isLoading && <Cursor />}
                                        </div>
                                        <button
                                            type="submit"
                                            disabled={
                                                isLoading || !phone.trim()
                                            }
                                            className={cn(
                                                "w-full font-mono text-sm py-2 px-4 rounded border transition-all duration-150",
                                                "border-emerald-700 text-emerald-400 bg-emerald-950/30",
                                                "hover:bg-emerald-900/40 hover:border-emerald-500",
                                                "disabled:opacity-40 disabled:cursor-not-allowed",
                                                "focus:outline-none focus:ring-1 focus:ring-emerald-600",
                                            )}
                                        >
                                            {isLoading
                                                ? "Sending…"
                                                : "send-code --via telegram"}
                                        </button>
                                    </form>
                                </div>
                            )}

                            {/* ── OTP STEP ── */}
                            {step === "otp" && (
                                <div className="space-y-4">
                                    <TerminalLine>
                                        Code sent to {phone}
                                    </TerminalLine>
                                    <TerminalLine dim>
                                        Enter the 5-digit code from your
                                        Telegram app.
                                    </TerminalLine>

                                    {error && <ErrorBanner message={error} />}

                                    <OtpInput onComplete={handleVerify} />

                                    <button
                                        onClick={() => {
                                            setStep("phone");
                                            setError("");
                                        }}
                                        className="font-mono text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                                    >
                                        ← change number
                                    </button>
                                </div>
                            )}

                            {/* ── LOADING ── */}
                            {isLoading && (
                                <div className="flex items-center gap-2 font-mono text-sm text-emerald-400">
                                    <span className="animate-spin select-none">
                                        ⠋
                                    </span>
                                    <span>Processing…</span>
                                </div>
                            )}

                            {/* Footer */}
                            <div className="pt-2 border-t border-zinc-800">
                                <p className="font-mono text-[10px] text-zinc-600 tracking-wider">
                                    SESSION ENCRYPTED · HTTPONLY COOKIE · TLS
                                    REQUIRED
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Version tag */}
                    <p className="text-center mt-3 font-mono text-[10px] text-zinc-700">
                        tg-proxy v1.0.0 · built with next.js
                    </p>
                </div>
            </div>
        </>
    );
}

