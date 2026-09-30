import { SelectableTranscriptSurface } from "@/components/audio-blog-view/selectable-transcript-surface";
import type { TranscriptSegmentData } from "@/components/audio-blog-view/transcript-segments";
import { buildTranscriptDocument } from "@/components/audio-blog-view/transcript-timing";
import { useSyncedTranscript } from "@/components/audio-blog-view/use-synced-transcript";
import { useAudioStore } from "@/store/audio-store";
import * as Haptics from "expo-haptics";
import React, { useCallback, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";

interface KaraokeTranscriptProps {
	segments: TranscriptSegmentData[];
	positionSecOverride?: number;
	autoScroll?: boolean;
	playbackEnabled?: boolean;
	onSegmentLongPress?: (segment: TranscriptSegmentData) => void;
  onReadPress?: () => void;
	onPressSegment?: (
		segment: TranscriptSegmentData,
		index: number,
		shouldPlay: boolean,
	) => void;
	contentPaddingVertical?: number;
}

export function KaraokeTranscript({
	segments,
	positionSecOverride,
	autoScroll = true,
	playbackEnabled = true,
	onSegmentLongPress,
  onReadPress,
	onPressSegment,
	contentPaddingVertical = 120,
}: KaraokeTranscriptProps) {
	const seek = useAudioStore((audioState) => audioState.seek);
	const play = useAudioStore((audioState) => audioState.play);
	const [followPaused, setFollowPaused] = useState(false);
	const document = useMemo(() => buildTranscriptDocument(segments), [segments]);
	const { activeSegmentIndex, activeWordIndex } = useSyncedTranscript({
		segments,
		positionSecOverride,
	});

	const handlePressSegment = useCallback(
		(segment: TranscriptSegmentData, index: number, shouldPlay: boolean) => {
			void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
			if (!playbackEnabled) return;
			if (onPressSegment) {
				onPressSegment(segment, index, shouldPlay);
				return;
			}
			seek(segment.startSec * 1000)
				.then(() => (shouldPlay ? play() : undefined))
				.catch(() => undefined);
		},
		[onPressSegment, play, playbackEnabled, seek],
	);
	const handleLongPressSegment = useCallback(
		(segment: TranscriptSegmentData) => onSegmentLongPress?.(segment),
		[onSegmentLongPress],
	);
	const handleManualScroll = useCallback(() => {
		if (autoScroll) setFollowPaused(true);
	}, [autoScroll]);

	if (!segments.length) {
		return (
			<View className="flex-1 items-center justify-center p-8">
				<Text
					style={{
						fontSize: 16,
						color: "rgba(255,255,255,0.6)",
						fontWeight: "600",
					}}
				>
					No transcript available
				</Text>
			</View>
		);
	}

	return (
		<View style={{ flex: 1, backgroundColor: "transparent" }}>
			<SelectableTranscriptSurface
				document={document}
				presentation="karaoke"
				selectionEnabled={false}
				contentPaddingVertical={contentPaddingVertical}
				activeSegmentIndex={activeSegmentIndex}
				activeWordIndex={activeWordIndex}
				follow={autoScroll && !followPaused}
				selection={null}
				onManualScroll={handleManualScroll}
				onPressSegment={handlePressSegment}
				onLongPressSegment={handleLongPressSegment}
			/>
			<View style={{ minHeight: 44, flexDirection: "row", alignItems: "center", paddingHorizontal: 8 }}>
				<Pressable
					onPress={onReadPress}
					accessibilityRole="button"
					accessibilityLabel="Read transcript"
					style={{ minHeight: 44, minWidth: 44, paddingHorizontal: 8, alignItems: "center", justifyContent: "center", backgroundColor: "transparent" }}
				>
					<Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>Read</Text>
				</Pressable>
				<View style={{ flex: 1 }} />
				<Pressable
					onPress={() => setFollowPaused(false)}
					disabled={!autoScroll}
					accessibilityRole="button"
					accessibilityLabel="Return to live transcript position"
					style={{ minWidth: 44, minHeight: 44, borderRadius: 22, backgroundColor: followPaused ? "#bfdbfe" : "rgba(191,219,254,0.16)", paddingHorizontal: 14, alignItems: "center", justifyContent: "center", opacity: autoScroll ? 1 : 0.6 }}
				>
					<Text style={{ color: followPaused ? "#1e3a5f" : "#ffffff", fontSize: 12, fontWeight: "800" }}>Live</Text>
				</Pressable>
			</View>
		</View>
	);
}
