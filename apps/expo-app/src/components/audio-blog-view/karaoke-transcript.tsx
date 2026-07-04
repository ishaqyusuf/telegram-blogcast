import {
	type TranscriptSegmentData,
	getTranscriptSegmentKey,
} from "@/components/audio-blog-view/transcript-segments";
import { useSyncedTranscript } from "@/components/audio-blog-view/use-synced-transcript";
import { useAudioStore } from "@/store/audio-store";
import * as Haptics from "expo-haptics";
import React, {
	memo,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import {
	FlatList,
	type LayoutChangeEvent,
	Pressable,
	Text,
	View,
} from "react-native";

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
	segment: TranscriptSegmentData;
	index: number;
	isActive: boolean;
	activeWordIndex: number;
	selectable: boolean;
	onPressSegment: (segment: TranscriptSegmentData, index: number) => void;
	onLongPressSegment?: (segment: TranscriptSegmentData) => void;
	onRowLayout: (index: number, event: LayoutChangeEvent) => void;
};

const TranscriptRow = memo(function TranscriptRow({
	segment,
	index,
	isActive,
	activeWordIndex,
	selectable,
	onPressSegment,
	onLongPressSegment,
	onRowLayout,
}: TranscriptRowProps) {
	return (
		<Pressable
			onPress={() => onPressSegment(segment, index)}
			onLongPress={() => onLongPressSegment?.(segment)}
			onLayout={(event) => onRowLayout(index, event)}
		>
			<Text
				selectable={selectable}
				style={{
					fontSize: 28,
					lineHeight: 40,
					textAlign: "right",
					writingDirection: "rtl",
					fontWeight: isActive ? "800" : "600",
					color: isActive ? "#ffffff" : "rgba(255, 255, 255, 0.4)",
				}}
			>
				{isActive && segment.words?.length
					? segment.words.map((word, wordIndex) => {
							const wordActive = wordIndex === activeWordIndex;
							return (
								<Text
									key={`${word.startSec}-${wordIndex}`}
									selectable={selectable}
									style={{
										color: wordActive ? "#ffffff" : "rgba(255,255,255,0.8)",
										fontWeight: wordActive ? "900" : undefined,
									}}
								>
									{word.word}{" "}
								</Text>
							);
						})
					: segment.text}
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
	const flatListRef = useRef<FlatList>(null);
	const lastTapRef = useRef<{ key: string; at: number } | null>(null);
	const rowMetricsRef = useRef(
		new Map<number, { y: number; height: number }>(),
	);
	const viewportHeightRef = useRef(0);
	const [followPaused, setFollowPaused] = useState(false);
	const { activeSegmentIndex: activeIdx, activeWordIndex: activeWordIdx } =
		useSyncedTranscript({ segments, positionSecOverride });
	const segmentMetricsResetKey = useMemo(
		() =>
			segments
				.map((segment, index) => getTranscriptSegmentKey(segment, index))
				.join("|"),
		[segments],
	);

	const scrollToActiveSegment = useCallback(
		(animated: boolean) => {
			if (activeIdx < 0 || !segments.length) return;

			const metrics = rowMetricsRef.current.get(activeIdx);
			const viewportHeight = viewportHeightRef.current;
			if (metrics && viewportHeight > 0) {
				flatListRef.current?.scrollToOffset({
					offset: Math.max(
						0,
						metrics.y - viewportHeight * 0.5 + metrics.height * 0.5,
					),
					animated,
				});
				return;
			}

			flatListRef.current?.scrollToIndex({
				index: activeIdx,
				animated,
				viewPosition: 0.5,
			});
		},
		[activeIdx, segments.length],
	);

	const resumeFollowing = useCallback(() => {
		setFollowPaused(false);
		scrollToActiveSegment(true);
	}, [scrollToActiveSegment]);

	const handleRowLayout = useCallback(
		(index: number, event: LayoutChangeEvent) => {
			rowMetricsRef.current.set(index, {
				y: event.nativeEvent.layout.y,
				height: event.nativeEvent.layout.height,
			});
		},
		[],
	);

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
		({ item, index }: { item: TranscriptSegmentData; index: number }) => (
			<TranscriptRow
				segment={item}
				index={index}
				isActive={index === activeIdx}
				activeWordIndex={index === activeIdx ? activeWordIdx : -1}
				selectable={selectable}
				onPressSegment={handlePressSegment}
				onLongPressSegment={onSegmentLongPress}
				onRowLayout={handleRowLayout}
			/>
		),
		[
			activeIdx,
			activeWordIdx,
			handlePressSegment,
			handleRowLayout,
			onSegmentLongPress,
			selectable,
		],
	);

	useEffect(() => {
		if (autoScroll && !followPaused) {
			scrollToActiveSegment(true);
		}
	}, [autoScroll, followPaused, scrollToActiveSegment]);

	useEffect(() => {
		if (segmentMetricsResetKey.length < 0) return;
		rowMetricsRef.current.clear();
		setFollowPaused(false);
	}, [segmentMetricsResetKey]);

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
			<FlatList
				ref={flatListRef}
				data={segments}
				keyExtractor={getTranscriptSegmentKey}
				extraData={`${activeIdx}:${activeWordIdx}:${selectable ? 1 : 0}`}
				showsVerticalScrollIndicator={false}
				contentContainerStyle={{
					paddingHorizontal: 24,
					paddingVertical: contentPaddingVertical,
					gap: 16,
				}}
				initialNumToRender={18}
				maxToRenderPerBatch={12}
				windowSize={7}
				removeClippedSubviews
				onLayout={(event) => {
					viewportHeightRef.current = event.nativeEvent.layout.height;
				}}
				onScrollBeginDrag={() => {
					if (autoScroll) setFollowPaused(true);
				}}
				onScrollToIndexFailed={(info) => {
					flatListRef.current?.scrollToOffset({
						offset: Math.max(0, info.averageItemLength * info.index),
						animated: false,
					});
					setTimeout(() => {
						scrollToActiveSegment(true);
					}, 80);
				}}
				renderItem={renderItem}
			/>
			{autoScroll && followPaused ? (
				<Pressable
					onPress={resumeFollowing}
					style={{
						position: "absolute",
						right: 18,
						bottom: 18,
						minHeight: 36,
						borderRadius: 18,
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
