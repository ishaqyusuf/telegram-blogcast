"use client";

import { useRef, type RefObject } from "react";

type AudioPlayerProps = {
    src: string;
    title?: string;
    audioRef?: RefObject<HTMLAudioElement | null>;
    stopLinkNavigation?: boolean;
    className?: string;
};

export function AudioPlayer({
    src,
    title = "Audio",
    audioRef,
    stopLinkNavigation = false,
    className = "",
}: AudioPlayerProps) {
    const localAudioRef = useRef<HTMLAudioElement>(null);
    const resolvedAudioRef = audioRef ?? localAudioRef;

    return (
        <div
            className={`px-4 pb-4 ${className}`.trim()}
            onClick={
                stopLinkNavigation
                    ? (e) => {
                          e.preventDefault();
                          e.stopPropagation();
                      }
                    : undefined
            }
        >
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-3">
                <p className="mb-2 text-xs uppercase tracking-wide text-zinc-400">
                    {title}
                </p>
                <audio
                    controls
                    preload="metadata"
                    className="w-full"
                    src={src}
                    ref={resolvedAudioRef}
                />
            </div>
        </div>
    );
}
