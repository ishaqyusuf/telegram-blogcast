import { Modal, useModal } from "@/components/ui/modal";
import { _trpc } from "@/components/static-trpc";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { useMutation, useQueryClient } from "@/lib/react-query";
import type { RouterOutputs } from "@api/trpc/routers/_app";
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { Pressable } from "@/components/ui/pressable";

type SummaryChannel =
  RouterOutputs["channel"]["getUpdatePromptSummary"]["channels"][number];

let didRunPromptThisSession = false;

function formatCount(value: number | null | undefined) {
  if (value === null || value === undefined) return "Unknown";
  return new Intl.NumberFormat().format(value);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString();
}

function getDeltaLabel(channel: SummaryChannel) {
  if (channel.delta === null) return "Check available";
  if (channel.delta <= 0) return "Up to date";
  return `+${formatCount(channel.delta)} new`;
}

function ChannelRow({
  channel,
  selected,
  onToggle,
}: {
  channel: SummaryChannel;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable
      onPress={onToggle}
      className="min-h-16 flex-row items-center gap-3 rounded-lg border border-border bg-card px-3 py-3 active:opacity-80"
    >
      <View
        className={
          selected
            ? "size-7 items-center justify-center rounded-md bg-primary"
            : "size-7 items-center justify-center rounded-md border border-border bg-background"
        }
      >
        {selected && <Icon name="Check" className="size-sm text-primary-foreground" />}
      </View>
      <View className="flex-1 gap-1">
        <View className="flex-row items-center gap-2">
          <Text className="flex-1 text-sm font-bold text-foreground" numberOfLines={1}>
            {channel.title ?? channel.username}
          </Text>
          <Text
            className={
              channel.delta && channel.delta > 0
                ? "text-xs font-bold text-primary"
                : "text-xs font-semibold text-muted-foreground"
            }
          >
            {getDeltaLabel(channel)}
          </Text>
        </View>
        <Text className="text-xs text-muted-foreground" numberOfLines={1}>
          @{channel.username}
        </Text>
        <View className="flex-row flex-wrap gap-x-3 gap-y-1">
          <Text className="text-[11px] text-muted-foreground">
            Saved: {formatCount(channel.storedCount)}
          </Text>
          <Text className="text-[11px] text-muted-foreground">
            Latest: {formatCount(channel.latestKnownCount)}
          </Text>
          <Text className="text-[11px] text-muted-foreground">
            Last: {formatDate(channel.lastFetchedAt)}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

export function ChannelUpdatePrompt() {
  const modal = useModal();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [channels, setChannels] = useState<SummaryChannel[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [waitingForLogin, setWaitingForLogin] = useState(false);
  const [loginMessage, setLoginMessage] = useState<string | null>(null);

  const selectedCount = selectedIds.size;
  const updateMutation = useMutation(
    _trpc.channel.startRecentUpdateJob.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: _trpc.channel.getRecentUpdateJob.queryKey(),
        });
        modal.dismiss();
        router.push("/channel-updates" as any);
      },
    }),
  );

  const loadPrompt = async (mountedRef?: { current: boolean }) => {
    setLoading(true);
    setWaitingForLogin(false);
    setLoginMessage(null);
    try {
      await queryClient.fetchQuery(_trpc.channel.pingFetcher.queryOptions());
      const authStatus = await queryClient.fetchQuery(
        _trpc.channel.telegramAuthStatus.queryOptions(),
      );
      if (mountedRef && !mountedRef.current) return;

      if (!authStatus.authorized) {
        setChannels([]);
        setSelectedIds(new Set());
        setWaitingForLogin(true);
        setLoginMessage(authStatus.error);
        requestAnimationFrame(() => modal.present());
        return;
      }

      const summary = await queryClient.fetchQuery(
        _trpc.channel.getUpdatePromptSummary.queryOptions(),
      );
      if (mountedRef && !mountedRef.current) return;
      if (summary.channels.length === 0) return;

      setChannels(summary.channels);
      setSelectedIds(
        new Set(
          summary.channels
            .filter((channel) => channel.delta !== null && channel.delta > 0)
            .map((channel) => channel.channelId),
        ),
      );
      requestAnimationFrame(() => modal.present());
    } catch {
      // Local API/fetcher is unavailable. Startup should stay silent.
    } finally {
      if (!mountedRef || mountedRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    if (didRunPromptThisSession) return;
    didRunPromptThisSession = true;

    const mountedRef = { current: true };
    void loadPrompt(mountedRef);

    return () => {
      mountedRef.current = false;
    };
  }, [modal, queryClient]);

  const toggleChannel = (channelId: number) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(channelId)) next.delete(channelId);
      else next.add(channelId);
      return next;
    });
  };

  const selectedChannelIds = useMemo(
    () => Array.from(selectedIds),
    [selectedIds],
  );

  const startUpdate = () => {
    if (
      waitingForLogin ||
      selectedChannelIds.length === 0 ||
      updateMutation.isPending
    )
      return;
    updateMutation.mutate({ channelIds: selectedChannelIds });
  };

  return (
    <Modal ref={modal.ref} title="Channel updates available" snapPoints={["55%"]}>
      <View className="flex-1 gap-3 bg-background px-4 pb-4">
        <View className="gap-1">
          <Text className="text-sm text-muted-foreground">
            Select channels to fetch recent chats in the background.
          </Text>
          {loading && (
            <View className="flex-row items-center gap-2">
              <ActivityIndicator size="small" />
              <Text className="text-xs text-muted-foreground">
                Checking local fetcher
              </Text>
            </View>
          )}
        </View>

        {waitingForLogin ? (
          <View className="flex-1 items-center justify-center gap-3 rounded-lg border border-border bg-card px-4 py-8">
            <View className="size-10 items-center justify-center rounded-full bg-secondary">
              <Icon name="Lock" className="size-sm text-foreground" />
            </View>
            <Text className="text-center text-base font-bold text-foreground">
              Waiting for Telegram login
            </Text>
            <Text className="text-center text-sm text-muted-foreground">
              Open the website, log in with Telegram, then come back and check
              again.
            </Text>
            {loginMessage && (
              <Text className="text-center text-xs text-muted-foreground">
                {loginMessage}
              </Text>
            )}
          </View>
        ) : (
          <BottomSheetScrollView
            className="flex-1"
            contentContainerStyle={{ gap: 8, paddingBottom: 8 }}
            showsVerticalScrollIndicator={false}
          >
            {channels.map((channel) => (
              <ChannelRow
                key={channel.channelId}
                channel={channel}
                selected={selectedIds.has(channel.channelId)}
                onToggle={() => toggleChannel(channel.channelId)}
              />
            ))}
          </BottomSheetScrollView>
        )}

        <View className="gap-2 border-t border-border pt-3">
          {waitingForLogin ? (
            <Button
              disabled={loading}
              onPress={() => void loadPrompt()}
              className="min-h-11"
            >
              {loading ? <ActivityIndicator size="small" /> : <Text>Check again</Text>}
            </Button>
          ) : (
            <Button
              disabled={selectedCount === 0 || updateMutation.isPending}
              onPress={startUpdate}
              className="min-h-11"
            >
              {updateMutation.isPending ? (
                <ActivityIndicator size="small" />
              ) : (
                <Text>
                  {selectedCount === 0
                    ? "Update selected"
                    : `Update ${selectedCount} channel${selectedCount === 1 ? "" : "s"}`}
                </Text>
              )}
            </Button>
          )}
          <View className="flex-row gap-2">
            <Button
              variant="outline"
              onPress={() => modal.dismiss()}
              className="min-h-11 flex-1"
            >
              <Text>Not now</Text>
            </Button>
            <Button
              variant="ghost"
              onPress={() => {
                modal.dismiss();
                router.push("/channel-updates" as any);
              }}
              className="min-h-11 flex-1"
            >
              <Text>View progress</Text>
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
}
