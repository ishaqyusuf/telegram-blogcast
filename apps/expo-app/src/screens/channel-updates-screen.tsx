import { SafeArea } from "@/components/safe-area";
import { useLocalServicesSession } from "@/components/local-services";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { useQuery } from "@/lib/react-query";
import type { RouterOutputs } from "@api/trpc/routers/_app";
import { useRouter } from "expo-router";
import { ActivityIndicator, ScrollView, View } from "react-native";

type RecentUpdateJob =
  NonNullable<RouterOutputs["channel"]["getRecentUpdateJob"]["activeJob"]>;
type ChannelUpdateItem = RecentUpdateJob["channels"][number];

function formatCount(value: number | null | undefined) {
  if (value === null || value === undefined) return "Unknown";
  return new Intl.NumberFormat().format(value);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString();
}

function statusLabel(status: ChannelUpdateItem["status"]) {
  switch (status) {
    case "queued":
      return "Queued";
    case "running":
      return "Running";
    case "completed":
      return "Completed";
    case "failed":
      return "Failed";
    case "skipped":
      return "Skipped";
    default:
      return "Unknown";
  }
}

function statusBackgroundClass(status: ChannelUpdateItem["status"]) {
  switch (status) {
    case "running":
      return "bg-primary/15";
    case "completed":
      return "bg-secondary";
    case "failed":
      return "bg-destructive/15";
    case "skipped":
      return "bg-muted";
    default:
      return "bg-card";
  }
}

function statusTextClass(status: ChannelUpdateItem["status"]) {
  switch (status) {
    case "running":
      return "text-primary";
    case "completed":
      return "text-secondary-foreground";
    case "failed":
      return "text-destructive";
    default:
      return "text-muted-foreground";
  }
}

function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <View className="flex-1 gap-1 rounded-lg bg-card p-3">
      <Text className="text-xs font-medium text-muted-foreground">{label}</Text>
      <Text className="text-lg font-extrabold text-foreground">{value}</Text>
    </View>
  );
}

function ChannelProgressRow({ channel }: { channel: ChannelUpdateItem }) {
  const latest =
    channel.latestKnownCount === null
      ? "Latest unknown"
      : `Latest: ${formatCount(channel.latestKnownCount)}`;

  return (
    <View className="gap-3 rounded-lg border border-border bg-card p-3">
      <View className="flex-row items-start gap-3">
        <View className="mt-1 size-8 items-center justify-center rounded-full bg-background">
          {channel.status === "running" ? (
            <ActivityIndicator size="small" />
          ) : channel.status === "completed" ? (
            <Icon name="Check" className="size-sm text-primary" />
          ) : channel.status === "failed" ? (
            <Icon name="AlertCircle" className="size-sm text-destructive" />
          ) : (
            <Icon name="Clock" className="size-sm text-muted-foreground" />
          )}
        </View>
        <View className="flex-1 gap-1">
          <View className="flex-row items-start gap-2">
            <Text className="flex-1 text-sm font-bold text-foreground" numberOfLines={2}>
              {channel.title ?? channel.username}
            </Text>
            <View
              className={`rounded-full px-2 py-1 ${statusBackgroundClass(channel.status)}`}
            >
              <Text className={`text-[10px] font-bold ${statusTextClass(channel.status)}`}>
                {statusLabel(channel.status)}
              </Text>
            </View>
          </View>
          <Text className="text-xs text-muted-foreground" numberOfLines={1}>
            @{channel.username}
          </Text>
        </View>
      </View>

      <View className="flex-row flex-wrap gap-x-4 gap-y-1">
        <Text className="text-xs text-muted-foreground">
          Before: {formatCount(channel.beforeCount)}
        </Text>
        <Text className="text-xs text-muted-foreground">{latest}</Text>
        <Text className="text-xs text-muted-foreground">
          Fetched: {formatCount(channel.fetchedCount)}
        </Text>
        <Text className="text-xs text-muted-foreground">
          Saved now: {formatCount(channel.finalStoredCount)}
        </Text>
      </View>

      {(channel.error || channel.skipReason) && (
        <Text className="text-xs font-medium text-destructive">
          {channel.error ?? channel.skipReason}
        </Text>
      )}
    </View>
  );
}

export default function ChannelUpdatesScreen() {
  const router = useRouter();
  const { activeIp, localApiClient } = useLocalServicesSession();
  const { data, isFetching, refetch, error } = useQuery({
    queryKey: ["local-api", activeIp, "channel-update-job"],
    queryFn: () => {
      if (!localApiClient) throw new Error("Local API is not configured.");
      return localApiClient.channel.getRecentUpdateJob.query();
    },
    enabled: Boolean(localApiClient),
    refetchInterval: 1500,
    retry: false,
  });
  const job = data?.activeJob ?? data?.latestCompletedJob ?? null;
  const isRunning = data?.activeJob?.status === "running";

  return (
    <View className="flex-1 bg-background">
      <SafeArea>
        <View className="flex-row items-center gap-3 px-4 py-3">
          <Pressable
            onPress={() => router.back()}
            className="size-10 items-center justify-center rounded-full bg-card"
          >
            <Icon name="ChevronLeft" className="size-md text-foreground" />
          </Pressable>
          <View className="flex-1">
            <Text className="text-xl font-extrabold text-foreground">
              Channel updates
            </Text>
            <Text className="text-xs text-muted-foreground">
              Background fetch progress and analytics
            </Text>
          </View>
          <Pressable
            onPress={() => refetch()}
            className="size-10 items-center justify-center rounded-full bg-card"
          >
            {isFetching ? (
              <ActivityIndicator size="small" />
            ) : (
              <Icon name="RefreshCw" className="size-sm text-foreground" />
            )}
          </Pressable>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerClassName="gap-4 px-4 pb-8"
          showsVerticalScrollIndicator={false}
        >
          {error && (
            <View className="rounded-lg border border-destructive/30 bg-destructive/10 p-3">
              <Text className="text-sm font-semibold text-destructive">
                Local fetcher is unavailable.
              </Text>
              <Text className="mt-1 text-xs text-destructive">
                The latest known job state will appear here when the API is reachable.
              </Text>
            </View>
          )}

          {!job ? (
            <View className="items-center gap-3 rounded-lg bg-card px-4 py-10">
              <View className="size-12 items-center justify-center rounded-full bg-secondary">
                <Icon name="History" className="size-md text-foreground" />
              </View>
              <Text className="text-base font-bold text-foreground">
                No update job yet
              </Text>
              <Text className="text-center text-sm text-muted-foreground">
                When you update selected channels, live progress and totals will appear here.
              </Text>
            </View>
          ) : (
            <>
              <View className="gap-3 rounded-lg bg-card p-4">
                <View className="flex-row items-center gap-3">
                  <View className="size-10 items-center justify-center rounded-full bg-secondary">
                    {isRunning ? (
                      <ActivityIndicator size="small" />
                    ) : (
                      <Icon name="CheckCircle2" className="size-md text-primary" />
                    )}
                  </View>
                  <View className="flex-1">
                    <Text className="text-base font-extrabold text-foreground">
                      {isRunning ? "Update running" : "Last update complete"}
                    </Text>
                    <Text className="text-xs text-muted-foreground">
                      Started {formatDate(job.startedAt)}
                    </Text>
                    {job.finishedAt && (
                      <Text className="text-xs text-muted-foreground">
                        Finished {formatDate(job.finishedAt)}
                      </Text>
                    )}
                  </View>
                </View>

                <View className="flex-row gap-2">
                  <StatBox label="Channels" value={job.selectedCount} />
                  <StatBox label="New chats" value={formatCount(job.totalNewChats)} />
                </View>
                <View className="flex-row gap-2">
                  <StatBox label="Done" value={job.completedCount} />
                  <StatBox label="Failed" value={job.failedCount} />
                  <StatBox label="Skipped" value={job.skippedCount} />
                </View>
              </View>

              <View className="gap-2">
                <Text className="px-1 text-sm font-bold text-foreground">
                  Channels
                </Text>
                {job.channels.map((channel) => (
                  <ChannelProgressRow
                    key={`${job.id}-${channel.channelId}`}
                    channel={channel}
                  />
                ))}
              </View>
            </>
          )}
        </ScrollView>
      </SafeArea>
    </View>
  );
}
