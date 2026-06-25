import { Pressable } from "@/components/ui/pressable";
import { useMutation, useQuery } from "@/lib/react-query";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { FlatList, ScrollView, Text, TextInput, View } from "react-native";

import { BlogCard, type BlogItem } from "@/components/blog-card";
import { SafeArea } from "@/components/safe-area";
import { _trpc } from "@/components/static-trpc";
import { Icon } from "@/components/ui/icon";
import { useColors } from "@/hooks/use-color";
import { useTranslation } from "@/lib/i18n";

type SearchChannel = {
	id: number;
	title?: string | null;
	username?: string | null;
	count?: number | null;
};

type SearchResultItem = {
	id: number;
	content?: string | null;
	type?: string | null;
	blogDate?: Date | string | null;
	medias?: SearchMedia[];
	blogTags?: SearchBlogTag[];
	channel?: {
		id?: number | null;
		title?: string | null;
		username?: string | null;
	} | null;
};

type SearchBlogTag = {
	tags?: {
		title?: string | null;
	} | null;
};

type RecentSearch = {
	id?: number | string | null;
	searchTerm: string;
};

type SearchTag =
	| string
	| {
			id?: number | string | null;
			title?: string | null;
	  };

type SearchMedia = {
	id?: number | null;
	title?: string | null;
	mimeType?: string | null;
	url?: string | null;
	file?: {
		source?: string | null;
		fileId?: string | null;
		fileUniqueId?: string | null;
		fileName?: string | null;
		fileSize?: number | null;
		mimeType?: string | null;
		duration?: number | null;
		blobUrl?: string | null;
		blobDownloadUrl?: string | null;
		blobPathname?: string | null;
		blobContentType?: string | null;
	} | null;
	transcript?: {
		status?: string | null;
		segments?: {
			id?: number | string | null;
			startSec?: number | null;
			endSec?: number | null;
			text?: string | null;
		}[];
	} | null;
	transcriptionJobs?: { status?: string | null }[];
};

function getBlogTags(item: SearchResultItem) {
	return (
		item.blogTags?.map((blogTag) => blogTag.tags?.title).filter(Boolean) ?? []
	);
}

function getMediaUrl(file?: SearchMedia["file"] | null) {
	if (!file) return null;
	return file.source === "vercel_blob"
		? file.blobDownloadUrl || file.blobUrl || null
		: null;
}

function serializeFile(file?: SearchMedia["file"] | null) {
	if (!file) return null;

	return {
		source: file.source ?? "telegram",
		fileId: file.fileId,
		fileUniqueId: file.fileUniqueId,
		fileName: file.fileName,
		fileSize: file.fileSize,
		mimeType: file.mimeType,
		blobUrl: file.blobUrl,
		blobDownloadUrl: file.blobDownloadUrl,
		blobPathname: file.blobPathname,
		blobContentType: file.blobContentType,
	};
}

function mediaMatchesType(media: SearchMedia, type: "audio" | "image") {
	const mimeType = (media.mimeType || media.file?.mimeType || "").toLowerCase();
	return mimeType.startsWith(`${type}/`);
}

function toBlogCardPost(item: SearchResultItem): BlogItem {
	const type = (item.type || "text") as BlogItem["type"];
	const medias = item.medias ?? [];
	const audioMedia =
		medias.find((media) => mediaMatchesType(media, "audio")) ?? medias[0];
	const audioFile = audioMedia?.file;
	const transcriptSegments =
		audioMedia?.transcript?.segments?.map((segment) => ({
			id: segment.id ?? `${segment.startSec ?? 0}-${segment.endSec ?? 0}`,
			startSec: segment.startSec ?? 0,
			endSec: segment.endSec ?? segment.startSec ?? 0,
			text: segment.text ?? "",
		})) ?? [];
	const transcriptMaxEndSec =
		transcriptSegments[transcriptSegments.length - 1]?.endSec ?? null;
	const durationSec = audioFile?.duration ?? null;
	const isFullyTranscribed =
		audioMedia?.transcript?.status === "done" &&
		Boolean(durationSec) &&
		transcriptMaxEndSec != null &&
		transcriptMaxEndSec >= (durationSec ?? 0) - 3;
	const caption = type === "text" ? null : (item.content ?? null);
	const audio =
		type === "audio" && audioMedia
			? {
					title: audioMedia.title,
					mediaId: audioMedia.id ?? undefined,
					source: audioFile?.source ?? "telegram",
					telegramFileId: audioFile?.fileId,
					url: getMediaUrl(audioFile) ?? audioMedia.url ?? null,
					fileName: audioFile?.fileName,
					displayName: audioFile?.fileName,
					size: audioFile?.fileSize,
					duration: durationSec,
					authorId: undefined,
					authorName: undefined,
					albumName: undefined,
					albumId: undefined,
					transcriptStatus: audioMedia.transcript?.status ?? null,
					transcriptionJobStatus:
						audioMedia.transcriptionJobs?.[0]?.status ?? null,
					transcriptSegments,
					isTranscribed: isFullyTranscribed,
				}
			: null;

	return {
		id: item.id,
		type,
		content: type === "text" ? (item.content ?? null) : null,
		caption,
		date: item.blogDate ? new Date(item.blogDate) : null,
		audio,
		video: null,
		img:
			type === "image"
				? medias
						.filter((media) => mediaMatchesType(media, "image"))
						.map((media) => ({
							fileId: media.file?.fileId,
							source: media.file?.source ?? "telegram",
							url: getMediaUrl(media.file),
							file: serializeFile(media.file),
						}))
				: [],
		doc: null,
		media: medias.map((media) => ({
			id: media.id,
			title: media.title,
			mimeType: media.mimeType,
			file: serializeFile(media.file),
			url: getMediaUrl(media.file) ?? media.url ?? null,
		})),
		tags: getBlogTags(item),
		channel: item.channel,
		isBookmarked: false,
		likes: 0,
		coverImageUrl: null,
		artwork: null,
		title: [caption, audio?.fileName || audio?.displayName || audio?.title]
			.filter(Boolean)
			.join(" - "),
		_count: { comments: 0 },
	} as BlogItem;
}

function getChannelLabel(channel: SearchChannel) {
	return (
		channel.title || (channel.username ? `@${channel.username}` : "Channel")
	);
}

function getTagTitle(tag: SearchTag) {
	return typeof tag === "string" ? tag : (tag.title ?? "");
}

function SearchChannelFilters({
	channels,
	selectedChannelId,
	onSelect,
}: {
	channels: SearchChannel[];
	selectedChannelId: number | null;
	onSelect: (channelId: number | null) => void;
}) {
	const colors = useColors();
	const { t } = useTranslation();
	if (channels.length === 0) return null;

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
				<Pressable
					onPress={() => onSelect(null)}
					className="min-h-11 justify-center rounded-full border px-4"
					style={{
						backgroundColor:
							selectedChannelId == null ? colors.primary : colors.card,
						borderColor:
							selectedChannelId == null ? colors.primary : colors.border,
					}}
				>
					<Text
						className="text-sm font-semibold"
						style={{
							color:
								selectedChannelId == null
									? colors.primaryForeground
									: colors.foreground,
						}}
					>
						{t("all")}
					</Text>
				</Pressable>
				{channels.map((channel) => {
					const isSelected = selectedChannelId === channel.id;

					return (
						<Pressable
							key={channel.id}
							onPress={() => onSelect(isSelected ? null : channel.id)}
							className="min-h-11 justify-center rounded-full border px-4"
							style={{
								backgroundColor: isSelected ? colors.primary : colors.card,
								borderColor: isSelected ? colors.primary : colors.border,
							}}
						>
							<Text
								className="text-sm font-semibold"
								numberOfLines={1}
								style={{
									color: isSelected
										? colors.primaryForeground
										: colors.foreground,
								}}
							>
								{getChannelLabel(channel)}
								{channel.count ? ` ${channel.count}` : ""}
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
	const [selectedChannelId, setSelectedChannelId] = useState<number | null>(
		null,
	);
	const inputRef = useRef<TextInput>(null);

	const { data: recentSearches = [] } = useQuery(
		_trpc.blog.getRecentSearches.queryOptions({ limit: 10 }),
	);

	const { data: tags = [] } = useQuery(_trpc.blog.getTags.queryOptions());

	const { data: results = [], isFetching: isSearching } = useQuery(
		_trpc.blog.search.queryOptions(
			{
				q: submitted,
				channelIds: selectedChannelId ? [selectedChannelId] : undefined,
			},
			{ enabled: submitted.length > 0 },
		),
	);

	const { data: matchedChannels = [] } = useQuery(
		_trpc.blog.searchChannels.queryOptions(
			{ q: submitted },
			{ enabled: submitted.length > 0 },
		),
	);

	const blogPosts = useMemo(
		() => (results as SearchResultItem[]).map(toBlogCardPost),
		[results],
	);

	useEffect(() => {
		if (!selectedChannelId) return;
		const stillVisible = (matchedChannels as SearchChannel[]).some(
			(channel) => channel.id === selectedChannelId,
		);
		if (!stillVisible) {
			setSelectedChannelId(null);
		}
	}, [matchedChannels, selectedChannelId]);

	const saveSearch = useMutation(_trpc.blog.saveSearch.mutationOptions());

	function handleSubmit(q: string) {
		const trimmed = q.trim();
		if (!trimmed) return;
		setSubmitted(trimmed);
		setSelectedChannelId(null);
		saveSearch.mutate({ term: trimmed });
	}

	function handleTagPress(tag: string) {
		setQuery(tag);
		handleSubmit(tag);
	}

	function handleRecentPress(term: string) {
		setQuery(term);
		handleSubmit(term);
	}

	const showResults = submitted.length > 0;

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
									setSelectedChannelId(null);
								}}
								className="min-h-11 min-w-11 items-end justify-center active:opacity-70"
							>
								<Icon name="X" size={16} className="text-muted-foreground" />
							</Pressable>
						)}
					</View>
				</View>

				{showResults ? (
					<View className="flex-1">
						<SearchChannelFilters
							channels={matchedChannels as SearchChannel[]}
							selectedChannelId={selectedChannelId}
							onSelect={setSelectedChannelId}
						/>
						{blogPosts.length === 0 ? (
							<SearchEmptyState
								icon={isSearching ? "Search" : "SearchX"}
								text={
									isSearching
										? t("loading")
										: t("noResultsFor", { query: submitted })
								}
							/>
						) : (
							<FlatList
								style={{ backgroundColor: colors.background }}
								data={blogPosts}
								keyExtractor={(item) => String(item.id)}
								contentContainerClassName="pb-8"
								renderItem={({ item }) => <BlogCard post={item} />}
							/>
						)}
					</View>
				) : (
					<ScrollView
						showsVerticalScrollIndicator={false}
						style={{ backgroundColor: colors.background }}
						contentContainerClassName="pb-8"
					>
						{/* Recent Searches */}
						{recentSearches.length > 0 && (
							<View className="px-4 pt-4">
								<View className="flex-row items-center justify-between mb-3">
									<Text className="text-base font-bold text-foreground">
										{t("recentSearches")}
									</Text>
								</View>
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
							</View>
						)}

						{/* Discover Tags */}
						{tags.length > 0 && (
							<View className="px-4 pt-6">
								<Text className="text-base font-bold text-foreground mb-3">
									{t("browseTags")}
								</Text>
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
							</View>
						)}
					</ScrollView>
				)}
			</SafeArea>
		</View>
	);
}
