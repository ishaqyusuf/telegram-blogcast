import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	Alert,
	Animated,
	LayoutAnimation,
	Modal,
	Platform,
	Pressable,
	Text,
	UIManager,
	View,
} from "react-native";
import { LegendList } from "@legendapp/list";
import { useMutation } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";

import { BlogCard } from "@/components/blog-card";
import { AddToAlbumModal } from "@/components/channel-chat/add-to-album-modal";
import { BlogHomeAlbums } from "@/components/blog-home/blog-home-albums";
import { BlogHomeAnalytics } from "@/components/blog-home/blog-home-analytics";
import { BlogHomeBooks } from "@/components/blog-home/blog-home-books";
import { BlogHomeBooksCta } from "@/components/blog-home/blog-home-books-cta";
import type { BlogItem } from "@/components/blog-card";
import {
	BlogCategory,
	BlogHomeCategoryTabs,
} from "@/components/blog-home/blog-home-category-tabs";
import { BlogHomeChannels } from "@/components/blog-home/blog-home-channels";
import { BlogHomeFab } from "@/components/blog-home/blog-home-fab";
import { BlogHomeHeader } from "@/components/blog-home/blog-home-header";
import { BlogHomeRecentlyPlayed } from "@/components/blog-home/blog-home-recently-played";
import { useInfiniteLoader } from "@/components/infinite-loader";
import { SafeArea } from "@/components/safe-area";
import { _trpc } from "@/components/static-trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollToTopButton } from "@/components/ui/scroll-to-top-button";
import { Toast } from "@/components/ui/toast";
import { invalidateQueries } from "@/lib/trpc";
import { updateBlogPostByMediaIdInCache } from "@/lib/blog-post-cache";
import { useTranslation } from "@/lib/i18n";
import { useColors } from "@/hooks/use-color";
import { useScrollChrome } from "@/hooks/use-scroll-chrome";
import { useGlobalAudioBarStore } from "@/store/global-audio-bar-store";

if (
	Platform.OS === "android" &&
	UIManager.setLayoutAnimationEnabledExperimental
) {
	UIManager.setLayoutAnimationEnabledExperimental(true);
}

const AUDIO_BAR_SCROLL_HIDE_THRESHOLD = 28;
const AUDIO_BAR_SCROLL_SHOW_THRESHOLD = -18;
const HOME_HEADER_ANIMATION_DURATION = 180;
const CATEGORY_TABS_PIN_HYSTERESIS = 8;

function animatePostListChange() {
	LayoutAnimation.configureNext({
		duration: 220,
		create: {
			type: LayoutAnimation.Types.easeInEaseOut,
			property: LayoutAnimation.Properties.opacity,
		},
		update: {
			type: LayoutAnimation.Types.easeInEaseOut,
		},
		delete: {
			type: LayoutAnimation.Types.easeInEaseOut,
			property: LayoutAnimation.Properties.opacity,
		},
	});
}

export function BlogHomeSkeleton() {
	const colors = useColors();

	return (
		<View
			className="flex-1 bg-background"
			style={{ backgroundColor: colors.background }}
		>
			<SafeArea>
				<BlogHomeHeader />
				<View className="flex-1 relative">
					<View className="px-4">
						<BlogHomeCategoryTabs selected="All" onSelect={() => undefined} />
					</View>
					<View className="h-4" />
					<View className="flex-1 border-t border-border">
						{[0, 1, 2].map((key) => (
							<View
								key={key}
								className="border-b border-border bg-background p-4"
								style={{
									backgroundColor: colors.background,
									borderBottomColor: colors.border,
								}}
							>
								<View className="mb-3 flex-row items-center gap-3">
									<Skeleton className="h-10 w-10 rounded-full" />
									<View className="flex-1 gap-2">
										<Skeleton className="h-4 w-2/5 rounded-md" />
										<Skeleton className="h-3 w-1/4 rounded-md" />
									</View>
								</View>
								<Skeleton className="h-5 w-3/4 rounded-md" />
								<Skeleton className="mt-3 h-4 w-full rounded-md" />
								<Skeleton className="mt-2 h-4 w-4/5 rounded-md" />
								<Skeleton className="mt-4 h-48 w-full rounded-xl" />
							</View>
						))}
					</View>
					<BlogHomeFab />
				</View>
			</SafeArea>
		</View>
	);
}

export default function BlogHomeScreen() {
	const router = useRouter();
	const params = useLocalSearchParams<{ category?: string }>();
	const { t } = useTranslation();
	const colors = useColors();
	const feedScroll = useScrollChrome<any>();
	const setGlobalAudioBarScrollHidden = useGlobalAudioBarStore(
		(s) => s.setScrollHidden,
	);
	const setGlobalAudioBarHidden = useGlobalAudioBarStore((s) => s.setHidden);
	const lastScrollYRef = useRef(0);
	const scrollDeltaAccumulatorRef = useRef(0);
	const audioBarScrollHiddenRef = useRef(false);
	const homeHeaderHiddenRef = useRef(false);
	const isFeedDragActiveRef = useRef(false);
	const pendingHomeHeaderHiddenRef = useRef<boolean | null>(null);
	const categoryTabsPinnedRef = useRef(false);
	const headerCollapseProgress = useRef(new Animated.Value(1)).current;
	const previousGlobalAudioHiddenRef = useRef<boolean | null>(null);
	const [homeHeaderHeight, setHomeHeaderHeight] = useState(0);
	const [categoryTabsOffsetY, setCategoryTabsOffsetY] = useState<
		number | null
	>(null);
	const [categoryTabsPinned, setCategoryTabsPinned] = useState(false);

	const selectedCategory = useMemo<BlogCategory>(() => {
		const map: Record<string, BlogCategory> = {
			all: "All",
			audio: "Audio",
			text: "Text",
			pdf: "Pdf",
			picture: "Picture",
			video: "Video",
			likes: "Likes",
			saved: "Saved",
		};
		return map[(params.category || "all").toLowerCase()] ?? "All";
	}, [params.category]);

	const category = useMemo(() => {
		const map: Record<
			BlogCategory,
			"all" | "audio" | "text" | "pdf" | "picture" | "video" | "likes" | "saved"
		> = {
			All: "all",
			Audio: "audio",
			Text: "text",
			Pdf: "pdf",
			Picture: "picture",
			Video: "video",
			Likes: "likes",
			Saved: "saved",
		};
		return map[selectedCategory];
	}, [selectedCategory]);

	const onSelectCategory = (value: BlogCategory) => {
		const map: Record<
			BlogCategory,
			"all" | "audio" | "text" | "pdf" | "picture" | "video" | "likes" | "saved"
		> = {
			All: "all",
			Audio: "audio",
			Text: "text",
			Pdf: "pdf",
			Picture: "picture",
			Video: "video",
			Likes: "likes",
			Saved: "saved",
		};
		router.setParams({ category: map[value] });
	};

	const {
		data: posts,
		hasNextPage,
		isFetching,
		isRefetching,
		fetchNextPage,
		refetch,
	} = useInfiniteLoader({
		filter: {
			category,
		},
		route: _trpc?.blog.posts,
	});
	const [hiddenPostIds, setHiddenPostIds] = useState<Set<number>>(new Set());
	const [isPullRefreshing, setIsPullRefreshing] = useState(false);
	const [showAlbumModal, setShowAlbumModal] = useState(false);
	const [albumMediaIds, setAlbumMediaIds] = useState<number[]>([]);
	const [albumAuthorId, setAlbumAuthorId] = useState<number | undefined>();
	const deleteBlogMutation = useMutation(
		_trpc.blog.deleteBlog.mutationOptions({
			onSettled: () => {
				invalidateQueries("infinite", ["blog.posts"]);
			},
		}),
	);
	const restoreBlogMutation = useMutation(
		_trpc.blog.restoreBlog.mutationOptions({
			onSettled: () => {
				invalidateQueries("infinite", ["blog.posts"]);
			},
		}),
	);
	const rawVisiblePosts = useMemo(
		() => posts.filter((post) => !hiddenPostIds.has(post.id)),
		[posts, hiddenPostIds],
	);
	const visiblePosts = useMemo(() => {
		const grouped = new Map<string, BlogItem>();
		const output: BlogItem[] = [];

		for (const post of rawVisiblePosts) {
			const albumId = post.audio?.albumId;
			if (!albumId) {
				output.push(post);
				continue;
			}

			const key = `album:${albumId}`;
			const existing = grouped.get(key);
			const postTime = post.date ? new Date(post.date).getTime() : 0;
			const existingTime = existing?.date ? new Date(existing.date).getTime() : 0;

			if (!existing) {
				grouped.set(key, post);
				output.push(post);
				continue;
			}

			if (postTime > existingTime) {
				grouped.set(key, post);
				const index = output.findIndex((item) => item.id === existing.id);
				if (index >= 0) output[index] = post;
			}
		}

		return output;
	}, [rawVisiblePosts]);
	const isFetchingMore = isFetching && !isRefetching && !isPullRefreshing;
	const handleDeletePost = useCallback(
		async (post: BlogItem) => {
			setHiddenPostIds((prev) => new Set(prev).add(post.id));
			let deleteFailed = false;
			const deletePromise = deleteBlogMutation
				.mutateAsync({ id: post.id })
				.catch((error) => {
					deleteFailed = true;
					throw error;
				});
			let didRestore = false;

			const restorePost = async () => {
				if (didRestore) return;

				didRestore = true;
				animatePostListChange();
				setHiddenPostIds((prev) => {
					const next = new Set(prev);
					next.delete(post.id);
					return next;
				});

				try {
					await deletePromise;
					await restoreBlogMutation.mutateAsync({ id: post.id });
				} catch {
					if (deleteFailed) {
						animatePostListChange();
						setHiddenPostIds((prev) => {
							const next = new Set(prev);
							next.delete(post.id);
							return next;
						});
						return;
					}

					animatePostListChange();
					setHiddenPostIds((prev) => new Set(prev).add(post.id));
					Alert.alert("Undo failed", "Could not restore this post. Try again.");
				}
			};

			const toastId = Toast.show("Post deleted", {
				action: {
					label: "Undo",
					onPress: () => {
						void restorePost();
					},
				},
				duration: 5000,
				position: "bottom",
				type: "default",
			});

			try {
				await deletePromise;
			} catch {
				if (toastId) {
					Toast.dismiss(toastId);
				}
				animatePostListChange();
				setHiddenPostIds((prev) => {
					const next = new Set(prev);
					next.delete(post.id);
					return next;
				});
				Alert.alert("Delete failed", "Could not delete this post. Try again.");
			}
		},
		[deleteBlogMutation, restoreBlogMutation],
	);

	const handleAddToAlbum = useCallback((post: BlogItem) => {
		const mediaId = post.audio?.mediaId;
		if (!mediaId) return;
		setAlbumMediaIds([mediaId]);
		setAlbumAuthorId(post.audio?.authorId ?? undefined);
		setShowAlbumModal(true);
	}, []);

	const handleAlbumAdded = useCallback(
		(album: { id: number; name: string }) => {
			for (const mediaId of albumMediaIds) {
				updateBlogPostByMediaIdInCache(mediaId, (post) => ({
					...post,
					audio: post.audio
						? {
								...post.audio,
								albumId: album.id,
								albumName: album.name,
							}
						: post.audio,
				}));
			}
		},
		[albumMediaIds],
	);

	const setHomeHeaderHidden = useCallback(
		(hidden: boolean) => {
			if (homeHeaderHiddenRef.current === hidden) return;

			homeHeaderHiddenRef.current = hidden;
			Animated.timing(headerCollapseProgress, {
				toValue: hidden ? 0 : 1,
				duration: HOME_HEADER_ANIMATION_DURATION,
				useNativeDriver: false,
			}).start();
		},
		[headerCollapseProgress],
	);

	const requestHomeHeaderHidden = useCallback(
		(hidden: boolean) => {
			if (isFeedDragActiveRef.current) {
				pendingHomeHeaderHiddenRef.current = hidden;
				return;
			}

			pendingHomeHeaderHiddenRef.current = null;
			setHomeHeaderHidden(hidden);
		},
		[setHomeHeaderHidden],
	);

	const flushPendingHomeHeaderHidden = useCallback(() => {
		isFeedDragActiveRef.current = false;

		if (pendingHomeHeaderHiddenRef.current == null) return;

		const nextHidden = pendingHomeHeaderHiddenRef.current;
		pendingHomeHeaderHiddenRef.current = null;
		setHomeHeaderHidden(nextHidden);
	}, [setHomeHeaderHidden]);

	const setCategoryTabsPinnedSafely = useCallback((pinned: boolean) => {
		if (categoryTabsPinnedRef.current === pinned) return;

		categoryTabsPinnedRef.current = pinned;
		setCategoryTabsPinned(pinned);
	}, []);

	const updateCategoryTabsPinnedForScroll = useCallback(
		(currentY: number) => {
			if (typeof categoryTabsOffsetY !== "number") return;

			const pinAt = Math.max(0, categoryTabsOffsetY + CATEGORY_TABS_PIN_HYSTERESIS);
			const unpinAt = Math.max(0, categoryTabsOffsetY - CATEGORY_TABS_PIN_HYSTERESIS);
			const shouldPinCategoryTabs = categoryTabsPinnedRef.current
				? currentY >= unpinAt
				: currentY >= pinAt;

			setCategoryTabsPinnedSafely(shouldPinCategoryTabs);
		},
		[categoryTabsOffsetY, setCategoryTabsPinnedSafely],
	);

	const handleCategoryTabsLayout = useCallback((event: any) => {
		const nextOffsetY = event.nativeEvent.layout?.y;
		if (typeof nextOffsetY !== "number") return;

		setCategoryTabsOffsetY((previousOffsetY) => {
			if (
				typeof previousOffsetY === "number" &&
				Math.abs(previousOffsetY - nextOffsetY) < 1
			) {
				return previousOffsetY;
			}

			return nextOffsetY;
		});
	}, []);

	const homeHeaderAnimatedStyle = useMemo(() => {
		if (!homeHeaderHeight) return undefined;

		return {
			height: headerCollapseProgress.interpolate({
				inputRange: [0, 1],
				outputRange: [0, homeHeaderHeight],
			}),
			opacity: headerCollapseProgress,
			overflow: "hidden" as const,
		};
	}, [headerCollapseProgress, homeHeaderHeight]);

	useEffect(() => {
		setHiddenPostIds(new Set());
		refetch();
	}, [category, refetch]);

	const onRefresh = useCallback(async () => {
		setIsPullRefreshing(true);
		setHiddenPostIds(new Set());
		try {
			await refetch();
		} finally {
			setIsPullRefreshing(false);
		}
	}, [refetch]);

	const handleScroll = useCallback(
		(event: any) => {
			feedScroll.onScroll(event);
			const currentY = event.nativeEvent.contentOffset?.y ?? 0;
			const deltaY = currentY - lastScrollYRef.current;
			lastScrollYRef.current = currentY;
			updateCategoryTabsPinnedForScroll(currentY);

			if (currentY <= 0) {
				scrollDeltaAccumulatorRef.current = 0;
				requestHomeHeaderHidden(false);
				setCategoryTabsPinnedSafely(false);
				if (audioBarScrollHiddenRef.current) {
					audioBarScrollHiddenRef.current = false;
					setGlobalAudioBarScrollHidden(false);
				}
				return;
			}

			if (Math.abs(deltaY) < 2) return;

			const previousAccumulated = scrollDeltaAccumulatorRef.current;
			const changedDirection =
				(previousAccumulated > 0 && deltaY < 0) ||
				(previousAccumulated < 0 && deltaY > 0);

			scrollDeltaAccumulatorRef.current = changedDirection
				? deltaY
				: previousAccumulated + deltaY;

			if (
				scrollDeltaAccumulatorRef.current > AUDIO_BAR_SCROLL_HIDE_THRESHOLD
			) {
				requestHomeHeaderHidden(true);
				scrollDeltaAccumulatorRef.current = 0;
				if (!audioBarScrollHiddenRef.current) {
					audioBarScrollHiddenRef.current = true;
					setGlobalAudioBarScrollHidden(true);
				}
			} else if (
				scrollDeltaAccumulatorRef.current < AUDIO_BAR_SCROLL_SHOW_THRESHOLD
			) {
				requestHomeHeaderHidden(false);
				scrollDeltaAccumulatorRef.current = 0;
				if (audioBarScrollHiddenRef.current) {
					audioBarScrollHiddenRef.current = false;
					setGlobalAudioBarScrollHidden(false);
				}
			}
		},
		[
			feedScroll,
			requestHomeHeaderHidden,
			setCategoryTabsPinnedSafely,
			setGlobalAudioBarScrollHidden,
			updateCategoryTabsPinnedForScroll,
		],
	);

	useEffect(() => {
		return () => {
			audioBarScrollHiddenRef.current = false;
			isFeedDragActiveRef.current = false;
			pendingHomeHeaderHiddenRef.current = null;
			setGlobalAudioBarScrollHidden(false);
			if (previousGlobalAudioHiddenRef.current != null) {
				setGlobalAudioBarHidden(previousGlobalAudioHiddenRef.current);
				previousGlobalAudioHiddenRef.current = null;
			}
		};
	}, [setGlobalAudioBarHidden, setGlobalAudioBarScrollHidden]);

	useEffect(() => {
		if (showAlbumModal) {
			if (previousGlobalAudioHiddenRef.current == null) {
				previousGlobalAudioHiddenRef.current =
					useGlobalAudioBarStore.getState().hidden;
			}
			setGlobalAudioBarHidden(true);
			return;
		}

		if (previousGlobalAudioHiddenRef.current != null) {
			setGlobalAudioBarHidden(previousGlobalAudioHiddenRef.current);
			previousGlobalAudioHiddenRef.current = null;
		}
	}, [setGlobalAudioBarHidden, showAlbumModal]);

	return (
		<View
			className="flex-1 bg-background"
			style={{ backgroundColor: colors.background }}
		>
			<SafeArea>
				<Animated.View style={homeHeaderAnimatedStyle}>
					<View
						onLayout={(event) => {
							const nextHeight = event.nativeEvent.layout.height;
							if (nextHeight > 0) {
								setHomeHeaderHeight((previousHeight) =>
									Math.abs(previousHeight - nextHeight) < 1
										? previousHeight
										: nextHeight,
								);
							}
						}}
					>
						<BlogHomeHeader />
					</View>
				</Animated.View>
				<View className="flex-1 relative">
					{categoryTabsPinned ? (
						<View
							className="absolute left-0 right-0 top-0 border-b border-border bg-background"
							style={{
								backgroundColor: colors.background,
								borderBottomColor: colors.border,
								elevation: 30,
								zIndex: 30,
							}}
						>
							<BlogHomeCategoryTabs
								selected={selectedCategory}
								onSelect={onSelectCategory}
							/>
						</View>
					) : null}
					<LegendList
						ref={feedScroll.ref}
						style={{ backgroundColor: colors.background }}
						data={visiblePosts}
						renderItem={({ item }) => (
							<View>
								<BlogCard
									post={item}
									onDelete={handleDeletePost}
									onAddToAlbum={handleAddToAlbum}
								/>
							</View>
						)}
						keyExtractor={(item) => String(item.id)}
						ListHeaderComponent={
							<View>
								<BlogHomeAnalytics />
								<BlogHomeBooksCta />
								<BlogHomeChannels />
								<BlogHomeRecentlyPlayed />
								<BlogHomeAlbums />
								<BlogHomeBooks />
								<View onLayout={handleCategoryTabsLayout}>
									<BlogHomeCategoryTabs
										selected={selectedCategory}
										onSelect={onSelectCategory}
									/>
								</View>
								<Text className="px-4 pt-4 pb-2 text-base font-bold text-foreground">
									{t("latestPosts")}
								</Text>
								<View
									className="border-t border-border"
									style={{ borderTopColor: colors.border }}
								/>
							</View>
						}
						ListFooterComponent={
							<View className="h-40 items-center px-4 pt-5">
								{isFetchingMore ? (
									<Text
										className="text-sm font-semibold text-muted-foreground"
										style={{ color: colors.mutedForeground }}
									>
										Loading more...
									</Text>
								) : null}
							</View>
						}
						refreshing={isPullRefreshing || isRefetching}
						onRefresh={onRefresh}
						onScroll={handleScroll}
						onScrollBeginDrag={() => {
							isFeedDragActiveRef.current = true;
							pendingHomeHeaderHiddenRef.current = null;
						}}
						onScrollEndDrag={flushPendingHomeHeaderHidden}
						scrollEventThrottle={16}
						onEndReached={() => {
							if (hasNextPage && !isFetching) {
								fetchNextPage();
							}
						}}
						onEndReachedThreshold={0.4}
					/>
					<ScrollToTopButton
						visible={feedScroll.showScrollTop}
						onPress={feedScroll.scrollToTop}
						bottom={88}
					/>
					<BlogHomeFab />
				</View>
				{showAlbumModal && (
					<Modal
						transparent
						animationType="slide"
						statusBarTranslucent
						onRequestClose={() => setShowAlbumModal(false)}
					>
						<Pressable
							className="flex-1 justify-end bg-black/60"
							onPress={() => setShowAlbumModal(false)}
							style={{ elevation: 1000, zIndex: 1000 }}
						>
							<Pressable
								onPress={(e) => e.stopPropagation()}
								style={{ elevation: 1001, zIndex: 1001, width: "100%" }}
							>
								<AddToAlbumModal
									mediaIds={albumMediaIds}
									authorId={albumAuthorId}
									onAdded={handleAlbumAdded}
									onClose={() => {
										setShowAlbumModal(false);
									}}
								/>
							</Pressable>
						</Pressable>
					</Modal>
				)}
			</SafeArea>
		</View>
	);
}
