"use client";

import { useRef, type ReactNode, type RefObject } from "react";

type AudioPlayerProps = {
    src: string;
    title?: string;
    audioRef?: RefObject<HTMLAudioElement | null>;
    stopLinkNavigation?: boolean;
    className?: string;
    beforeControls?: ReactNode;
};

export function AudioPlayer({
    src,
    title = "Audio",
    audioRef,
    stopLinkNavigation = false,
    className = "",
    beforeControls,
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
                {beforeControls}
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
