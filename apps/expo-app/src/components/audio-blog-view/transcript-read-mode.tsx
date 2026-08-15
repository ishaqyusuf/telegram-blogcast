import { SelectableTranscriptSurface } from "@/components/audio-blog-view/selectable-transcript-surface";
import { useSyncedTranscript } from "@/components/audio-blog-view/use-synced-transcript";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";

import {
	type TranscriptDocument,
	type TranscriptSegmentData,
	type TranscriptTextSelection,
	buildTranscriptTextSelection,
	rebaseTranscriptTextSelection,
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
	const [followPaused, setFollowPaused] = useState(false);
	const previousDocumentRef = useRef(document);
	const { activeSegmentIndex, activeWordIndex } = useSyncedTranscript({
		segments: document.segments,
		positionSecOverride,
	});

	const previousDocument = previousDocumentRef.current;
	const surfaceSelection =
		previousDocument !== document && selection
			? rebaseTranscriptTextSelection(previousDocument, document, selection)
			: selection;

	useEffect(() => {
		previousDocumentRef.current = document;
		if (previousDocument === document || !selection) return;
		const rebased = surfaceSelection;
		if (
			rebased?.startOffset !== selection.startOffset ||
			rebased?.endOffset !== selection.endOffset ||
			rebased?.dragStartOffset !== selection.dragStartOffset
		) {
			onSelectionChange(rebased);
		}
	}, [
		document,
		onSelectionChange,
		previousDocument,
		selection,
		surfaceSelection,
	]);

	const handleSelectionChange = useCallback(
		(
			next: {
				startOffset: number;
				endOffset: number;
				dragStartOffset: number;
			} | null,
		) => {
			const resolved = next
				? buildTranscriptTextSelection(
						document,
						next.startOffset,
						next.endOffset,
						next.dragStartOffset,
					)
				: null;
			onSelectionChange(resolved);
			if (resolved && autoScroll) setFollowPaused(true);
		},
		[autoScroll, document, onSelectionChange],
	);

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

	const follow = autoScroll && !followPaused && !surfaceSelection;
	return (
		<View style={{ flex: 1, backgroundColor: "#080807" }}>
			<SelectableTranscriptSurface
				document={document}
				presentation="read"
				selectionEnabled
				contentPaddingVertical={120}
				activeSegmentIndex={activeSegmentIndex}
				activeWordIndex={activeWordIndex}
				follow={follow}
				selection={surfaceSelection}
				onSelectionChange={handleSelectionChange}
				onManualScroll={() => {
					if (autoScroll) setFollowPaused(true);
				}}
				onStartReached={onStartReached}
				onEndReached={onEndReached}
				onPressSegment={onPressSegment}
			/>
			{autoScroll && followPaused ? (
				<Pressable
					onPress={() => {
						onSelectionChange(null);
						setFollowPaused(false);
					}}
					accessibilityRole="button"
					accessibilityLabel="Return to live transcript position"
					style={{
						position: "absolute",
						right: 18,
						bottom: 18,
						minWidth: 44,
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
