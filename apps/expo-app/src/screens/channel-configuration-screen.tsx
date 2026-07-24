import { FloatingBottomSheet } from "@/components/ui/floating-bottom-sheet";
import { SafeArea } from "@/components/safe-area";
import { _trpc } from "@/components/static-trpc";
import { Button } from "@/components/ui/button";
import { Icon, type IconKeys } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { Switch } from "@/components/ui/switch";
import { useTranslation } from "@/lib/i18n";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@/lib/react-query";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Text,
  View,
} from "react-native";

const CONTENT_TYPES = [
  { value: "text", labelKey: "text", icon: "FilePenLine" },
  { value: "image", labelKey: "image", icon: "Image" },
  { value: "video", labelKey: "video", icon: "PlayCircle" },
  { value: "audio", labelKey: "audio", icon: "AudioLines" },
  { value: "pdf", labelKey: "pdf", icon: "FileText" },
] as const satisfies readonly {
  value: ContentType;
  labelKey: "text" | "image" | "video" | "audio" | "pdf";
  icon: IconKeys;
}[];

type ContentType = "text" | "image" | "video" | "audio" | "pdf";

type ContentFilterChannel = {
  id: number;
  title: string | null;
  username: string;
  contentFilterEnabled: boolean;
  contentFilterTypes: string[];
};

function normalizeTypes(types: readonly string[]) {
  return CONTENT_TYPES.map((item) => item.value).filter((type) =>
    types.includes(type),
  );
}

export default function ChannelConfigurationScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t, isRtl } = useTranslation();
  const [selectedChannel, setSelectedChannel] =
    useState<ContentFilterChannel | null>(null);
  const [draftTypes, setDraftTypes] = useState<ContentType[]>([]);
  const [pendingEnableId, setPendingEnableId] = useState<number | null>(null);
  const [pendingChannelId, setPendingChannelId] = useState<number | null>(null);
  const [screenError, setScreenError] = useState("");
  const [sheetError, setSheetError] = useState("");

  const channelsQuery = useQuery(
    _trpc.channel.getContentFilterChannels.queryOptions(),
  );
  const updateFilter = useMutation(
    _trpc.channel.updateContentFilter.mutationOptions(),
  );

  const channels = (channelsQuery.data ?? []) as ContentFilterChannel[];
  const selectedChannelName =
    selectedChannel?.title?.trim() || selectedChannel?.username || "";

  async function invalidateFilteredContent() {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: _trpc.channel.getContentFilterChannels.queryKey(),
      }),
      queryClient.invalidateQueries({
        queryKey: _trpc.blog.posts.queryKey(),
      }),
      queryClient.invalidateQueries({
        queryKey: _trpc.blog.search.queryKey(),
      }),
    ]);
  }

  function openSelector(channel: ContentFilterChannel, enabling = false) {
    setSelectedChannel(channel);
    setDraftTypes(normalizeTypes(channel.contentFilterTypes));
    setSheetError("");
    setPendingEnableId(enabling ? channel.id : null);
  }

  function closeSelector() {
    setSelectedChannel(null);
    setDraftTypes([]);
    setSheetError("");
    setPendingEnableId(null);
  }

  async function handleSwitch(
    channel: ContentFilterChannel,
    checked: boolean,
  ) {
    await Haptics.selectionAsync();
    setScreenError("");

    if (checked) {
      openSelector(channel, true);
      return;
    }

    setPendingChannelId(channel.id);
    try {
      await updateFilter.mutateAsync({
        channelId: channel.id,
        enabled: false,
      });
      await invalidateFilteredContent();
    } catch (error) {
      setScreenError(
        error instanceof Error ? error.message : t("channelFilterSaveFailed"),
      );
    } finally {
      setPendingChannelId(null);
    }
  }

  async function saveFilter() {
    if (!selectedChannel || draftTypes.length === 0) return;

    setPendingChannelId(selectedChannel.id);
    setSheetError("");
    try {
      await updateFilter.mutateAsync({
        channelId: selectedChannel.id,
        enabled: true,
        types: draftTypes,
      });
      await invalidateFilteredContent();
      closeSelector();
    } catch (error) {
      setSheetError(
        error instanceof Error ? error.message : t("channelFilterSaveFailed"),
      );
    } finally {
      setPendingChannelId(null);
    }
  }

  function toggleDraftType(type: ContentType) {
    void Haptics.selectionAsync();
    setDraftTypes((current) =>
      current.includes(type)
        ? current.filter((item) => item !== type)
        : CONTENT_TYPES.map((item) => item.value).filter(
            (item) => current.includes(item) || item === type,
          ),
    );
  }

  const selectedTypeSet = useMemo(() => new Set(draftTypes), [draftTypes]);
  const savingSelectedChannel =
    selectedChannel != null && pendingChannelId === selectedChannel.id;

  return (
    <View className="flex-1 bg-background">
      <SafeArea>
        <View
          className={
            isRtl
              ? "flex-row-reverse items-center gap-3 px-4 py-3"
              : "flex-row items-center gap-3 px-4 py-3"
          }
        >
          <Pressable
            onPress={() => router.back()}
            className="size-10 items-center justify-center rounded-full bg-card active:opacity-80"
            accessibilityLabel={t("back")}
          >
            <Icon
              name={isRtl ? "ChevronRight" : "ChevronLeft"}
              size={21}
              className="text-foreground"
            />
          </Pressable>
          <View className="flex-1 gap-0.5">
            <Text
              className={
                isRtl
                  ? "text-right text-xl font-extrabold text-foreground"
                  : "text-left text-xl font-extrabold text-foreground"
              }
            >
              {t("channelConfiguration")}
            </Text>
            <Text
              className={
                isRtl
                  ? "text-right text-xs text-muted-foreground"
                  : "text-left text-xs text-muted-foreground"
              }
            >
              {t("channelConfigurationDescription")}
            </Text>
          </View>
        </View>

        {screenError ? (
          <View className="mx-4 mb-2 flex-row items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2.5">
            <Icon name="AlertCircle" size={16} className="text-destructive" />
            <Text className="flex-1 text-xs text-destructive">
              {screenError}
            </Text>
          </View>
        ) : null}

        <FlatList
          data={channels}
          keyExtractor={(item) => String(item.id)}
          contentContainerClassName="px-4 pb-10"
          ItemSeparatorComponent={() => <View className="h-px bg-border" />}
          renderItem={({ item: channel }) => {
            const savedTypes = normalizeTypes(channel.contentFilterTypes);
            const checked =
              channel.contentFilterEnabled || pendingEnableId === channel.id;
            const pending = pendingChannelId === channel.id;
            const channelName = channel.title?.trim() || channel.username;

            return (
              <View
                className={
                  channel.contentFilterEnabled
                    ? "bg-background py-4"
                    : "bg-background py-4 opacity-75"
                }
              >
                <View
                  className={
                    isRtl
                      ? "flex-row-reverse items-start gap-3"
                      : "flex-row items-start gap-3"
                  }
                >
                  <Pressable
                    onPress={() => {
                      if (channel.contentFilterEnabled) openSelector(channel);
                    }}
                    disabled={!channel.contentFilterEnabled || pending}
                    className="flex-1 gap-2 active:opacity-70"
                    accessibilityRole="button"
                    accessibilityLabel={`${channelName}, ${t("channelConfiguration")}`}
                  >
                    <View className="gap-0.5">
                      <Text
                        numberOfLines={1}
                        className={
                          isRtl
                            ? "text-right text-[15px] font-bold text-foreground"
                            : "text-left text-[15px] font-bold text-foreground"
                        }
                      >
                        {channelName}
                      </Text>
                      <Text
                        className={
                          isRtl
                            ? "text-right text-xs text-muted-foreground"
                            : "text-left text-xs text-muted-foreground"
                        }
                      >
                        @{channel.username}
                      </Text>
                    </View>

                    {savedTypes.length > 0 ? (
                      <View className="gap-1">
                        {savedTypes.map((type) => {
                          const option = CONTENT_TYPES.find(
                            (item) => item.value === type,
                          );
                          if (!option) return null;
                          return (
                            <View
                              key={type}
                              className={
                                isRtl
                                  ? "flex-row-reverse items-center gap-1.5"
                                  : "flex-row items-center gap-1.5"
                              }
                            >
                              <Icon
                                name="Check"
                                size={13}
                                className="text-muted-foreground"
                              />
                              <Text className="text-xs text-muted-foreground">
                                {t(option.labelKey)}
                              </Text>
                            </View>
                          );
                        })}
                      </View>
                    ) : (
                      <Text
                        className={
                          isRtl
                            ? "text-right text-xs text-muted-foreground"
                            : "text-left text-xs text-muted-foreground"
                        }
                      >
                        {t("channelFilterNotApplied")}
                      </Text>
                    )}
                  </Pressable>

                  {pending ? (
                    <ActivityIndicator size="small" />
                  ) : (
                    <Switch
                      checked={checked}
                      onCheckedChange={(value) =>
                        void handleSwitch(channel, value)
                      }
                      accessibilityLabel={`${t("channelFilterToggle")} ${channelName}`}
                    />
                  )}
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View className="items-center justify-center gap-3 px-8 py-24">
              {channelsQuery.isPending ? (
                <ActivityIndicator size="large" />
              ) : channelsQuery.isError ? (
                <>
                  <Icon
                    name="AlertCircle"
                    size={38}
                    className="text-muted-foreground"
                  />
                  <Text className="text-center text-sm text-muted-foreground">
                    {t("channelFilterLoadFailed")}
                  </Text>
                  <Button
                    onPress={() => void channelsQuery.refetch()}
                    className="h-10 rounded-xl px-5"
                  >
                    <Text className="text-sm font-bold text-primary-foreground">
                      {t("tryAgain")}
                    </Text>
                  </Button>
                </>
              ) : (
                <>
                  <Icon
                    name="Layers"
                    size={40}
                    className="text-muted-foreground"
                  />
                  <Text className="text-center text-sm text-muted-foreground">
                    {t("noConfigurableChannels")}
                  </Text>
                </>
              )}
            </View>
          }
        />
      </SafeArea>

      <FloatingBottomSheet
        visible={selectedChannel != null}
        onClose={closeSelector}
        title={selectedChannelName}
        accessibilityLabel={t("channelFilterSheetLabel")}
      >
        <View className="bg-card px-4 pb-7">
          <Text
            className={
              isRtl
                ? "mb-3 text-right text-sm text-muted-foreground"
                : "mb-3 text-left text-sm text-muted-foreground"
            }
          >
            {t("channelFilterChooseTypes")}
          </Text>

          <View className="overflow-hidden rounded-2xl border border-border">
            {CONTENT_TYPES.map((option, index) => {
              const selected = selectedTypeSet.has(option.value);
              return (
                <Pressable
                  key={option.value}
                  onPress={() => toggleDraftType(option.value)}
                  className={
                    isRtl
                      ? index < CONTENT_TYPES.length - 1
                        ? "flex-row-reverse items-center gap-3 border-b border-border bg-card px-3 py-3.5 active:bg-muted"
                        : "flex-row-reverse items-center gap-3 bg-card px-3 py-3.5 active:bg-muted"
                      : index < CONTENT_TYPES.length - 1
                        ? "flex-row items-center gap-3 border-b border-border bg-card px-3 py-3.5 active:bg-muted"
                        : "flex-row items-center gap-3 bg-card px-3 py-3.5 active:bg-muted"
                  }
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                >
                  <View className="size-9 items-center justify-center rounded-full bg-secondary">
                    <Icon
                      name={option.icon}
                      size={17}
                      className="text-foreground"
                    />
                  </View>
                  <Text
                    className={
                      isRtl
                        ? "flex-1 text-right text-sm font-semibold text-foreground"
                        : "flex-1 text-left text-sm font-semibold text-foreground"
                    }
                  >
                    {t(option.labelKey)}
                  </Text>
                  {selected ? (
                    <Icon name="Check" size={18} className="text-foreground" />
                  ) : (
                    <View className="size-[18px]" />
                  )}
                </Pressable>
              );
            })}
          </View>

          {draftTypes.length === 0 ? (
            <Text
              className={
                isRtl
                  ? "mt-2 text-right text-xs text-muted-foreground"
                  : "mt-2 text-left text-xs text-muted-foreground"
              }
            >
              {t("channelFilterSelectOne")}
            </Text>
          ) : null}

          {sheetError ? (
            <Text className="mt-2 text-xs text-destructive">{sheetError}</Text>
          ) : null}

          <Button
            onPress={() => void saveFilter()}
            disabled={draftTypes.length === 0 || savingSelectedChannel}
            size="lg"
            className="mt-5 h-12 rounded-xl"
          >
            {savingSelectedChannel ? (
              <ActivityIndicator size="small" />
            ) : (
              <Text className="text-sm font-bold text-primary-foreground">
                {t("save")}
              </Text>
            )}
          </Button>
        </View>
      </FloatingBottomSheet>
    </View>
  );
}
