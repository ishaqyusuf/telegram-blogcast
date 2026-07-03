import { Pressable } from "@/components/ui/pressable";
import { useQuery } from "@/lib/react-query";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import { getBlogHref } from "@/components/blog-card/utils";
import { SafeArea } from "@/components/safe-area";
import { _trpc } from "@/components/static-trpc";
import { Icon } from "@/components/ui/icon";
import { useColors } from "@/hooks/use-color";
import { getAudioDisplayTitle } from "@/lib/audio-title";
import { withAlpha } from "@/lib/theme";

interface BlogSearchProps {
  onBackPress: () => void;
}

type AlbumFilter = "in" | "not" | null;

function getChannelLabel(channel: any) {
  return channel?.title || channel?.username || `Channel #${channel?.id}`;
}

function getResultTitle(item: any) {
  if (item.type === "audio") {
    return getAudioDisplayTitle(
      { content: item.content, media: item.medias?.[0] },
      "Audio",
    );
  }
  return item.content?.replace(/\s+/g, " ").trim() || `Post #${item.id}`;
}

function albumFilterLabel(value: AlbumFilter) {
  if (value === "in") return "In Album";
  if (value === "not") return "Not in Album";
  return "Any";
}

function FilterRow({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      className="rounded-2xl border border-border bg-card px-4 py-3 active:opacity-80"
      style={{ backgroundColor: colors.card, borderColor: colors.border }}
    >
      <View className="flex-row items-center justify-between gap-3">
        <View className="min-w-0 flex-1">
          <Text className="text-sm font-bold text-foreground">{label}</Text>
          <Text
            className="mt-1 text-xs text-muted-foreground"
            numberOfLines={1}
          >
            {value}
          </Text>
        </View>
        <Icon name="ChevronRight" size={18} className="text-muted-foreground" />
      </View>
    </Pressable>
  );
}

function ChannelFilterSheet({
  visible,
  channels,
  selectedIds,
  onClose,
  onProceed,
}: {
  visible: boolean;
  channels: any[];
  selectedIds: number[];
  onClose: () => void;
  onProceed: (ids: number[]) => void;
}) {
  const colors = useColors();
  const [draftIds, setDraftIds] = useState<number[]>(selectedIds);

  function toggle(id: number) {
    setDraftIds((current) =>
      current.includes(id)
        ? current.filter((channelId) => channelId !== id)
        : [...current, id],
    );
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onShow={() => setDraftIds(selectedIds)}
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end bg-black/40">
        <View
          className="max-h-[82%] rounded-t-3xl border border-border bg-background px-4 pb-6 pt-3"
          style={{
            backgroundColor: colors.background,
            borderColor: colors.border,
          }}
        >
          <View className="mb-3 flex-row items-center justify-between">
            <Pressable
              onPress={onClose}
              className="h-10 w-10 items-center justify-center rounded-full active:bg-muted"
            >
              <Icon name="X" size={20} className="text-foreground" />
            </Pressable>
            <Text className="text-base font-bold text-foreground">Channel</Text>
            <View className="h-10 w-10" />
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View className="gap-2 pb-4">
              {channels.map((channel) => {
                const isSelected = draftIds.includes(channel.id);
                return (
                  <Pressable
                    key={channel.id}
                    onPress={() => toggle(channel.id)}
                    className="rounded-2xl border border-border bg-card px-4 py-3 active:opacity-80"
                    style={{
                      backgroundColor: colors.card,
                      borderColor: isSelected ? colors.primary : colors.border,
                    }}
                  >
                    <View className="flex-row items-center justify-between gap-3">
                      <View className="min-w-0 flex-1">
                        <Text
                          className="text-sm font-bold text-foreground"
                          numberOfLines={1}
                        >
                          {getChannelLabel(channel)}
                        </Text>
                        <Text
                          className="mt-1 text-xs text-muted-foreground"
                          numberOfLines={1}
                        >
                          {channel.username
                            ? `@${channel.username}`
                            : "Channel"}
                        </Text>
                      </View>
                      {isSelected ? (
                        <Icon
                          name="CheckCircle2"
                          size={18}
                          className="text-primary"
                        />
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          <View className="mt-2 flex-row gap-2">
            <Pressable
              onPress={() => {
                setDraftIds([]);
                onProceed([]);
                onClose();
              }}
              className="h-11 flex-1 items-center justify-center rounded-xl border border-border"
            >
              <Text className="text-sm font-bold text-foreground">Clear</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                onProceed(draftIds);
                onClose();
              }}
              className="h-11 flex-1 items-center justify-center rounded-xl bg-primary"
            >
              <Text className="text-sm font-bold text-primary-foreground">
                Proceed
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function AlbumFilterSheet({
  visible,
  selected,
  onClose,
  onProceed,
}: {
  visible: boolean;
  selected: AlbumFilter;
  onClose: () => void;
  onProceed: (value: AlbumFilter) => void;
}) {
  const colors = useColors();
  const [draft, setDraft] = useState<AlbumFilter>(selected);
  const options: { label: string; value: Exclude<AlbumFilter, null> }[] = [
    { label: "In Album", value: "in" },
    { label: "Not in Album", value: "not" },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onShow={() => setDraft(selected)}
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end bg-black/40">
        <View
          className="max-h-[70%] rounded-t-3xl border border-border bg-background px-4 pb-6 pt-3"
          style={{
            backgroundColor: colors.background,
            borderColor: colors.border,
          }}
        >
          <View className="mb-3 flex-row items-center justify-between">
            <Pressable
              onPress={onClose}
              className="h-10 w-10 items-center justify-center rounded-full active:bg-muted"
            >
              <Icon name="X" size={20} className="text-foreground" />
            </Pressable>
            <Text className="text-base font-bold text-foreground">Album</Text>
            <View className="h-10 w-10" />
          </View>

          <View className="gap-2 pb-4">
            {options.map((option) => {
              const isSelected = draft === option.value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => setDraft(isSelected ? null : option.value)}
                  className="rounded-2xl border border-border bg-card px-4 py-4 active:opacity-80"
                  style={{
                    backgroundColor: colors.card,
                    borderColor: isSelected ? colors.primary : colors.border,
                  }}
                >
                  <View className="flex-row items-center justify-between">
                    <Text className="text-sm font-bold text-foreground">
                      {option.label}
                    </Text>
                    {isSelected ? (
                      <Icon
                        name="CheckCircle2"
                        size={18}
                        className="text-primary"
                      />
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </View>

          <View className="mt-2 flex-row gap-2">
            <Pressable
              onPress={() => {
                setDraft(null);
                onProceed(null);
                onClose();
              }}
              className="h-11 flex-1 items-center justify-center rounded-xl border border-border"
            >
              <Text className="text-sm font-bold text-foreground">Clear</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                onProceed(draft);
                onClose();
              }}
              className="h-11 flex-1 items-center justify-center rounded-xl bg-primary"
            >
              <Text className="text-sm font-bold text-primary-foreground">
                Proceed
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function BlogSearch({ onBackPress }: BlogSearchProps) {
  const router = useRouter();
  const colors = useColors();
  const [searchText, setSearchText] = useState("");
  const [channelSheetVisible, setChannelSheetVisible] = useState(false);
  const [albumSheetVisible, setAlbumSheetVisible] = useState(false);
  const [selectedChannelIds, setSelectedChannelIds] = useState<number[]>([]);
  const [albumFilter, setAlbumFilter] = useState<AlbumFilter>(null);

  const { data: channels = [] } = useQuery(
    _trpc.channel.getChannels.queryOptions(),
  );
  const selectedChannels = useMemo(
    () =>
      channels.filter((channel: any) =>
        selectedChannelIds.includes(channel.id),
      ),
    [channels, selectedChannelIds],
  );
  const query = searchText.trim();
  const hasFilters = selectedChannelIds.length > 0 || albumFilter !== null;
  const { data: resultsPage } = useQuery({
    ..._trpc.blog.search.queryOptions({
      q: query,
      channelIds: selectedChannelIds,
      album: albumFilter ?? undefined,
      limit: 30,
    }),
    enabled: query.length > 0 || hasFilters,
  });
  const results = resultsPage?.data ?? [];

  return (
    <View
      className="flex-1 bg-background"
      style={{ backgroundColor: colors.background }}
    >
      <SafeArea>
        <View className="flex-row items-center gap-3 border-b border-border px-4 py-3">
          <Pressable onPress={onBackPress} className="-ml-2 rounded-full p-2">
            <Icon name="ArrowLeft" className="size-base text-foreground" />
          </Pressable>

          <View className="h-10 flex-1 flex-row items-center gap-2 rounded-full border border-border bg-card px-3">
            <Icon name="Search" className="size-[18px] text-muted-foreground" />
            <TextInput
              className="h-full flex-1 text-sm text-foreground"
              placeholder="Search topics, tags..."
              placeholderTextColor={colors.mutedForeground}
              value={searchText}
              onChangeText={setSearchText}
              autoFocus
            />
            {searchText.length > 0 ? (
              <Pressable onPress={() => setSearchText("")}>
                <Icon name="X" className="size-[18px] text-muted-foreground" />
              </Pressable>
            ) : null}
          </View>
        </View>

        <View className="gap-2 px-4 py-3">
          <FilterRow
            label="Channel"
            value={
              selectedChannels.length > 0
                ? `${selectedChannels.length} selected`
                : "Any"
            }
            onPress={() => setChannelSheetVisible(true)}
          />
          {selectedChannels.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingRight: 16 }}
            >
              {selectedChannels.map((channel: any) => (
                <View
                  key={channel.id}
                  className="rounded-full px-3 py-1.5"
                  style={{ backgroundColor: withAlpha(colors.primary, 0.12) }}
                >
                  <Text className="text-xs font-bold text-primary">
                    {getChannelLabel(channel)}
                  </Text>
                </View>
              ))}
            </ScrollView>
          ) : null}
          <FilterRow
            label="Album"
            value={albumFilterLabel(albumFilter)}
            onPress={() => setAlbumSheetVisible(true)}
          />
        </View>

        {query.length > 0 || hasFilters ? (
          <FlatList
            data={results}
            keyExtractor={(item: any) => String(item.id)}
            contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 10 }}
            ListEmptyComponent={
              <View className="items-center justify-center py-16">
                <Icon
                  name="SearchX"
                  size={34}
                  className="text-muted-foreground"
                />
                <Text className="mt-3 text-sm font-semibold text-muted-foreground">
                  No matching posts
                </Text>
              </View>
            }
            renderItem={({ item }: { item: any }) => (
              <Pressable
                onPress={() => router.push(getBlogHref(item) as any)}
                className="rounded-2xl border border-border bg-card p-4 active:opacity-80"
                style={{
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                }}
              >
                <Text
                  className="text-sm font-bold text-foreground"
                  numberOfLines={2}
                >
                  {getResultTitle(item)}
                </Text>
                <Text
                  className="mt-2 text-xs text-muted-foreground"
                  numberOfLines={1}
                >
                  {[
                    item.channel ? getChannelLabel(item.channel) : null,
                    albumFilterLabel(
                      item.medias?.some((media: any) => media.albumId)
                        ? "in"
                        : "not",
                    ),
                  ]
                    .filter(Boolean)
                    .join(" • ")}
                </Text>
              </Pressable>
            )}
          />
        ) : (
          <ScrollView
            className="flex-1 p-4"
            keyboardShouldPersistTaps="handled"
          >
            <View className="mb-6">
              <Text className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Recent
              </Text>
              {[
                "Digital Nomadism",
                "Mindfulness Meditation",
                "Kyoto Travel Guide",
              ].map((term) => (
                <View
                  key={term}
                  className="flex-row items-center justify-between border-b border-border py-3"
                >
                  <View className="flex-row items-center gap-3">
                    <Icon
                      name="Clock"
                      className="size-[18px] text-muted-foreground"
                    />
                    <Text className="font-medium text-foreground">{term}</Text>
                  </View>
                </View>
              ))}
            </View>

            <View>
              <Text className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Discover
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {[
                  "#Technology",
                  "#Design",
                  "#Photography",
                  "#Culture",
                  "#RemoteWork",
                  "#Productivity",
                  "#Art",
                ].map((tag) => (
                  <Pressable
                    key={tag}
                    onPress={() => setSearchText(tag)}
                    className="rounded-full border border-border bg-card px-4 py-2"
                  >
                    <Text className="text-sm text-foreground">{tag}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </ScrollView>
        )}
      </SafeArea>

      <ChannelFilterSheet
        visible={channelSheetVisible}
        channels={channels}
        selectedIds={selectedChannelIds}
        onClose={() => setChannelSheetVisible(false)}
        onProceed={setSelectedChannelIds}
      />
      <AlbumFilterSheet
        visible={albumSheetVisible}
        selected={albumFilter}
        onClose={() => setAlbumSheetVisible(false)}
        onProceed={setAlbumFilter}
      />
    </View>
  );
}
