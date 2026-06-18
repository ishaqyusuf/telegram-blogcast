import { Modal, useModal } from "@/components/ui/modal";
import { _trpc } from "@/components/static-trpc";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { useMutation, useQueryClient } from "@/lib/react-query";
import type { RouterOutputs } from "@api/trpc/routers/_app";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, View } from "react-native";
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

  useEffect(() => {
    if (didRunPromptThisSession) return;
    didRunPromptThisSession = true;

    let mounted = true;
    setLoading(true);
    (async () => {
      try {
        await queryClient.fetchQuery(_trpc.channel.pingFetcher.queryOptions());
        const summary = await queryClient.fetchQuery(
          _trpc.channel.getUpdatePromptSummary.queryOptions(),
        );
        if (!mounted || summary.channels.length === 0) return;

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
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
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
    if (selectedChannelIds.length === 0 || updateMutation.isPending) return;
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

        <ScrollView
          className="flex-1"
          contentContainerClassName="gap-2 pb-2"
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
        </ScrollView>

        <View className="gap-2 border-t border-border pt-3">
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
