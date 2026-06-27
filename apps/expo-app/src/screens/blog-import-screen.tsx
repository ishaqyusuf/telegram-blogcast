import { SafeArea } from "@/components/safe-area";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { useColors } from "@/hooks/use-color";
import { normalizeTrpcUrl } from "@/lib/base-url";
import {
  buildLocalApiBaseUrl,
  checkLocalApiBaseUrl,
  getCurrentLocalApiIp,
  LOCAL_API_PORT,
  normalizeLocalApiIpInput,
  resolveReachableLocalApi,
  type LocalApiIpSource,
} from "@/lib/local-api-ip-cache";
import { useAppSettingsStore } from "@/store/app-settings-store";
import { trpcFetch } from "@/trpc/fetch";
import type { AppRouter } from "@api/trpc/routers/_app";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Text,
  TextInput,
  View,
} from "react-native";
import superjson from "superjson";

type ChannelRow = {
  id: number;
  title: string | null;
  username: string;
  isFetchable?: boolean | null;
  stats?: { totalBlogs?: number | null };
};

type FetcherState = {
  status?: string;
  channelId?: number | null;
  totalFetched?: number;
  error?: string | null;
};

function stripTrpcPath(value: string) {
  return value
    .trim()
    .replace(/\/api\/trpc\/?$/, "")
    .replace(/\/+$/, "");
}

function getInitialLocalApiIp(savedIp: string | null, savedUrl: string | null) {
  return (
    savedIp || normalizeLocalApiIpInput(savedUrl) || getCurrentLocalApiIp()
  );
}

function createLocalApiClient(baseUrl: string) {
  return createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: normalizeTrpcUrl(baseUrl),
        fetch: trpcFetch,
        transformer: superjson as any,
      }),
    ],
  });
}

function formatIpSource(source?: LocalApiIpSource) {
  if (source === "last") return "last used IP";
  if (source === "current") return "current local IP";
  if (source === "history") return "saved IP history";
  if (source === "manual") return "manual IP";
  return "local IP";
}

export default function BlogImportScreen() {
  const router = useRouter();
  const colors = useColors();
  const savedLocalApiBaseUrl = useAppSettingsStore((s) => s.localApiBaseUrl);
  const setLocalApiBaseUrl = useAppSettingsStore((s) => s.setLocalApiBaseUrl);
  const localApiLastIp = useAppSettingsStore((s) => s.localApiLastIp);
  const localApiIpHistory = useAppSettingsStore((s) => s.localApiIpHistory);
  const rememberLocalApiIp = useAppSettingsStore((s) => s.rememberLocalApiIp);
  const [apiIpInput, setApiIpInput] = useState(() =>
    getInitialLocalApiIp(localApiLastIp, savedLocalApiBaseUrl),
  );
  const [baseUrl, setBaseUrl] = useState(() => {
    const initialIp = getInitialLocalApiIp(
      localApiLastIp,
      savedLocalApiBaseUrl,
    );
    return initialIp ? buildLocalApiBaseUrl(initialIp) : "";
  });
  const [status, setStatus] = useState<
    "idle" | "checking" | "online" | "offline"
  >("idle");
  const [message, setMessage] = useState("");
  const [channels, setChannels] = useState<ChannelRow[]>([]);
  const [fetcherState, setFetcherState] = useState<FetcherState | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [attemptLabel, setAttemptLabel] = useState("");
  const [audioLinkInput, setAudioLinkInput] = useState("");
  const [directImportMessage, setDirectImportMessage] = useState("");
  const didAutoConnect = useRef(false);

  const trpcClient = useMemo(() => {
    if (!baseUrl.trim()) return null;
    return createLocalApiClient(baseUrl);
  }, [baseUrl]);

  const cleanBaseUrl = stripTrpcPath(baseUrl);

  const loadApiState = useCallback(
    async (nextBaseUrl: string, source?: LocalApiIpSource) => {
      const cleanUrl = stripTrpcPath(nextBaseUrl);
      if (!cleanUrl) {
        setStatus("offline");
        setMessage("Enter your local API IP, for example 192.168.1.20.");
        return;
      }

      setStatus("checking");
      const nextIp = normalizeLocalApiIpInput(cleanUrl);
      setAttemptLabel(nextIp ? `Checking ${nextIp}` : "");
      setMessage("");
      try {
        const ok = await checkLocalApiBaseUrl(cleanUrl);
        if (!ok) throw new Error("Health check failed.");
        const client = createLocalApiClient(cleanUrl);
        const [nextChannels, nextFetcherState] = await Promise.all([
          client.channel.getChannels.query(),
          client.channel.getFetcherState.query(),
        ]);
        setChannels(nextChannels as ChannelRow[]);
        setFetcherState(nextFetcherState as FetcherState);
        setBaseUrl(cleanUrl);
        if (nextIp) setApiIpInput(nextIp);
        setStatus("online");
        setMessage(
          `Local API connected using ${formatIpSource(source)}. Import continues in the API process after you start it.`,
        );
        setLocalApiBaseUrl(cleanUrl);
        if (nextIp) rememberLocalApiIp(nextIp);
      } catch (error) {
        setStatus("offline");
        setMessage(
          error instanceof Error
            ? error.message
            : "Could not reach the local API.",
        );
      } finally {
        setAttemptLabel("");
      }
    },
    [rememberLocalApiIp, setLocalApiBaseUrl],
  );

  const autoConnect = useCallback(async () => {
    setStatus("checking");
    setChannels([]);
    setFetcherState(null);
    setMessage(`Looking for the local API on port ${LOCAL_API_PORT}.`);
    const resolved = await resolveReachableLocalApi({
      lastUsedIp: localApiLastIp,
      history: localApiIpHistory,
      onAttempt: (candidate) => {
        setApiIpInput(candidate.ip);
        setAttemptLabel(
          `Trying ${candidate.ip} (${formatIpSource(candidate.source)})`,
        );
      },
    });

    if (resolved) {
      await loadApiState(resolved.baseUrl, resolved.source);
      return;
    }

    setStatus("offline");
    setAttemptLabel("");
    setMessage("No saved local API IP responded. Enter your Mac LAN IP below.");
  }, [loadApiState, localApiIpHistory, localApiLastIp]);

  const connectManualIp = useCallback(async () => {
    const ip = normalizeLocalApiIpInput(apiIpInput);
    if (!ip) {
      setStatus("offline");
      setMessage("Enter your local API IP, for example 192.168.1.20.");
      return;
    }
    await loadApiState(buildLocalApiBaseUrl(ip), "manual");
  }, [apiIpInput, loadApiState]);

  useEffect(() => {
    if (didAutoConnect.current) return;
    didAutoConnect.current = true;
    autoConnect();
  }, [autoConnect]);

  useEffect(() => {
    if (
      fetcherState?.status !== "running" &&
      fetcherState?.status !== "retrying"
    )
      return;
    const interval = setInterval(() => {
      trpcClient?.channel.getFetcherState
        .query()
        .then((state) => {
          setFetcherState(state as FetcherState);
        })
        .catch(() => {});
    }, 3000);
    return () => clearInterval(interval);
  }, [fetcherState?.status, trpcClient]);

  async function runAction(label: string, fn: () => Promise<unknown>) {
    if (!trpcClient) return;
    setBusyAction(label);
    try {
      await fn();
      await loadApiState(cleanBaseUrl);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action failed.");
    } finally {
      setBusyAction(null);
    }
  }

  function startFetch(channel: ChannelRow) {
    runAction(`start-${channel.id}`, () =>
      trpcClient!.channel.startFetch.mutate({ channelId: channel.id }),
    );
  }

  function toggleFetchable(channel: ChannelRow) {
    runAction(`toggle-${channel.id}`, () =>
      trpcClient!.channel.toggleFetchable.mutate({
        channelId: channel.id,
        isFetchable: !channel.isFetchable,
      }),
    );
  }

  function importAudioLink() {
    const url = audioLinkInput.trim();
    if (!url) {
      setDirectImportMessage("Paste a Telegram audio post link first.");
      return;
    }

    runAction("import-audio-link", async () => {
      const result = await trpcClient!.channel.importTelegramAudioLink.mutate({
        url,
      });
      setDirectImportMessage(
        result.status === "duplicate"
          ? `Already saved as blog #${result.blogId}.`
          : `Saved audio as blog #${result.blogId}.`,
      );
      if (result.status === "created") {
        setAudioLinkInput("");
      }
    });
  }

  return (
    <View
      className="flex-1 bg-background"
      style={{ backgroundColor: colors.background }}
    >
      <SafeArea>
        <View className="flex-row items-center gap-3 px-4 py-3">
          <Pressable
            onPress={() => router.back()}
            className="size-9 items-center justify-center rounded-full bg-card active:opacity-70"
          >
            <Icon name="ChevronLeft" size={22} className="text-foreground" />
          </Pressable>
          <Text className="flex-1 text-lg font-bold text-foreground">
            Blog Import
          </Text>
          <Pressable
            onPress={autoConnect}
            className="size-9 items-center justify-center rounded-full bg-card active:opacity-70"
          >
            <Icon name="RefreshCcw" size={17} className="text-foreground" />
          </Pressable>
        </View>

        <View className="gap-3 border-b border-border px-4 pb-4">
          <Text className="text-xs font-semibold uppercase text-muted-foreground">
            Local API
          </Text>
          <View className="flex-row items-center gap-2 rounded-xl border border-border bg-card px-3">
            <Icon name="Wifi" size={16} className="text-muted-foreground" />
            <TextInput
              value={apiIpInput}
              onChangeText={setApiIpInput}
              onSubmitEditing={connectManualIp}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="192.168.1.20"
              placeholderTextColor={colors.mutedForeground}
              style={{
                flex: 1,
                color: colors.foreground,
                fontSize: 13,
                paddingVertical: 11,
              }}
            />
            <Pressable
              onPress={connectManualIp}
              disabled={status === "checking"}
              className="size-8 items-center justify-center rounded-full bg-muted active:opacity-70 disabled:opacity-50"
            >
              <Icon name="Check" size={15} className="text-foreground" />
            </Pressable>
          </View>

          <View className="flex-row items-center gap-2">
            <View
              className={`size-2 rounded-full ${
                status === "online"
                  ? "bg-success"
                  : status === "checking"
                    ? "bg-warn"
                    : "bg-destructive"
              }`}
            />
            <Text className="flex-1 text-xs text-muted-foreground">
              {attemptLabel ||
                (status === "online"
                  ? "Connected"
                  : status === "checking"
                    ? "Checking..."
                    : "Not connected")}
            </Text>
            <Text className="text-xs text-muted-foreground">
              {fetcherState?.status ?? "idle"}
              {fetcherState?.totalFetched
                ? ` · ${fetcherState.totalFetched}`
                : ""}
            </Text>
          </View>

          {message ? (
            <Text className="text-xs leading-5 text-muted-foreground">
              {message}
              {status === "offline"
                ? `\nRun: bun --filter @acme/api dev\nExpected port: ${LOCAL_API_PORT}. Use your Mac LAN IP, not localhost, in compiled APK.`
                : ""}
            </Text>
          ) : null}

          <View className="gap-2 rounded-xl border border-border bg-card p-3">
            <View className="flex-row items-center gap-2">
              <Icon name="Link" size={16} className="text-muted-foreground" />
              <Text className="text-xs font-semibold uppercase text-muted-foreground">
                Audio link
              </Text>
            </View>
            <View className="flex-row items-center gap-2 rounded-xl border border-border bg-background px-3">
              <TextInput
                value={audioLinkInput}
                onChangeText={(value) => {
                  setAudioLinkInput(value);
                  setDirectImportMessage("");
                }}
                onSubmitEditing={importAudioLink}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                placeholder="https://t.me/channel/123"
                placeholderTextColor={colors.mutedForeground}
                style={{
                  flex: 1,
                  color: colors.foreground,
                  fontSize: 13,
                  paddingVertical: 11,
                }}
              />
              {audioLinkInput ? (
                <Pressable
                  onPress={() => {
                    setAudioLinkInput("");
                    setDirectImportMessage("");
                  }}
                  className="size-8 items-center justify-center rounded-full bg-muted active:opacity-70"
                >
                  <Icon name="X" size={15} className="text-foreground" />
                </Pressable>
              ) : null}
            </View>
            <Pressable
              onPress={importAudioLink}
              disabled={
                status !== "online" ||
                busyAction != null ||
                !audioLinkInput.trim()
              }
              className="h-10 items-center justify-center rounded-xl bg-primary active:opacity-80 disabled:opacity-50"
            >
              {busyAction === "import-audio-link" ? (
                <ActivityIndicator size="small" />
              ) : (
                <Text className="text-sm font-bold text-primary-foreground">
                  Import audio
                </Text>
              )}
            </Pressable>
            {directImportMessage ? (
              <Text className="text-xs leading-5 text-muted-foreground">
                {directImportMessage}
              </Text>
            ) : null}
          </View>

          <View className="flex-row gap-2">
            <Pressable
              onPress={() =>
                runAction("sync", () =>
                  trpcClient!.channel.syncChannels.mutate(undefined),
                )
              }
              disabled={status !== "online" || busyAction != null}
              className="h-10 flex-1 items-center justify-center rounded-xl bg-muted active:opacity-80 disabled:opacity-50"
            >
              {busyAction === "sync" ? (
                <ActivityIndicator size="small" />
              ) : (
                <Text className="text-sm font-semibold text-foreground">
                  Sync channels
                </Text>
              )}
            </Pressable>
            <Pressable
              onPress={() =>
                runAction("stop", () => trpcClient!.channel.stopFetch.mutate())
              }
              disabled={status !== "online" || busyAction != null}
              className="h-10 flex-1 items-center justify-center rounded-xl bg-muted active:opacity-80 disabled:opacity-50"
            >
              <Text className="text-sm font-semibold text-foreground">
                Stop import
              </Text>
            </Pressable>
          </View>
        </View>

        <FlatList
          style={{ backgroundColor: colors.background }}
          data={channels}
          keyExtractor={(item) => String(item.id)}
          contentContainerClassName="px-4 py-3 pb-8"
          ListEmptyComponent={
            <View className="items-center justify-center py-16">
              <Icon name="Radio" size={42} className="text-muted-foreground" />
              <Text className="mt-3 text-sm text-muted-foreground">
                {status === "online"
                  ? "No channels yet. Sync channels first."
                  : "Connect to local API first."}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const busy =
              busyAction === `start-${item.id}` ||
              busyAction === `toggle-${item.id}`;
            return (
              <View className="mb-2 rounded-xl bg-card p-3">
                <View className="mb-3 flex-row items-center gap-3">
                  <View className="size-10 items-center justify-center rounded-full bg-muted">
                    <Icon
                      name="Radio"
                      size={18}
                      className="text-muted-foreground"
                    />
                  </View>
                  <View className="flex-1">
                    <Text
                      className="text-sm font-bold text-foreground"
                      numberOfLines={1}
                    >
                      {item.title ?? item.username}
                    </Text>
                    <Text className="text-xs text-muted-foreground">
                      @{item.username} · {item.stats?.totalBlogs ?? 0} posts
                    </Text>
                  </View>
                  {busy && <ActivityIndicator size="small" />}
                </View>

                <View className="flex-row gap-2">
                  <Pressable
                    onPress={() => toggleFetchable(item)}
                    disabled={busyAction != null}
                    className="h-9 flex-1 items-center justify-center rounded-lg bg-muted active:opacity-80 disabled:opacity-50"
                  >
                    <Text className="text-xs font-semibold text-foreground">
                      {item.isFetchable ? "Fetchable" : "Mark fetchable"}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => startFetch(item)}
                    disabled={busyAction != null || !item.isFetchable}
                    className="h-9 flex-1 items-center justify-center rounded-lg bg-primary active:opacity-80 disabled:opacity-50"
                  >
                    <Text className="text-xs font-bold text-primary-foreground">
                      Start import
                    </Text>
                  </Pressable>
                </View>
              </View>
            );
          }}
        />
      </SafeArea>
    </View>
  );
}
