"use client";

import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type BlogFeedAudioButtonProps = {
    id: number;
    src: string;
    title: string;
};

const playEventName = "blog-feed-audio-play";
const audioStateEventName = "blog-feed-audio-state";

function dispatchAudioState(
    id: number,
    audio: HTMLAudioElement,
    isPlaying: boolean,
) {
    window.dispatchEvent(
        new CustomEvent(audioStateEventName, {
            detail: {
                id,
                currentTime: audio.currentTime,
                isPlaying,
            },
        }),
    );
}

export function BlogFeedAudioButton({ id, src, title }: BlogFeedAudioButtonProps) {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const handlePlayElsewhere = (event: Event) => {
            const detail = (event as CustomEvent<{ id: number }>).detail;
            if (detail?.id !== id) {
                audio.pause();
            }
        };
        const handlePlay = () => {
            setIsPlaying(true);
            dispatchAudioState(id, audio, true);
        };
        const handlePause = () => {
            setIsPlaying(false);
            dispatchAudioState(id, audio, false);
        };
        const handleTimeUpdate = () => {
            if (!audio.paused) {
                dispatchAudioState(id, audio, true);
            }
        };

        window.addEventListener(playEventName, handlePlayElsewhere);
        audio.addEventListener("play", handlePlay);
        audio.addEventListener("pause", handlePause);
        audio.addEventListener("ended", handlePause);
        audio.addEventListener("timeupdate", handleTimeUpdate);

        return () => {
            window.removeEventListener(playEventName, handlePlayElsewhere);
            audio.removeEventListener("play", handlePlay);
            audio.removeEventListener("pause", handlePause);
            audio.removeEventListener("ended", handlePause);
            audio.removeEventListener("timeupdate", handleTimeUpdate);
        };
    }, [id]);

    return (
        <>
            <button
                type="button"
                aria-label={isPlaying ? `Pause ${title}` : `Play ${title}`}
                onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();

                    const audio = audioRef.current;
                    if (!audio) return;

                    if (isPlaying) {
                        audio.pause();
                        return;
                    }

                    window.dispatchEvent(
                        new CustomEvent(playEventName, { detail: { id } }),
                    );
                    void audio.play();
                }}
                className="inline-flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors hover:bg-primary/15"
            >
                {isPlaying ? (
                    <Pause size={18} fill="currentColor" />
                ) : (
                    <Play size={18} fill="currentColor" />
                )}
            </button>
            <audio ref={audioRef} src={src} preload="metadata" />
        </>
    );
}
