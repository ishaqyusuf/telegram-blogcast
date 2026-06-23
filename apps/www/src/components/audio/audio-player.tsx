"use client";

import { useRef, type ReactNode, type RefObject } from "react";

type AudioPlayerProps = {
    src: string;
    title?: string;
    audioRef?: RefObject<HTMLAudioElement | null>;
    stopLinkNavigation?: boolean;
    className?: string;
    beforeControls?: ReactNode;
    flush?: boolean;
};

export function AudioPlayer({
    src,
    title = "Audio",
    audioRef,
    stopLinkNavigation = false,
    className = "",
    beforeControls,
    flush = false,
}: AudioPlayerProps) {
    const localAudioRef = useRef<HTMLAudioElement>(null);
    const resolvedAudioRef = audioRef ?? localAudioRef;
    const rootClassName = [flush ? "" : "px-4 pb-4", className]
        .filter(Boolean)
        .join(" ");

    return (
        <div
            className={rootClassName}
            onClick={
                stopLinkNavigation
                    ? (e) => {
                          e.preventDefault();
                          e.stopPropagation();
                      }
                    : undefined
                }
        >
            <div className="rounded-xl border border-border bg-card p-3">
                <p className="mb-2 line-clamp-2 text-xs font-medium text-muted-foreground">
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
