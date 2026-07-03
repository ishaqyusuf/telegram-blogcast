import { withAlpha } from "@/lib/theme";
import { useSyncedTranscript } from "@/components/audio-blog-view/use-synced-transcript";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
	ScrollView,
	Pressable,
	Text,
	TextInput,
	View,
	type NativeSyntheticEvent,
	type TextInputSelectionChangeEventData,
} from "react-native";

import {
	buildTranscriptTextSelection,
	type TranscriptDocument,
	type TranscriptTextSelection,
} from "@/components/audio-blog-view/transcript-timing";

type TranscriptReadModeProps = {
	document: TranscriptDocument;
	autoScroll?: boolean;
	positionSecOverride?: number;
	selection: TranscriptTextSelection | null;
	onSelectionChange: (selection: TranscriptTextSelection | null) => void;
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

function getVisibleDocumentSpans({
	document,
	activeSegmentIndex,
	activeWordIndex,
	selection,
}: {
	document: TranscriptDocument;
	activeSegmentIndex: number;
	activeWordIndex: number;
	selection: TranscriptTextSelection | null;
}) {
	const spans: VisibleSpan[] = [];
	const activeSegmentRange =
		activeSegmentIndex >= 0
			? document.segmentRanges[activeSegmentIndex]
			: undefined;
	const activeSegmentWordRanges =
		activeSegmentIndex >= 0
			? (document.wordRangesBySegment[activeSegmentIndex] ?? [])
			: [];
	const activeWordRange = activeSegmentWordRanges.find(
		(range) => range.wordIndex === activeWordIndex,
	);

	const pushSpan = (start: number, end: number) => {
		if (end <= start) return;
		const text = document.fullText.slice(start, end);
		if (!text) return;
		spans.push({
			key: `${start}:${end}`,
			text,
			isActiveSegment: intersects(start, end, activeSegmentRange),
			isActiveWord: intersects(start, end, activeWordRange),
			isSelected: intersects(start, end, selection),
		});
	};

	const boundaries = new Set([0, document.fullText.length]);

	for (const range of document.segmentRanges) {
		boundaries.add(range.startOffset);
		boundaries.add(range.endOffset);
	}

	if (activeSegmentRange) {
		for (const wordRange of activeSegmentWordRanges) {
			boundaries.add(wordRange.startOffset);
			boundaries.add(wordRange.endOffset);
		}
	}

	if (selection) {
		boundaries.add(selection.startOffset);
		boundaries.add(selection.endOffset);
	}

	const orderedBoundaries = [...boundaries].sort((a, b) => a - b);
	for (let index = 0; index < orderedBoundaries.length - 1; index += 1) {
		pushSpan(
			orderedBoundaries[index] ?? 0,
			orderedBoundaries[index + 1] ?? document.fullText.length,
		);
	}

	return spans;
}

export function TranscriptReadMode({
	document,
	autoScroll = true,
	positionSecOverride,
	selection,
	onSelectionChange,
}: TranscriptReadModeProps) {
	const scrollRef = useRef<ScrollView>(null);
	const collapsedDragStartOffsetRef = useRef<number | null>(null);
	const [contentHeight, setContentHeight] = useState(0);
	const [viewportHeight, setViewportHeight] = useState(0);
	const [followPaused, setFollowPaused] = useState(false);
	const { activeSegmentIndex, activeWordIndex } = useSyncedTranscript({
		segments: document.segments,
		positionSecOverride,
	});

	const spans = useMemo(
		() =>
			getVisibleDocumentSpans({
				document,
				activeSegmentIndex,
				activeWordIndex,
				selection,
			}),
		[activeSegmentIndex, activeWordIndex, document, selection],
	);

	const handleSelectionChange = useCallback(
		(event: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
			if (autoScroll) setFollowPaused(true);

			const { start, end } = event.nativeEvent.selection;

			if (end <= start) {
				collapsedDragStartOffsetRef.current = start;
				onSelectionChange(null);
				return;
			}

			onSelectionChange(
				buildTranscriptTextSelection(
					document,
					start,
					end,
					collapsedDragStartOffsetRef.current,
				),
			);
		},
		[autoScroll, document, onSelectionChange],
	);

	const getActiveSegmentScrollY = useCallback(() => {
		if (activeSegmentIndex < 0) return null;
		if (!contentHeight || !viewportHeight || !document.fullText.length) {
			return null;
		}

		const activeSegmentRange = document.segmentRanges[activeSegmentIndex];
		if (!activeSegmentRange) return null;

		const estimatedOffset =
			(activeSegmentRange.startOffset / document.fullText.length) * contentHeight;
		return Math.max(0, estimatedOffset - viewportHeight * 0.35);
	}, [
		activeSegmentIndex,
		contentHeight,
		document.fullText.length,
		document.segmentRanges,
		viewportHeight,
	]);

	const scrollToActiveSegment = useCallback(
		(animated: boolean) => {
			if (!autoScroll || followPaused) return;
			const y = getActiveSegmentScrollY();
			if (y == null) return;

			scrollRef.current?.scrollTo({
				y,
				animated,
			});
		},
		[autoScroll, followPaused, getActiveSegmentScrollY],
	);

	const resumeFollowing = useCallback(() => {
		setFollowPaused(false);
		requestAnimationFrame(() => {
			const y = getActiveSegmentScrollY();
			if (y == null) return;

			scrollRef.current?.scrollTo({
				y,
				animated: true,
			});
		});
	}, [getActiveSegmentScrollY]);

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
			<ScrollView
				ref={scrollRef}
				style={{ flex: 1 }}
				keyboardShouldPersistTaps="handled"
				showsVerticalScrollIndicator={false}
				contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 120 }}
				onLayout={(event) => {
					setViewportHeight(event.nativeEvent.layout.height);
				}}
				onContentSizeChange={(_width, height) => {
					setContentHeight(height);
				}}
				onScrollBeginDrag={() => {
					if (autoScroll) setFollowPaused(true);
				}}
			>
				<View style={{ position: "relative" }}>
					<Text
						style={{
							fontSize: 26,
							lineHeight: 40,
							textAlign: "right",
							writingDirection: "rtl",
							fontWeight: "600",
							color: "rgba(255,255,255,0.48)",
						}}
					>
						{spans.map((span) => (
							<Text
								key={span.key}
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

					<TextInput
						value={document.fullText}
						editable
						multiline
						scrollEnabled={false}
						showSoftInputOnFocus={false}
						caretHidden
						selectionColor={withAlpha("#ffffff", 0.28)}
						onChangeText={() => {}}
						onSelectionChange={handleSelectionChange}
						style={{
							position: "absolute",
							top: 0,
							right: 0,
							bottom: 0,
							left: 0,
							fontSize: 26,
							lineHeight: 40,
							textAlign: "right",
							writingDirection: "rtl",
							color: "rgba(255,255,255,0.01)",
							padding: 0,
							margin: 0,
							backgroundColor: "transparent",
						}}
					/>
				</View>
			</ScrollView>
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
