import {
	type TranscriptSegmentData,
	getTranscriptSegmentKey,
} from "@/components/audio-blog-view/transcript-segments";
import { useAudioStore } from "@/store/audio-store";
import * as Haptics from "expo-haptics";
import React, { useEffect, useRef } from "react";
import { FlatList, Pressable, Text, View } from "react-native";

interface KaraokeTranscriptProps {
	segments: TranscriptSegmentData[];
	positionSecOverride?: number;
	autoScroll?: boolean;
	onSegmentLongPress?: (segment: TranscriptSegmentData) => void;
	selectable?: boolean;
}

export function KaraokeTranscript({
	segments,
	positionSecOverride,
	autoScroll = true,
	onSegmentLongPress,
	selectable = false,
}: KaraokeTranscriptProps) {
	const livePositionSec = useAudioStore((s) => s.position) / 1000;
	const positionSec = positionSecOverride ?? livePositionSec;
	const seek = useAudioStore((s) => s.seek);
	const flatListRef = useRef<FlatList>(null);

	const activeIdx = segments.findIndex(
		(s) => positionSec >= s.startSec && positionSec < s.endSec,
	);

	useEffect(() => {
		if (autoScroll && activeIdx !== -1 && segments.length > 0) {
			flatListRef.current?.scrollToIndex({
				index: activeIdx,
				animated: true,
				viewPosition: 0.5,
			});
		}
	}, [activeIdx, autoScroll, segments.length]);

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
		<FlatList
			ref={flatListRef}
			data={segments}
			keyExtractor={getTranscriptSegmentKey}
			showsVerticalScrollIndicator={false}
			contentContainerStyle={{
				paddingHorizontal: 24,
				paddingVertical: 120, // Add padding to allow scrolling past edges
				gap: 16,
			}}
			onScrollToIndexFailed={(info) => {
				const wait = new Promise((resolve) => setTimeout(resolve, 500));
				wait.then(() => {
					flatListRef.current?.scrollToIndex({
						index: info.index,
						animated: true,
						viewPosition: 0.5,
					});
				});
			}}
			renderItem={({ item: seg, index }) => {
				const isActive = index === activeIdx;

				return (
					<Pressable
						onPress={() => {
							Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
							seek(seg.startSec * 1000);
						}}
						onLongPress={() => onSegmentLongPress?.(seg)}
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
							{seg.words?.length
								? seg.words.map((word, wordIndex) => {
										const wordActive =
											positionSec >= word.startSec && positionSec < word.endSec;
										return (
											<Text
												key={`${word.startSec}-${wordIndex}`}
												selectable={selectable}
												style={{
													color: wordActive
														? "#ffffff"
														: isActive
															? "rgba(255,255,255,0.8)"
															: "rgba(255,255,255,0.4)",
													fontWeight: wordActive ? "900" : undefined,
												}}
											>
												{word.word}{" "}
											</Text>
										);
									})
								: seg.text}
						</Text>
					</Pressable>
				);
			}}
		/>
	);
}
