import { Pressable } from "@/components/ui/pressable";
import { useInfiniteQuery, useMutation, useQuery } from "@/lib/react-query";
import { useRouter } from "expo-router";
import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	type ReactNode,
} from "react";
import {
	FlatList,
	Keyboard,
	ScrollView,
	Text,
	TextInput,
	View,
} from "react-native";

import { BlogCard, type BlogItem } from "@/components/blog-card";
import { AddToAlbumModal } from "@/components/channel-chat/add-to-album-modal";
import { SafeArea } from "@/components/safe-area";
import { _trpc } from "@/components/static-trpc";
import { useIsFocused } from "@react-navigation/native";
import {
	AudioSearchControls,
	type AudioSearchView,
	type AlbumFilter,
} from "@/components/search/audio-search-controls";
import { AlbumSearchResults } from "@/components/search/album-search-results";
import { AudioActionsSheet } from "@/components/audio-actions/audio-actions-sheet";
import {
	useFloatingFooterInset,
	useFloatingFooterLayer,
} from "@/components/floating-footer";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { Icon } from "@/components/ui/icon";
import { ScrollToTopButton } from "@/components/ui/scroll-to-top-button";
import { useScrollChrome } from "@/hooks/use-scroll-chrome";
import { useColors } from "@/hooks/use-color";
import { useTranslation } from "@/lib/i18n";
import {
	toBlogCardPost,
	type SearchPage,
	type RecentSearch,
	type SearchTag,
	type KeywordSuggestion,
} from "@/lib/search-results";

type SearchChannel = {
	id: number;
	title?: string | null;
	username?: string | null;
	count?: number | null;
};

type SelectedChannel = Pick<SearchChannel, "id" | "title" | "username">;
type SearchBlogType = "text" | "audio" | "image" | "video" | "pdf";

type SearchTypeCount = {
	type: SearchBlogType | string;
	count: number;
};

function getChannelLabel(channel: SearchChannel) {
	return (
		channel.title || (channel.username ? `@${channel.username}` : "Channel")
	);
}

function getTagTitle(tag: SearchTag) {
	return typeof tag === "string" ? tag : (tag.title ?? "");
}

function getBlogTypeLabel(type?: string | null) {
	if (!type) return "Post";
	return type.charAt(0).toUpperCase() + type.slice(1);
}

function channelMatchesQuery(channel: SearchChannel, query: string) {
	const q = query.trim().toLowerCase();
	if (!q) return true;

	return [channel.title, channel.username]
		.filter(Boolean)
		.some((value) => String(value).toLowerCase().includes(q));
}

function SearchSection({
	children,
	title,
}: {
	children: ReactNode;
	title: string;
}) {
	return (
		<View className="px-4 pt-5">
			<Text className="mb-3 text-base font-bold text-foreground">{title}</Text>
			{children}
		</View>
	);
}

function ChannelSuggestionList({
	channels,
	onPress,
}: {
	channels: SearchChannel[];
	onPress: (channel: SearchChannel) => void;
}) {
	if (channels.length === 0) {
		return (
			<Text className="py-2 text-sm text-muted-foreground">
				No matching channels
			</Text>
		);
	}

	return (
		<View className="gap-1">
			{channels.map((channel) => (
				<Pressable
					key={channel.id}
					onPress={() => onPress(channel)}
					className="flex-row items-center gap-3 py-2.5 active:opacity-70"
				>
					<View className="size-8 items-center justify-center rounded-full bg-card">
						<Icon name="Radio" size={16} className="text-muted-foreground" />
					</View>
					<View className="min-w-0 flex-1">
						<Text
							className="text-sm font-semibold text-foreground"
							numberOfLines={1}
						>
							{getChannelLabel(channel)}
						</Text>
						{channel.username ? (
							<Text className="text-xs text-muted-foreground" numberOfLines={1}>
								@{channel.username}
							</Text>
						) : null}
					</View>
					{channel.count ? (
						<Text className="text-xs text-muted-foreground">
							{channel.count}
						</Text>
					) : null}
				</Pressable>
			))}
		</View>
	);
}

function SelectedChannelBadge({
	channel,
	onClear,
}: {
	channel: SelectedChannel;
	onClear: () => void;
}) {
	return (
		<View className="px-4 pb-3">
			<Pressable
				onPress={onClear}
				className="self-start flex-row items-center gap-2 rounded-full bg-card px-3 py-1.5 active:opacity-70"
			>
				<Icon name="Radio" size={14} className="text-primary" />
				<Text
					className="max-w-[260px] text-sm font-semibold text-foreground"
					numberOfLines={1}
				>
					{getChannelLabel(channel)}
				</Text>
				<Icon name="X" size={14} className="text-muted-foreground" />
			</Pressable>
		</View>
	);
}

function BlogTypePills({
	allCount,
	selectedType,
	onSelect,
	typeCounts,
	countsReady,
}: {
	allCount: number;
	countsReady: boolean;
	selectedType: SearchBlogType | null;
	onSelect: (type: SearchBlogType | null) => void;
	typeCounts: SearchTypeCount[];
}) {
	const colors = useColors();

	const pills: {
		label: string;
		value: SearchBlogType | null;
		count: number;
	}[] = [
		{ label: "All", value: null, count: allCount },
		...[
			...typeCounts,
			...(typeCounts.some((item) => item.type === "audio")
				? []
				: [{ type: "audio", count: 0 }]),
		].map(({ type, count }) => ({
			label: getBlogTypeLabel(type),
			value: type as SearchBlogType,
			count,
		})),
	];

	return (
		<View
			className="border-b border-border py-3"
			style={{ borderBottomColor: colors.border }}
		>
			<ScrollView
				horizontal
				showsHorizontalScrollIndicator={false}
				contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
			>
				{pills.map((pill) => {
					const selected = selectedType === pill.value;
					return (
						<Pressable
							key={pill.value ?? "all"}
							onPress={() => onSelect(pill.value)}
							className="min-h-10 justify-center rounded-full border px-4"
							style={{
								backgroundColor: selected ? colors.primary : colors.card,
								borderColor: selected ? colors.primary : colors.border,
							}}
						>
							<Text
								className="text-sm font-semibold"
								style={{
									color: selected
										? colors.primaryForeground
										: colors.foreground,
								}}
							>
								{pill.label} {countsReady ? pill.count : "…"}
							</Text>
						</Pressable>
					);
				})}
			</ScrollView>
		</View>
	);
}

function SearchEmptyState({
	icon,
	text,
}: {
	icon: "Search" | "SearchX";
	text: string;
}) {
	const colors = useColors();

	return (
		<View className="flex-1 items-center justify-center gap-2 px-6">
			<Icon name={icon} size={40} className="text-muted-foreground" />
			<Text
				className="text-center text-sm text-muted-foreground"
				style={{ color: colors.mutedForeground }}
			>
				{text}
			</Text>
		</View>
	);
}

export default function SearchScreen() {
	const router = useRouter();
	const colors = useColors();
	const { t } = useTranslation();
	const [query, setQuery] = useState("");
	const [submitted, setSubmitted] = useState("");
	const [selectedChannel, setSelectedChannel] =
		useState<SelectedChannel | null>(null);
	const [selectedBlogType, setSelectedBlogType] =
		useState<SearchBlogType | null>(null);
	const [albumMediaIds, setAlbumMediaIds] = useState<number[]>([]);
	const [showAlbumModal, setShowAlbumModal] = useState(false);
	const [audioView, setAudioView] = useState<AudioSearchView>("tracks");
	const [membership, setMembership] = useState<AlbumFilter>();
	const [selecting, setSelecting] = useState(false);
	const [selected, setSelected] = useState<Set<number>>(() => new Set());
	const [actionPosts, setActionPosts] = useState<BlogItem[] | null>(null);
	const focused = useIsFocused();
	const footerInset = useFloatingFooterInset();
	const clearSelection = useCallback(() => {
		setSelecting(false);
		setSelected(new Set());
	}, []);
	useEffect(clearSelection, [
		submitted,
		selectedChannel?.id,
		selectedBlogType,
		membership,
		audioView,
		clearSelection,
	]);
	const inputRef = useRef<TextInput>(null);
	const resultsScroll = useScrollChrome<FlatList<BlogItem>>();
	const emptyScroll = useScrollChrome<ScrollView>();
	const suggestionKeyword = useDebouncedValue(query.trim());

	const { data: recentSearches = [] } = useQuery(
		_trpc.blog.getRecentSearches.queryOptions({ limit: 10 }),
	);

	const { data: tags = [] } = useQuery(_trpc.blog.getTags.queryOptions());
	const { data: allChannels = [] } = useQuery(
		_trpc.channel.getChannels.queryOptions(),
	);

	const { data: keywordSuggestions = [] } = useQuery(
		_trpc.blog.suggestSearchKeywords.queryOptions(
			{ q: suggestionKeyword, limit: 8 },
			{
				enabled: suggestionKeyword.length >= 2,
				staleTime: 60_000,
				gcTime: 300_000,
			},
		),
	);

	const showResults =
		submitted.length > 0 ||
		Boolean(selectedChannel) ||
		selectedBlogType === "audio";
	const albumsView = selectedBlogType === "audio" && audioView === "albums";
	const facets = useQuery(
		_trpc.blog.searchFacets.queryOptions(
			{
				q: submitted,
				channelIds: selectedChannel ? [selectedChannel.id] : undefined,
			},
			{ enabled: showResults, staleTime: 60_000, gcTime: 600_000 },
		),
	);
	const searchInput = useMemo(
		() => ({
			limit: 20,
			q: submitted,
			channelIds: selectedChannel ? [selectedChannel.id] : undefined,
			type: selectedBlogType ?? undefined,
			album: selectedBlogType === "audio" ? membership : undefined,
			includeCounts: false,
		}),
		[selectedBlogType, selectedChannel, submitted, membership],
	);

	const {
		data: searchPages,
		fetchNextPage,
		hasNextPage,
		isFetching,
		isFetchingNextPage,
		isError,
		refetch,
	} = useInfiniteQuery(
		_trpc.blog.search.infiniteQueryOptions(searchInput, {
			enabled: showResults && !albumsView,
			staleTime: 45_000,
			gcTime: 600_000,
			getNextPageParam: (lastPage) => lastPage.meta.cursor ?? undefined,
		}),
	);

	const visibleChannels = useMemo(
		() =>
			(allChannels as SearchChannel[])
				.filter((channel) => channelMatchesQuery(channel, suggestionKeyword))
				.slice(0, suggestionKeyword ? 12 : 10),
		[allChannels, suggestionKeyword],
	);

	const blogPosts = useMemo(
		() =>
			((searchPages?.pages ?? []) as SearchPage[])
				.flatMap((page) => page.data)
				.filter(
					(item, index, items) =>
						items.findIndex((candidate) => candidate.id === item.id) === index,
				)
				.map((item) => toBlogCardPost(item)),
		[searchPages],
	);

	const searchMeta = facets.data;
	const allCount = searchMeta?.allCount ?? 0;

	const isSearching = isFetching && blogPosts.length === 0;
	const isFetchingMore = isFetchingNextPage;

	const sortedTypeCounts = useMemo(
		() =>
			[...(searchMeta?.typeCounts ?? [])].sort((a, b) =>
				a.type.localeCompare(b.type),
			),
		[searchMeta],
	);

	const saveSearch = useMutation(_trpc.blog.saveSearch.mutationOptions());

	function handleSubmit(q: string) {
		const trimmed = q.trim();
		Keyboard.dismiss();
		setSubmitted(trimmed);
		if (trimmed) {
			saveSearch.mutate({ term: trimmed });
		}
	}

	function handleTagPress(tag: string) {
		setQuery(tag);
		handleSubmit(tag);
	}

	function handleRecentPress(term: string) {
		setQuery(term);
		handleSubmit(term);
	}

	function handleSuggestionPress(item: KeywordSuggestion) {
		setQuery(item.keyword);
		handleSubmit(item.keyword);
	}

	function handleChannelPress(channel: SearchChannel) {
		setSelectedChannel({
			id: channel.id,
			title: channel.title,
			username: channel.username,
		});
		setSubmitted(query.trim());
		setSelectedBlogType(null);
	}

	function clearSelectedChannel() {
		setSelectedChannel(null);
		setSelectedBlogType(null);
	}

	const handleAddToAlbum = useCallback((post: BlogItem) => {
		const mediaId = post.audio?.mediaId;
		if (!mediaId) return;
		setAlbumMediaIds([mediaId]);
		setShowAlbumModal(true);
	}, []);

	const selectedPosts = useMemo(
		() =>
			blogPosts.filter(
				(post): post is BlogItem & { audio: NonNullable<BlogItem["audio"]> } =>
					!!post.audio?.mediaId && selected.has(post.audio.mediaId),
			),
		[blogPosts, selected],
	);
	const toggleSelected = useCallback((post: BlogItem) => {
		const id = post.audio?.mediaId;
		if (!id) return;
		setSelecting(true);
		setSelected((current) => {
			const next = new Set(current);
			if (next.has(id)) next.delete(id);
			else if (next.size < 200) next.add(id);
			return next;
		});
	}, []);
	const footer = useMemo(
		() => ({
			id: "audio-search-selection",
			priority: 20,
			visible: focused && selecting && !showAlbumModal && !actionPosts,
			render: () => (
				<View className="mx-3 rounded-2xl bg-card border border-border px-4 py-3 gap-2">
					<View className="flex-row items-center justify-between">
						<Text
							accessibilityLiveRegion="polite"
							className="text-foreground font-bold"
						>
							{selectedPosts.length} selected
						</Text>
						<Pressable
							onPress={clearSelection}
							className="min-h-10 justify-center px-2"
						>
							<Text className="text-primary">Cancel</Text>
						</Pressable>
					</View>
					<View className="flex-row gap-2">
						<Pressable
							disabled={!selectedPosts.length}
							onPress={() => {
								setAlbumMediaIds(
									selectedPosts.map((post) => post.audio.mediaId),
								);
								setShowAlbumModal(true);
							}}
							className="flex-1 min-h-11 rounded-xl bg-primary items-center justify-center"
						>
							<Text className="text-primary-foreground font-semibold">
								Choose album
							</Text>
						</Pressable>
						<Pressable
							disabled={!selectedPosts.length}
							onPress={() => setActionPosts(selectedPosts)}
							className="flex-1 min-h-11 rounded-xl bg-muted items-center justify-center"
						>
							<Text className="text-foreground font-semibold">
								More actions
							</Text>
						</Pressable>
					</View>
				</View>
			),
		}),
		[
			focused,
			selecting,
			showAlbumModal,
			actionPosts,
			selectedPosts,
			clearSelection,
		],
	);
	useFloatingFooterLayer(footer);

	const isTypingNewKeyword =
		suggestionKeyword.length > 0 && suggestionKeyword !== submitted;

	return (
		<View
			className="flex-1 bg-background"
			style={{ backgroundColor: colors.background }}
		>
			<SafeArea>
				{/* Search bar row */}
				<View className="flex-row items-center gap-3 px-4 py-3">
					<Pressable
						onPress={() => router.back()}
						className="size-11 rounded-full bg-card items-center justify-center active:opacity-70"
					>
						<Icon name="ChevronLeft" size={22} className="text-foreground" />
					</Pressable>
					<View className="flex-1 flex-row items-center bg-card rounded-xl px-3 h-11 gap-2">
						<Icon name="Search" size={16} className="text-muted-foreground" />
						<TextInput
							ref={inputRef}
							placeholder={t("searchPostsTags")}
							placeholderTextColor={colors.mutedForeground}
							value={query}
							onChangeText={setQuery}
							onSubmitEditing={() => handleSubmit(query)}
							autoFocus
							maxLength={500}
							returnKeyType="search"
							style={{
								flex: 1,
								fontSize: 14,
								color: colors.foreground,
								paddingVertical: 0,
							}}
						/>
						{query.length > 0 && (
							<Pressable
								onPress={() => {
									setQuery("");
									setSubmitted("");
									setSelectedChannel(null);
									setSelectedBlogType(null);
								}}
								className="min-h-11 min-w-11 items-end justify-center active:opacity-70"
							>
								<Icon name="X" size={16} className="text-muted-foreground" />
							</Pressable>
						)}
					</View>
				</View>
				{selectedChannel && selectedBlogType !== "audio" ? (
					<SelectedChannelBadge
						channel={selectedChannel}
						onClear={clearSelectedChannel}
					/>
				) : null}

				{showResults ? (
					<View className="flex-1">
						<BlogTypePills
							allCount={allCount}
							countsReady={!!facets.data}
							selectedType={selectedBlogType}
							onSelect={setSelectedBlogType}
							typeCounts={sortedTypeCounts}
						/>
						{selectedBlogType === "audio" ? (
							<AudioSearchControls
								view={audioView}
								onView={setAudioView}
								channel={selectedChannel}
								onChannel={setSelectedChannel}
								channels={allChannels}
								membership={membership}
								onMembership={setMembership}
								selecting={selecting}
								onSelect={() => setSelecting(true)}
								onCancel={clearSelection}
							/>
						) : null}
						{selecting && !albumsView ? (
							<Pressable
								onPress={() =>
									setSelected(
										new Set(
											blogPosts
												.flatMap((post) =>
													post.audio?.mediaId ? [post.audio.mediaId] : [],
												)
												.slice(0, 200),
										),
									)
								}
								className="px-4 py-2"
							>
								<Text className="text-primary">
									Select loaded audio (up to 200)
								</Text>
							</Pressable>
						) : null}
						{isError || facets.isError ? (
							<Pressable
								onPress={() => {
									void refetch();
									void facets.refetch();
								}}
								className="px-4 py-3"
							>
								<Text className="text-destructive">
									Could not refresh search. Tap to retry.
								</Text>
							</Pressable>
						) : null}
						{albumsView ? (
							<AlbumSearchResults
								q={submitted}
								channelId={selectedChannel?.id}
							/>
						) : blogPosts.length === 0 ? (
							<SearchEmptyState
								icon={isSearching ? "Search" : "SearchX"}
								text={
									isSearching
										? t("loading")
										: isError
											? "Search is unavailable. Retry above."
											: t("noResultsFor", {
													query:
														submitted ||
														(selectedChannel
															? getChannelLabel(selectedChannel)
															: "all audio"),
												})
								}
							/>
						) : (
							<FlatList
								ref={resultsScroll.ref}
								style={{ backgroundColor: colors.background }}
								data={blogPosts}
								keyExtractor={(item) => String(item.id)}
								contentContainerStyle={{ paddingBottom: footerInset + 24 }}
								ListFooterComponent={
									<View className="h-24 items-center px-4 pt-5">
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
								onScroll={resultsScroll.onScroll}
								scrollEventThrottle={resultsScroll.scrollEventThrottle}
								onEndReached={() => {
									if (hasNextPage && !isFetching) {
										fetchNextPage();
									}
								}}
								onEndReachedThreshold={0.4}
								renderItem={({ item }) => (
									<BlogCard
										post={item}
										onAddToAlbum={handleAddToAlbum}
										onLongPress={
											selectedBlogType === "audio" ? toggleSelected : undefined
										}
										selectionMode={selecting}
										selected={
											!!item.audio?.mediaId && selected.has(item.audio.mediaId)
										}
										onPress={selecting ? toggleSelected : undefined}
									/>
								)}
							/>
						)}
						<ScrollToTopButton
							visible={!albumsView && !selecting && resultsScroll.showScrollTop}
							onPress={resultsScroll.scrollToTop}
						/>
					</View>
				) : (
					<ScrollView
						ref={emptyScroll.ref}
						showsVerticalScrollIndicator={false}
						style={{ backgroundColor: colors.background }}
						contentContainerClassName="pb-8"
						onScroll={emptyScroll.onScroll}
						scrollEventThrottle={emptyScroll.scrollEventThrottle}
					>
						<Pressable
							onPress={() => {
								Keyboard.dismiss();
								setSubmitted(query.trim());
								setSelectedBlogType("audio");
							}}
							className="mx-4 mt-4 p-4 rounded-xl bg-card"
						>
							<Text className="text-primary font-semibold">
								Browse audio and albums
							</Text>
						</Pressable>
						{isTypingNewKeyword && (
							<SearchSection title="Suggestions">
								<View className="gap-1">
									{(keywordSuggestions as KeywordSuggestion[]).length > 0 ? (
										(keywordSuggestions as KeywordSuggestion[]).map((item) => (
											<Pressable
												key={`${item.source ?? "suggestion"}-${item.keyword}`}
												onPress={() => handleSuggestionPress(item)}
												className="flex-row items-center gap-3 py-2.5 active:opacity-70"
											>
												<Icon
													name="Search"
													size={16}
													className="text-muted-foreground"
												/>
												<Text className="flex-1 text-sm text-foreground">
													{item.keyword}
												</Text>
											</Pressable>
										))
									) : (
										<Text className="py-2 text-sm text-muted-foreground">
											Keep typing to search this keyword
										</Text>
									)}
								</View>
							</SearchSection>
						)}
						{/* Recent Searches */}
						{!isTypingNewKeyword && recentSearches.length > 0 && (
							<SearchSection title={t("recentSearches")}>
								<View className="gap-1">
									{(recentSearches as RecentSearch[]).map((item) => (
										<Pressable
											key={item.id ?? item.searchTerm}
											onPress={() => handleRecentPress(item.searchTerm)}
											className="flex-row items-center gap-3 py-2.5 active:opacity-70"
										>
											<Icon
												name="Clock"
												size={16}
												className="text-muted-foreground"
											/>
											<Text className="flex-1 text-sm text-foreground">
												{item.searchTerm}
											</Text>
										</Pressable>
									))}
								</View>
							</SearchSection>
						)}

						<SearchSection title={t("channels")}>
							<ChannelSuggestionList
								channels={visibleChannels}
								onPress={handleChannelPress}
							/>
						</SearchSection>

						{/* Discover Tags */}
						{tags.length > 0 && (
							<SearchSection title={t("browseTags")}>
								<View className="flex-row flex-wrap gap-2">
									{(tags as SearchTag[]).map((tag) => {
										const tagTitle = getTagTitle(tag);
										if (!tagTitle) return null;

										return (
											<Pressable
												key={
													typeof tag === "string" ? tag : (tag.id ?? tagTitle)
												}
												onPress={() => handleTagPress(tagTitle)}
												className="px-3 py-1.5 rounded-full bg-card active:opacity-70"
											>
												<Text className="text-sm font-medium text-foreground">
													#{tagTitle}
												</Text>
											</Pressable>
										);
									})}
								</View>
							</SearchSection>
						)}
					</ScrollView>
				)}
				<ScrollToTopButton
					visible={!showResults && emptyScroll.showScrollTop}
					onPress={emptyScroll.scrollToTop}
				/>
				{showAlbumModal && (
					<AddToAlbumModal
						mediaIds={albumMediaIds}
						onAdded={clearSelection}
						onClose={() => setShowAlbumModal(false)}
					/>
				)}
				{actionPosts ? (
					<AudioActionsSheet
						posts={actionPosts}
						onClose={() => setActionPosts(null)}
						onCompleted={clearSelection}
					/>
				) : null}
			</SafeArea>
		</View>
	);
}
