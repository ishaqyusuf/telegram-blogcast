import { Pressable } from "@/components/ui/pressable";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@/lib/react-query";
import { useRouter } from "expo-router";
import { useMemo, useRef, useState, type ReactNode } from "react";
import {
  FlatList,
  Modal,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import { BlogCard, type BlogItem } from "@/components/blog-card";
import { AddToAlbumModal } from "@/components/channel-chat/add-to-album-modal";
import { SafeArea } from "@/components/safe-area";
import { _trpc } from "@/components/static-trpc";
import { Icon } from "@/components/ui/icon";
import { ScrollToTopButton } from "@/components/ui/scroll-to-top-button";
import { useScrollChrome } from "@/hooks/use-scroll-chrome";
import { useColors } from "@/hooks/use-color";
import { useTranslation } from "@/lib/i18n";

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

type SearchPage = {
  data: SearchResultItem[];
  meta: {
    allCount: number;
    cursor: number | null;
    totalCount: number;
    typeCounts: SearchTypeCount[];
  };
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
  album?: {
    id?: number | null;
    name?: string | null;
  } | null;
  albumId?: number | null;
  albumAudioIndex?: {
    index?: number | null;
  } | null;
};

type KeywordSuggestion = {
  keyword: string;
  source?: string | null;
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

function toBlogCardPost(
  item: SearchResultItem,
  localAlbumMembership?: Map<number, { id: number; name: string }>,
): BlogItem {
  const type = (item.type || "text") as BlogItem["type"];
  const medias = item.medias ?? [];
  const audioMedia =
    medias.find((media) => mediaMatchesType(media, "audio")) ?? medias[0];
  const audioFile = audioMedia?.file;
  const localAlbum =
    audioMedia?.id != null ? localAlbumMembership?.get(audioMedia.id) : null;
  const mediaAlbum = localAlbum
    ? { id: localAlbum.id, name: localAlbum.name }
    : audioMedia?.album;
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
          albumName: mediaAlbum?.name ?? undefined,
          albumId: mediaAlbum?.id ?? audioMedia.albumId ?? undefined,
          albumTrackIndex: audioMedia.albumAudioIndex?.index ?? undefined,
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
}: {
  allCount: number;
  selectedType: SearchBlogType | null;
  onSelect: (type: SearchBlogType | null) => void;
  typeCounts: SearchTypeCount[];
}) {
  const colors = useColors();
  if (allCount === 0 && typeCounts.length === 0) return null;

  const pills: {
    label: string;
    value: SearchBlogType | null;
    count: number;
  }[] = [
    { label: "All", value: null, count: allCount },
    ...typeCounts.map(({ type, count }) => ({
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
                {pill.label} {pill.count}
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
  const queryClient = useQueryClient();
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
  const [localAlbumMembership, setLocalAlbumMembership] = useState(
    () => new Map<number, { id: number; name: string }>(),
  );
  const inputRef = useRef<TextInput>(null);
  const resultsScroll = useScrollChrome<FlatList<BlogItem>>();
  const emptyScroll = useScrollChrome<ScrollView>();
  const suggestionKeyword = query.trim();

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
      { enabled: suggestionKeyword.length >= 2 },
    ),
  );

  const showResults = submitted.length > 0 || Boolean(selectedChannel);
  const searchInput = useMemo(
    () => ({
      limit: 20,
      q: submitted,
      channelIds: selectedChannel ? [selectedChannel.id] : undefined,
      type: selectedBlogType ?? undefined,
    }),
    [selectedBlogType, selectedChannel, submitted],
  );

  const {
    data: searchPages,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
  } = useInfiniteQuery(
    _trpc.blog.search.infiniteQueryOptions(searchInput, {
      enabled: showResults,
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
        .map((item) => toBlogCardPost(item, localAlbumMembership)),
    [localAlbumMembership, searchPages],
  );

  const searchMeta = (searchPages?.pages?.[0] as SearchPage | undefined)?.meta;
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
    if (!trimmed && !selectedChannel) return;
    setSubmitted(trimmed);
    setSelectedBlogType(null);
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

  function handleAddToAlbum(post: BlogItem) {
    const mediaId = post.audio?.mediaId;
    if (!mediaId) return;
    setAlbumMediaIds([mediaId]);
    setShowAlbumModal(true);
  }

  function handleAlbumAdded(album: { id: number; name: string }) {
    setLocalAlbumMembership((prev) => {
      const next = new Map(prev);
      for (const mediaId of albumMediaIds) {
        next.set(mediaId, album);
      }
      return next;
    });
    queryClient.invalidateQueries({
      queryKey: _trpc.blog.search.infiniteQueryKey(),
    });
  }

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
        {selectedChannel ? (
          <SelectedChannelBadge
            channel={selectedChannel}
            onClear={clearSelectedChannel}
          />
        ) : null}

        {showResults ? (
          <View className="flex-1">
            <BlogTypePills
              allCount={allCount}
              selectedType={selectedBlogType}
              onSelect={setSelectedBlogType}
              typeCounts={sortedTypeCounts}
            />
            {blogPosts.length === 0 ? (
              <SearchEmptyState
                icon={isSearching ? "Search" : "SearchX"}
                text={
                  isSearching
                    ? t("loading")
                    : t("noResultsFor", {
                        query: submitted || getChannelLabel(selectedChannel!),
                      })
                }
              />
            ) : (
              <FlatList
                ref={resultsScroll.ref}
                style={{ backgroundColor: colors.background }}
                data={blogPosts}
                keyExtractor={(item) => String(item.id)}
                contentContainerClassName="pb-8"
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
                  <BlogCard post={item} onAddToAlbum={handleAddToAlbum} />
                )}
              />
            )}
            <ScrollToTopButton
              visible={resultsScroll.showScrollTop}
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
          <Modal
            transparent
            animationType="slide"
            statusBarTranslucent
            onRequestClose={() => setShowAlbumModal(false)}
          >
            <Pressable
              className="flex-1 justify-end bg-black/60"
              onPress={() => setShowAlbumModal(false)}
            >
              <Pressable
                onPress={(event) => event.stopPropagation()}
                style={{ width: "100%" }}
              >
                <AddToAlbumModal
                  mediaIds={albumMediaIds}
                  onAdded={handleAlbumAdded}
                  onClose={() => setShowAlbumModal(false)}
                />
              </Pressable>
            </Pressable>
          </Modal>
        )}
      </SafeArea>
    </View>
  );
}
