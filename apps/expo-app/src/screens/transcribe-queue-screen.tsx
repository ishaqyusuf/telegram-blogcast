import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";

import { SafeArea } from "@/components/safe-area";
import { Pressable } from "@/components/ui/pressable";
import { Icon } from "@/components/ui/icon";
import { useColors } from "@/hooks/use-color";
import { withAlpha } from "@/lib/theme";
import {
  getTranscriptionJobProgress,
  useTranscriptionQueue,
} from "@/hooks/use-transcription-queue";

function formatRange(fromSec?: number | null, toSec?: number | null) {
  if (fromSec == null && toSec == null) return "Full audio";
  const from = fromSec ?? 0;
  return `${from}s-${toSec ?? "end"}s`;
}

function formatDate(value?: Date | null) {
  if (!value) return "";
  return value.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function cleanTitle(value?: string | null) {
  const trimmed = value?.replace(/\s+/g, " ").trim();
  return trimmed ? trimmed : null;
}

function getQueueJobTitle(
  job: ReturnType<typeof useTranscriptionQueue>["jobs"][number],
) {
  return (
    cleanTitle(job.media?.title) ??
    cleanTitle(job.media?.file?.fileName) ??
    cleanTitle(job.media?.blog?.content) ??
    `Media #${job.mediaId}`
  );
}

function formatJobStage(
  job: ReturnType<typeof useTranscriptionQueue>["jobs"][number],
) {
  const stage = cleanTitle(job.stage)?.replace(/_/g, " ");
  const chunk =
    job.currentChunk && job.totalChunks
      ? `Chunk ${job.currentChunk}/${job.totalChunks}`
      : null;
  return [stage, chunk].filter(Boolean).join(" · ");
}

export default function TranscribeQueueScreen() {
  const router = useRouter();
  const colors = useColors();
  const { jobs, queuedCount, isRunning, runQueued, reload } =
    useTranscriptionQueue();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const counts = useMemo(
    () =>
      jobs.reduce(
        (acc, job) => {
          acc[job.status] = (acc[job.status] ?? 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      ),
    [jobs],
  );
  const overallProgress = useMemo(() => {
    if (jobs.length === 0) return 0;
    const total = jobs.reduce(
      (sum, job) => sum + getTranscriptionJobProgress(job),
      0,
    );
    return Math.round(total / jobs.length);
  }, [jobs]);
  const refresh = async () => {
    setIsRefreshing(true);
    try {
      await reload();
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <View
      className="flex-1 bg-background"
      style={{ backgroundColor: colors.background }}
    >
      <SafeArea>
        <View className="flex-row items-center gap-3 border-b border-border px-4 py-3">
          <Pressable
            className="min-h-11 min-w-11 items-center justify-center rounded-full active:bg-muted"
            onPress={() => router.back()}
          >
            <Icon name="ArrowLeft" className="text-foreground" />
          </Pressable>
          <View className="min-w-0 flex-1">
            <Text
              className="text-xl font-bold text-foreground"
              style={{ color: colors.foreground }}
            >
              Transcribe Queue
            </Text>
            <Text
              className="text-xs font-medium text-muted-foreground"
              style={{ color: colors.mutedForeground }}
            >
              {jobs.length} jobs · {queuedCount} waiting · {overallProgress}%
            </Text>
          </View>
          <Pressable
            className="min-h-11 rounded-full bg-primary px-4 items-center justify-center active:opacity-80"
            disabled={isRunning}
            onPress={() => {
              void runQueued();
            }}
            style={{
              backgroundColor: isRunning ? colors.muted : colors.primary,
            }}
          >
            <Text
              className="text-sm font-bold"
              style={{
                color: isRunning
                  ? colors.mutedForeground
                  : colors.primaryForeground,
              }}
            >
              {isRunning ? "Refreshing" : "Refresh"}
            </Text>
          </Pressable>
        </View>

        <View className="flex-row gap-2 px-4 py-3">
          {["queued", "running", "completed", "failed"].map((status) => (
            <View
              key={status}
              className="rounded-full px-2.5 py-1"
              style={{ backgroundColor: withAlpha(colors.primary, 0.1) }}
            >
              <Text
                className="text-[11px] font-semibold text-primary"
                style={{ color: colors.primary }}
              >
                {status} {counts[status] ?? 0}
              </Text>
            </View>
          ))}
        </View>

        {jobs.length > 0 ? (
          <View className="px-4 pb-3">
            <View
              className="h-2 overflow-hidden rounded-full bg-muted"
              style={{ backgroundColor: colors.muted }}
            >
              <View
                className="h-full rounded-full bg-primary"
                style={{
                  backgroundColor: colors.primary,
                  width: `${overallProgress}%`,
                }}
              />
            </View>
          </View>
        ) : null}

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 40 }}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => {
                void refresh();
              }}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        >
          {jobs.length === 0 ? (
            <View className="items-center justify-center px-8 py-16">
              <View
                className="mb-4 size-14 items-center justify-center rounded-full"
                style={{ backgroundColor: withAlpha(colors.primary, 0.12) }}
              >
                <Icon name="Captions" className="text-primary" />
              </View>
              <Text
                className="text-center text-base font-bold text-foreground"
                style={{ color: colors.foreground }}
              >
                No transcriptions queued
              </Text>
              <Text
                className="mt-2 text-center text-sm leading-5 text-muted-foreground"
                style={{ color: colors.mutedForeground }}
              >
                Open an audio post menu and choose Queue for transcribe.
              </Text>
            </View>
          ) : (
            <View className="gap-2 px-4">
              {jobs.map((job) => (
                (() => {
                  const progress = getTranscriptionJobProgress(job);
                  const title = getQueueJobTitle(job);
                  const stage = formatJobStage(job);
                  const blogId = job.media?.blog?.id;
                  return (
                    <Pressable
                      key={job.id}
                      className="rounded-xl border border-border bg-card p-4"
                      disabled={!blogId}
                      onPress={() => {
                        if (blogId) {
                          router.push(`/blog-view-2/${blogId}` as any);
                        }
                      }}
                      style={{
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                        opacity: blogId ? 1 : 0.85,
                      }}
                    >
                      <View className="flex-row items-center gap-3">
                        <View
                          className="size-10 items-center justify-center rounded-full"
                          style={{
                            backgroundColor:
                              job.status === "failed"
                                ? withAlpha(colors.destructive, 0.12)
                                : withAlpha(colors.primary, 0.12),
                          }}
                        >
                          {job.status === "running" ? (
                            <ActivityIndicator color={colors.primary} />
                          ) : (
                            <Icon
                              name={
                                job.status === "completed"
                                  ? "CheckCircle2"
                                  : job.status === "failed"
                                    ? "AlertCircle"
                                    : "Captions"
                              }
                              className={
                                job.status === "failed"
                                  ? "text-destructive"
                                  : "text-primary"
                              }
                            />
                          )}
                        </View>
                        <View className="min-w-0 flex-1">
                          <Text
                            className="text-sm font-bold text-foreground"
                            numberOfLines={1}
                            style={{ color: colors.foreground }}
                          >
                            {title}
                          </Text>
                          <Text
                            className="mt-0.5 text-xs text-muted-foreground"
                            numberOfLines={1}
                            style={{ color: colors.mutedForeground }}
                          >
                            {formatRange(job.fromSec, job.toSec)} ·{" "}
                            {formatDate(job.createdAt)}
                          </Text>
                          {stage ? (
                            <Text
                              className="mt-0.5 text-xs capitalize text-muted-foreground"
                              numberOfLines={1}
                              style={{ color: colors.mutedForeground }}
                            >
                              {stage}
                            </Text>
                          ) : null}
                        </View>
                        <View className="items-end gap-0.5">
                          {blogId ? (
                            <Icon
                              name="ChevronRight"
                              size={15}
                              className="text-muted-foreground"
                            />
                          ) : null}
                          <Text
                            className="text-xs font-bold capitalize text-muted-foreground"
                            style={{ color: colors.mutedForeground }}
                          >
                            {job.status}
                          </Text>
                          <Text
                            className="text-xs font-bold text-foreground"
                            style={{ color: colors.foreground }}
                          >
                            {progress}%
                          </Text>
                        </View>
                      </View>
                      <View
                        className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"
                        style={{ backgroundColor: colors.muted }}
                      >
                        <View
                          className="h-full rounded-full bg-primary"
                          style={{
                            backgroundColor:
                              job.status === "failed"
                                ? colors.destructive
                                : colors.primary,
                            width: `${progress}%`,
                          }}
                        />
                      </View>
                      {job.errorMessage ? (
                        <Text
                          className="mt-3 text-xs leading-5 text-destructive"
                          style={{ color: colors.destructive }}
                        >
                          {job.errorMessage}
                        </Text>
                      ) : null}
                    </Pressable>
                  );
                })()
              ))}
            </View>
          )}
        </ScrollView>
      </SafeArea>
    </View>
  );
}
