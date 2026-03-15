import { useMutation } from "@acme/ui/tanstack";
import { useEffect, useRef } from "react";

import { _trpc } from "@/components/static-trpc";
import { useAudioStore } from "@/store/audio-store";

/**
 * Automatically saves play position to the server:
 *  - Every 30 seconds while playing
 *  - On pause
 */
export function usePlayHistorySync(mediaId: number | undefined) {
  const isPlaying = useAudioStore((s) => s.isPlaying);
  const position = useAudioStore((s) => s.position);
  const positionRef = useRef(position);
  positionRef.current = position;

  const { mutate: savePlayHistory } = useMutation(
    _trpc.blog.savePlayHistory.mutationOptions()
  );

  // Save on pause
  useEffect(() => {
    if (!isPlaying && mediaId) {
      savePlayHistory({ mediaId, progressMs: positionRef.current });
    }
  }, [isPlaying]); // eslint-disable-line

  // Save every 30 seconds while playing
  useEffect(() => {
    if (!isPlaying || !mediaId) return;
    const interval = setInterval(() => {
      savePlayHistory({ mediaId, progressMs: positionRef.current });
    }, 30_000);
    return () => clearInterval(interval);
  }, [isPlaying, mediaId]); // eslint-disable-line
}
