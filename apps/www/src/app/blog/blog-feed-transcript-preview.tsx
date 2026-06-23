"use client";

import { useEffect, useMemo, useState } from "react";

type BlogFeedTranscriptSegment = {
    id: number;
    startSec: number;
    endSec: number;
    text: string;
};

type BlogFeedTranscriptPreviewProps = {
    blogId: number;
    segments: BlogFeedTranscriptSegment[];
};

type AudioStateEvent = CustomEvent<{
    id: number;
    currentTime: number;
    isPlaying: boolean;
}>;

const audioStateEventName = "blog-feed-audio-state";

function getActiveSegment(
    segments: BlogFeedTranscriptSegment[],
    currentTime: number,
) {
    return (
        segments.find(
            (segment) =>
                currentTime >= segment.startSec && currentTime < segment.endSec,
        ) ?? segments.find((segment) => segment.text.trim())
    );
}

export function BlogFeedTranscriptPreview({
    blogId,
    segments,
}: BlogFeedTranscriptPreviewProps) {
    const [playback, setPlayback] = useState({
        currentTime: 0,
        isPlaying: false,
    });

    useEffect(() => {
        const handleAudioState = (event: Event) => {
            const detail = (event as AudioStateEvent).detail;
            if (detail.id !== blogId) {
                setPlayback((state) =>
                    state.isPlaying
                        ? { currentTime: state.currentTime, isPlaying: false }
                        : state,
                );
                return;
            }

            setPlayback({
                currentTime: detail.currentTime,
                isPlaying: detail.isPlaying,
            });
        };

        window.addEventListener(audioStateEventName, handleAudioState);
        return () => {
            window.removeEventListener(audioStateEventName, handleAudioState);
        };
    }, [blogId]);

    const activeSegment = useMemo(
        () => getActiveSegment(segments, playback.currentTime),
        [playback.currentTime, segments],
    );

    if (!playback.isPlaying || !activeSegment) return null;

    return (
        <div className="mx-4 mb-2 rounded-lg bg-muted px-3 py-2">
            <p
                dir="rtl"
                className="truncate text-right text-xs font-medium leading-5 text-muted-foreground"
            >
                {activeSegment.text}
            </p>
        </div>
    );
}
