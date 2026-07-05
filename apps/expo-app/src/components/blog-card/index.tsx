import { Pressable } from "@/components/ui/pressable";
import {
	SwipeDeleteAction,
	getSwipeDeleteThreshold,
} from "@/components/ui/swipe-delete-action";
import { useRouter } from "expo-router";
import { useCallback, useMemo, useRef } from "react";
import { useWindowDimensions } from "react-native";
import ReanimatedSwipeable, {
	SwipeDirection,
} from "react-native-gesture-handler/ReanimatedSwipeable";
import Animated, {
	Easing,
	Extrapolation,
	interpolate,
	runOnJS,
	useAnimatedStyle,
	useSharedValue,
	withTiming,
	type SharedValue,
} from "react-native-reanimated";

import { useColors } from "@/hooks/use-color";
import { useRecentlyViewedStore } from "@/store/recently-viewed-store";

import { getAudioDisplayTitle } from "@/lib/audio-title";
import { CardFooter } from "./card-footer";
import { CardHeader } from "./card-header";
import { CardMedia } from "./card-media";
import { TranscriptPreview } from "./transcript-preview";
import type { BlogItem } from "./types";
import { getBlogHref, getInlinePreviewText, resolveVariant } from "./utils";

export type { BlogItem } from "./types";

export function BlogCard({
	post,
	onDelete,
	onAddToAlbum,
	onPress,
	hideChannelName,
}: {
	post: BlogItem;
	onDelete?: (post: BlogItem) => Promise<void> | void;
	onAddToAlbum?: (post: BlogItem) => void;
	onPress?: (post: BlogItem) => void;
	hideChannelName?: boolean;
}) {
	const router = useRouter();
	const { width } = useWindowDimensions();
	const markViewed = useRecentlyViewedStore((state) => state.markViewed);
	const colors = useColors();
	const swipeRef = useRef<any>(null);
	const isDeletingRef = useRef(false);
	const rowHeight = useSharedValue(0);
	const deleteProgress = useSharedValue(0);
	const variant = resolveVariant(post);
	const href = getBlogHref(post);
	const fullSwipeThreshold = useMemo(
		() => getSwipeDeleteThreshold(width),
		[width],
	);

	const handlePress = () => {
		if (onPress) {
			onPress(post);
			return;
		}
		markViewed({
			id: post.id,
			title: getAudioDisplayTitle(post, "Untitled"),
			type: post.type ?? "text",
			date: post.date ? post.date.toISOString() : null,
		});
		router.push(href as any);
	};

	const handleOpenOptions = useCallback(() => {
		const audio = post.audio as any;
		const optionsTitle =
			getInlinePreviewText(post.caption) ||
			getInlinePreviewText(post.content) ||
			getAudioDisplayTitle(post, "") ||
			`Post #${post.id}`;
		router.push({
			pathname: "/blog-options/[blogId]",
			params: {
				blogId: String(post.id),
				type: post.type ?? variant,
				title:
					optionsTitle.length > 120
						? `${optionsTitle.slice(0, 117)}...`
						: optionsTitle,
				audioMediaId: audio?.mediaId ? String(audio.mediaId) : "",
				audioTelegramFileId: post.audio?.telegramFileId ?? "",
				audioUrl: audio?.url ?? "",
				audioIsTranscribed: audio?.isTranscribed ? "1" : "",
				audioTranscriptStatus: audio?.transcriptStatus ?? "",
				audioTranscriptionJobStatus: audio?.transcriptionJobStatus ?? "",
			},
		} as any);
	}, [post, router, variant]);

	const finishDelete = useCallback(async () => {
		try {
			await onDelete?.(post);
		} finally {
			isDeletingRef.current = false;
		}
	}, [onDelete, post]);

	const handleSwipeWillOpen = async (direction: SwipeDirection) => {
		if (!onDelete || direction !== SwipeDirection.LEFT || isDeletingRef.current)
			return;

		isDeletingRef.current = true;
		deleteProgress.value = withTiming(
			1,
			{ duration: 260, easing: Easing.out(Easing.cubic) },
			(finished) => {
				if (finished) {
					runOnJS(finishDelete)();
				}
			},
		);
	};

	const containerStyle = useAnimatedStyle(() => {
		const measuredHeight = rowHeight.value;
		const height =
			measuredHeight > 0
				? interpolate(
						deleteProgress.value,
						[0, 1],
						[measuredHeight, 0],
						Extrapolation.CLAMP,
					)
				: undefined;

		return {
			height,
			opacity: interpolate(
				deleteProgress.value,
				[0, 0.7, 1],
				[1, 0.35, 0],
				Extrapolation.CLAMP,
			),
			overflow: "hidden",
			transform: [
				{
					translateX: interpolate(
						deleteProgress.value,
						[0, 1],
						[0, -Math.min(width * 0.18, 72)],
						Extrapolation.CLAMP,
					),
				},
				{
					scale: interpolate(
						deleteProgress.value,
						[0, 1],
						[1, 0.98],
						Extrapolation.CLAMP,
					),
				},
			],
		};
	});

	const renderRightActions = useCallback(
		(progress: SharedValue<number>, translation: SharedValue<number>) => (
			<SwipeDeleteAction
				progress={progress}
				translation={translation}
				actionWidth={width}
				fullSwipeThreshold={fullSwipeThreshold}
			/>
		),
		[fullSwipeThreshold, width],
	);

	return (
		<Animated.View
			onLayout={(event) => {
				if (!isDeletingRef.current) {
					rowHeight.value = event.nativeEvent.layout.height;
				}
			}}
			style={containerStyle}
		>
			<ReanimatedSwipeable
				ref={swipeRef}
				enabled={Boolean(onDelete)}
				friction={1.15}
				overshootFriction={8}
				overshootRight={false}
				rightThreshold={fullSwipeThreshold}
				onSwipeableWillOpen={handleSwipeWillOpen}
				renderRightActions={renderRightActions}
			>
				<Pressable
					disabled={isDeletingRef.current}
					onPress={handlePress}
					className="border-b border-border bg-background px-4 py-4 active:bg-muted/40"
					style={{
						backgroundColor: colors.background,
						borderBottomColor: colors.border,
					}}
				>
					<CardHeader
						post={post}
						variant={variant}
						onOpenOptions={handleOpenOptions}
						hideChannelName={hideChannelName}
					/>
					<CardMedia post={post} variant={variant} />
					<TranscriptPreview post={post} />
					<CardFooter post={post} onAddToAlbum={onAddToAlbum} />
				</Pressable>
			</ReanimatedSwipeable>
		</Animated.View>
	);
}
