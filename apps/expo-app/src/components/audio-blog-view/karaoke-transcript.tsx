import {
	type TranscriptDisplaySegment,
	buildTranscriptDisplayRuns,
} from "@/components/audio-blog-view/transcript-display-runs";
import { resolveTranscriptScrollBehavior } from "@/components/audio-blog-view/transcript-follow-state";
import {
	type TranscriptSegmentData,
	getTranscriptSegmentKey,
} from "@/components/audio-blog-view/transcript-segments";
import { buildTranscriptDocument } from "@/components/audio-blog-view/transcript-timing";
import { useSyncedTranscript } from "@/components/audio-blog-view/use-synced-transcript";
import { useAudioStore } from "@/store/audio-store";
import { LegendList, type LegendListRef } from "@legendapp/list";
import * as Haptics from "expo-haptics";
import React, {
	memo,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { Pressable, Text, View } from "react-native";

interface KaraokeTranscriptProps {
	segments: TranscriptSegmentData[];
	positionSecOverride?: number;
	autoScroll?: boolean;
	playbackEnabled?: boolean;
	onSegmentLongPress?: (segment: TranscriptSegmentData) => void;
	onPressSegment?: (
		segment: TranscriptSegmentData,
		index: number,
		shouldPlay: boolean,
	) => void;
	selectable?: boolean;
	contentPaddingVertical?: number;
}

type TranscriptRowProps = {
	displaySegment: TranscriptDisplaySegment;
	index: number;
	isActive: boolean;
	activeWordIndex: number;
	selectable: boolean;
	onPressSegment: (segment: TranscriptSegmentData, index: number) => void;
	onLongPressSegment?: (segment: TranscriptSegmentData) => void;
};

const TranscriptRow = memo(function TranscriptRow({
	displaySegment,
	index,
	isActive,
	activeWordIndex,
	selectable,
	onPressSegment,
	onLongPressSegment,
}: TranscriptRowProps) {
	const { segment, runs } = displaySegment;
	return (
		<Pressable
			onPress={() => onPressSegment(segment, index)}
			onLongPress={() => onLongPressSegment?.(segment)}
		>
			<Text
				selectable={selectable}
				android_hyphenationFrequency="none"
				lineBreakStrategyIOS="standard"
				textBreakStrategy="highQuality"
				style={{
					fontSize: 28,
					lineHeight: 40,
					textAlign: "right",
					writingDirection: "rtl",
					fontWeight: "700",
					color: isActive ? "#ffffff" : "rgba(255, 255, 255, 0.4)",
				}}
			>
				{runs.map((run) => (
					<Text
						key={run.key}
						selectable={selectable}
						style={{
							color:
								isActive && run.wordIndex === activeWordIndex
									? "#ffffff"
									: isActive
										? "rgba(255,255,255,0.82)"
										: "rgba(255,255,255,0.4)",
						}}
					>
						{run.text}
					</Text>
				))}
			</Text>
		</Pressable>
	);
});

export function KaraokeTranscript({
	segments,
	positionSecOverride,
	autoScroll = true,
	playbackEnabled = true,
	onSegmentLongPress,
	onPressSegment,
	selectable = false,
	contentPaddingVertical = 120,
}: KaraokeTranscriptProps) {
	const seek = useAudioStore((s) => s.seek);
	const play = useAudioStore((s) => s.play);
	const listRef = useRef<LegendListRef>(null);
	const lastTapRef = useRef<{ key: string; at: number } | null>(null);
	const [followPaused, setFollowPaused] = useState(false);
	const hasPositionedRef = useRef(false);
	const previousActiveIdxRef = useRef(-1);
	const { activeSegmentIndex: activeIdx, activeWordIndex: activeWordIdx } =
		useSyncedTranscript({ segments, positionSecOverride });
	const displaySegments = useMemo(
		() => buildTranscriptDisplayRuns(buildTranscriptDocument(segments)),
		[segments],
	);

	const scrollToActiveSegment = useCallback(
		(behavior: "instant" | "smooth") => {
			if (activeIdx < 0 || !segments.length) return;
			listRef.current?.scrollToIndex({
				index: activeIdx,
				animated: behavior === "smooth",
				viewPosition: 0.5,
			});
		},
		[activeIdx, segments.length],
	);

	const resumeFollowing = useCallback(() => {
		setFollowPaused(false);
		scrollToActiveSegment("smooth");
	}, [scrollToActiveSegment]);

	const handlePressSegment = useCallback(
		(segment: TranscriptSegmentData, index: number) => {
			Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
			if (!playbackEnabled) return;

			const key = getTranscriptSegmentKey(segment, index);
			const now = Date.now();
			const lastTap = lastTapRef.current;
			lastTapRef.current = { key, at: now };
			const shouldPlay = lastTap?.key === key && now - lastTap.at < 320;
			if (onPressSegment) {
				onPressSegment(segment, index, shouldPlay);
				return;
			}
			seek(segment.startSec * 1000)
				.then(() => {
					if (shouldPlay) return play();
				})
				.catch(() => undefined);
		},
		[onPressSegment, play, playbackEnabled, seek],
	);

	const renderItem = useCallback(
		({ item, index }: { item: TranscriptDisplaySegment; index: number }) => (
			<TranscriptRow
				displaySegment={item}
				index={index}
				isActive={index === activeIdx}
				activeWordIndex={index === activeIdx ? activeWordIdx : -1}
				selectable={selectable}
				onPressSegment={handlePressSegment}
				onLongPressSegment={onSegmentLongPress}
			/>
		),
		[
			activeIdx,
			activeWordIdx,
			handlePressSegment,
			onSegmentLongPress,
			selectable,
		],
	);

	useEffect(() => {
		const behavior = resolveTranscriptScrollBehavior({
			hasPositioned: hasPositionedRef.current,
			follow: autoScroll && !followPaused,
			activeSegmentIndex: activeIdx,
			previousActiveSegmentIndex: previousActiveIdxRef.current,
		});
		previousActiveIdxRef.current = activeIdx;
		if (!behavior) return;
		scrollToActiveSegment(behavior);
		hasPositionedRef.current = true;
	}, [activeIdx, autoScroll, followPaused, scrollToActiveSegment]);

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
		<View style={{ flex: 1 }}>
			<LegendList
				ref={listRef}
				data={displaySegments}
				keyExtractor={(item) => item.key}
				initialScrollIndex={activeIdx >= 0 ? activeIdx : 0}
				extraData={`${activeIdx}:${activeWordIdx}:${selectable ? 1 : 0}`}
				showsVerticalScrollIndicator={false}
				nestedScrollEnabled
				recycleItems
				estimatedItemSize={72}
				drawDistance={480}
				contentContainerStyle={{
					paddingHorizontal: 24,
					paddingVertical: contentPaddingVertical,
					gap: 16,
				}}
				onScrollBeginDrag={() => {
					if (autoScroll) setFollowPaused(true);
				}}
				maintainVisibleContentPosition
				renderItem={renderItem}
			/>
			{autoScroll && followPaused ? (
				<Pressable
					onPress={resumeFollowing}
					style={{
						position: "absolute",
						right: 18,
						bottom: 18,
						minHeight: 44,
						borderRadius: 22,
						backgroundColor: "rgba(255,255,255,0.92)",
						paddingHorizontal: 14,
						alignItems: "center",
						justifyContent: "center",
					}}
				>
					<Text style={{ color: "#111111", fontSize: 12, fontWeight: "800" }}>
						Live
					</Text>
				</Pressable>
			) : null}
		</View>
	);
}
