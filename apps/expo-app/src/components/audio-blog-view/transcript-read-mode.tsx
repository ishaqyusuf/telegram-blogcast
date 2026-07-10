import { withAlpha } from "@/lib/theme";
import { useSyncedTranscript } from "@/components/audio-blog-view/use-synced-transcript";
import React, { memo, useCallback, useMemo, useRef, useState } from "react";
import {
	FlatList,
	Pressable,
	Text,
	View,
	type NativeScrollEvent,
	type NativeSyntheticEvent,
} from "react-native";

import {
	selectTranscriptSegment,
	type TranscriptDocument,
	type TranscriptSegmentData,
	type TranscriptSegmentRange,
	type TranscriptTextSelection,
} from "@/components/audio-blog-view/transcript-timing";

type TranscriptReadModeProps = {
	document: TranscriptDocument;
	autoScroll?: boolean;
	positionSecOverride?: number;
	selection: TranscriptTextSelection | null;
	onSelectionChange: (selection: TranscriptTextSelection | null) => void;
	onStartReached?: () => void;
	onEndReached?: () => void;
	onPressSegment?: (
		segment: TranscriptSegmentData,
		index: number,
		shouldPlay: boolean,
	) => void;
};

type VisibleSpan = {
	key: string;
	text: string;
	isActiveSegment: boolean;
	isActiveWord: boolean;
	isSelected: boolean;
};

function intersects(
	startOffset: number,
	endOffset: number,
	range?: { startOffset: number; endOffset: number } | null,
) {
	return Boolean(
		range && startOffset < range.endOffset && endOffset > range.startOffset,
	);
}

function getVisibleSegmentSpans({
	document,
	segmentRange,
	activeSegmentIndex,
	activeWordIndex,
	selection,
}: {
	document: TranscriptDocument;
	segmentRange: TranscriptSegmentRange;
	activeSegmentIndex: number;
	activeWordIndex: number;
	selection: TranscriptTextSelection | null;
}) {
	const spans: VisibleSpan[] = [];
	const isActiveSegment = segmentRange.index === activeSegmentIndex;
	const activeSegmentWordRanges = isActiveSegment
		? (document.wordRangesBySegment[segmentRange.index] ?? [])
		: [];
	const activeWordRange = activeSegmentWordRanges.find(
		(range) => range.wordIndex === activeWordIndex,
	);
	const boundaries = new Set([segmentRange.startOffset, segmentRange.endOffset]);

	if (activeWordRange) {
		boundaries.add(activeWordRange.startOffset);
		boundaries.add(activeWordRange.endOffset);
	}

	if (selection && intersects(segmentRange.startOffset, segmentRange.endOffset, selection)) {
		boundaries.add(Math.max(segmentRange.startOffset, selection.startOffset));
		boundaries.add(Math.min(segmentRange.endOffset, selection.endOffset));
	}

	const orderedBoundaries = [...boundaries].sort((a, b) => a - b);
	for (let index = 0; index < orderedBoundaries.length - 1; index += 1) {
		const start = orderedBoundaries[index] ?? segmentRange.startOffset;
		const end = orderedBoundaries[index + 1] ?? segmentRange.endOffset;
		if (end <= start) continue;
		const text = document.fullText.slice(start, end);
		if (!text) continue;
		spans.push({
			key: `${segmentRange.index}:${start}:${end}`,
			text,
			isActiveSegment,
			isActiveWord: intersects(start, end, activeWordRange),
			isSelected: intersects(start, end, selection),
		});
	}

	return spans;
}

const TranscriptReadRow = memo(function TranscriptReadRow({
	document,
	segmentRange,
	activeSegmentIndex,
	activeWordIndex,
	selection,
	onSelectSegment,
	onPressSegment,
}: {
	document: TranscriptDocument;
	segmentRange: TranscriptSegmentRange;
	activeSegmentIndex: number;
	activeWordIndex: number;
	selection: TranscriptTextSelection | null;
	onSelectSegment: (segmentRange: TranscriptSegmentRange) => void;
	onPressSegment: (segmentRange: TranscriptSegmentRange) => void;
}) {
	const spans = useMemo(
		() =>
			getVisibleSegmentSpans({
				document,
				segmentRange,
				activeSegmentIndex,
				activeWordIndex,
				selection,
			}),
		[activeSegmentIndex, activeWordIndex, document, segmentRange, selection],
	);

	return (
		<Pressable
			onPress={() => onPressSegment(segmentRange)}
			onLongPress={() => onSelectSegment(segmentRange)}
			style={{ paddingVertical: 9 }}
		>
			<Text
				selectable
				style={{
					fontSize: 26,
					lineHeight: 40,
					textAlign: "right",
					writingDirection: "rtl",
					fontWeight: segmentRange.index === activeSegmentIndex ? "700" : "600",
					color:
						segmentRange.index === activeSegmentIndex
							? "rgba(255,255,255,0.86)"
							: "rgba(255,255,255,0.48)",
				}}
			>
				{spans.map((span) => (
					<Text
						key={span.key}
						selectable
						style={{
							backgroundColor: span.isSelected
								? withAlpha("#ffffff", 0.18)
								: "transparent",
							color: span.isActiveWord
								? "#ffffff"
								: span.isActiveSegment
									? "rgba(255,255,255,0.86)"
									: "rgba(255,255,255,0.48)",
							fontWeight: span.isActiveWord ? "900" : undefined,
						}}
					>
						{span.text}
					</Text>
				))}
			</Text>
		</Pressable>
	);
});

export function TranscriptReadMode({
	document,
	autoScroll = true,
	positionSecOverride,
	selection,
	onSelectionChange,
	onStartReached,
	onEndReached,
	onPressSegment,
}: TranscriptReadModeProps) {
	const listRef = useRef<FlatList<TranscriptSegmentRange>>(null);
	const [followPaused, setFollowPaused] = useState(false);
	const lastSegmentTapRef = useRef<{ index: number; at: number } | null>(null);
	const { activeSegmentIndex, activeWordIndex } = useSyncedTranscript({
		segments: document.segments,
		positionSecOverride,
	});

	const scrollToActiveSegment = useCallback(
		(animated: boolean, options?: { force?: boolean }) => {
			if (
				!autoScroll ||
				(!options?.force && followPaused) ||
				activeSegmentIndex < 0
			) {
				return;
			}
			if (activeSegmentIndex >= document.segmentRanges.length) return;

			listRef.current?.scrollToIndex({
				index: activeSegmentIndex,
				animated,
				viewPosition: 0.35,
			});
		},
		[activeSegmentIndex, autoScroll, document.segmentRanges.length, followPaused],
	);

	const resumeFollowing = useCallback(() => {
		setFollowPaused(false);
		requestAnimationFrame(() => {
			scrollToActiveSegment(true, { force: true });
		});
	}, [scrollToActiveSegment]);

	const handleSelectSegment = useCallback(
		(segmentRange: TranscriptSegmentRange) => {
			onSelectionChange(selectTranscriptSegment(document, segmentRange.segment));
			if (autoScroll) setFollowPaused(true);
		},
		[autoScroll, document, onSelectionChange],
	);

	const handlePressSegment = useCallback(
		(segmentRange: TranscriptSegmentRange) => {
			const now = Date.now();
			const lastTap = lastSegmentTapRef.current;
			lastSegmentTapRef.current = { index: segmentRange.index, at: now };
			const shouldPlay =
				lastTap?.index === segmentRange.index && now - lastTap.at < 320;
			onPressSegment?.(segmentRange.segment, segmentRange.index, shouldPlay);
		},
		[onPressSegment],
	);

	const handleScroll = useCallback(
		(event: NativeSyntheticEvent<NativeScrollEvent>) => {
			if (event.nativeEvent.contentOffset.y < 140) {
				onStartReached?.();
			}
		},
		[onStartReached],
	);

	React.useEffect(() => {
		scrollToActiveSegment(true);
	}, [scrollToActiveSegment]);

	React.useEffect(() => {
		setFollowPaused(false);
	}, [document]);

	if (!document.fullText || !document.segmentRanges.length) {
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
				ref={listRef}
				data={document.segmentRanges}
				keyExtractor={(item) =>
					[
						item.segment.id ?? "segment",
						item.index,
						item.segment.startSec,
						item.segment.endSec,
					].join(":")
				}
				showsVerticalScrollIndicator={false}
				keyboardShouldPersistTaps="handled"
				contentContainerStyle={{
					paddingHorizontal: 24,
					paddingVertical: 120,
				}}
				initialNumToRender={16}
				maxToRenderPerBatch={10}
				windowSize={7}
				removeClippedSubviews
				onScrollBeginDrag={() => {
					if (autoScroll) setFollowPaused(true);
				}}
				onScroll={handleScroll}
				scrollEventThrottle={16}
				onEndReached={onEndReached}
				onEndReachedThreshold={0.45}
				onScrollToIndexFailed={(info) => {
					listRef.current?.scrollToOffset({
						offset: Math.max(0, info.averageItemLength * info.index),
						animated: false,
					});
					setTimeout(() => scrollToActiveSegment(true), 80);
				}}
				renderItem={({ item }) => (
					<TranscriptReadRow
						document={document}
						segmentRange={item}
						activeSegmentIndex={activeSegmentIndex}
						activeWordIndex={activeWordIndex}
						selection={selection}
						onSelectSegment={handleSelectSegment}
						onPressSegment={handlePressSegment}
					/>
				)}
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
