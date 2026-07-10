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

type WindowedTranscriptSegment = {
	segment: TranscriptSegmentData;
	absoluteIndex: number;
};

const KARAOKE_WINDOW_BEFORE = 80;
const KARAOKE_WINDOW_AFTER = 120;
const KARAOKE_CHUNK_SIZE = 80;
const KARAOKE_WINDOW_EDGE_THRESHOLD = 24;

function getKaraokeWindowForIndex(index: number, total: number) {
	if (total <= 0) return { start: 0, end: 0 };
	const safeIndex = Math.min(Math.max(index, 0), total - 1);
	return {
		start: Math.max(0, safeIndex - KARAOKE_WINDOW_BEFORE),
		end: Math.min(total, safeIndex + KARAOKE_WINDOW_AFTER + 1),
	};
}

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
	const flatListRef = useRef<FlatList<WindowedTranscriptSegment>>(null);
	const lastTapRef = useRef<{ key: string; at: number } | null>(null);
	const rowMetricsRef = useRef(
		new Map<number, { y: number; height: number }>(),
	);
	const viewportHeightRef = useRef(0);
	const [followPaused, setFollowPaused] = useState(false);
	const { activeSegmentIndex: activeIdx, activeWordIndex: activeWordIdx } =
		useSyncedTranscript({ segments, positionSecOverride });
	const activeIdxRef = useRef(activeIdx);
	activeIdxRef.current = activeIdx;
	const [visibleRange, setVisibleRange] = useState(() =>
		getKaraokeWindowForIndex(0, segments.length),
	);
	const windowedSegments = useMemo<WindowedTranscriptSegment[]>(
		() =>
			segments
				.slice(visibleRange.start, visibleRange.end)
				.map((segment, offset) => ({
					segment,
					absoluteIndex: visibleRange.start + offset,
				})),
		[segments, visibleRange.end, visibleRange.start],
	);
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
			const localActiveIndex = activeIdx - visibleRange.start;
			if (localActiveIndex < 0 || localActiveIndex >= windowedSegments.length) {
				return;
			}

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
				index: localActiveIndex,
				animated,
				viewPosition: 0.5,
			});
		},
		[activeIdx, segments.length, visibleRange.start, windowedSegments.length],
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
		({ item }: { item: WindowedTranscriptSegment; index: number }) => (
			<TranscriptRow
				segment={item.segment}
				index={item.absoluteIndex}
				isActive={item.absoluteIndex === activeIdx}
				activeWordIndex={item.absoluteIndex === activeIdx ? activeWordIdx : -1}
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
		if (activeIdx < 0 || !segments.length) return;
		if (followPaused) return;
		setVisibleRange((current) => {
			const activeTooCloseToTop =
				activeIdx < current.start + KARAOKE_WINDOW_EDGE_THRESHOLD;
			const activeTooCloseToBottom =
				activeIdx >= current.end - KARAOKE_WINDOW_EDGE_THRESHOLD;
			if (!activeTooCloseToTop && !activeTooCloseToBottom) return current;
			return getKaraokeWindowForIndex(activeIdx, segments.length);
		});
	}, [activeIdx, followPaused, segments.length]);

	useEffect(() => {
		rowMetricsRef.current.clear();
		setVisibleRange(
			getKaraokeWindowForIndex(Math.max(activeIdxRef.current, 0), segments.length),
		);
		setFollowPaused(false);
	}, [segmentMetricsResetKey, segments.length]);

	useEffect(() => {
		if (!autoScroll || followPaused) return;
		const timeout = setTimeout(() => {
			scrollToActiveSegment(true);
		}, 40);
		return () => clearTimeout(timeout);
	}, [
		autoScroll,
		followPaused,
		scrollToActiveSegment,
		visibleRange.end,
		visibleRange.start,
	]);

	const loadPreviousChunk = useCallback(() => {
		setVisibleRange((current) => {
			if (current.start <= 0) return current;
			return {
				start: Math.max(0, current.start - KARAOKE_CHUNK_SIZE),
				end: current.end,
			};
		});
	}, []);

	const loadNextChunk = useCallback(() => {
		setVisibleRange((current) => {
			if (current.end >= segments.length) return current;
			return {
				start: current.start,
				end: Math.min(segments.length, current.end + KARAOKE_CHUNK_SIZE),
			};
		});
	}, [segments.length]);

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
				data={windowedSegments}
				keyExtractor={(item) =>
					getTranscriptSegmentKey(item.segment, item.absoluteIndex)
				}
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
				maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
				onEndReached={loadNextChunk}
				onEndReachedThreshold={0.35}
				onScroll={(event) => {
					if (event.nativeEvent.contentOffset.y < 220) {
						loadPreviousChunk();
					}
				}}
				scrollEventThrottle={16}
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
