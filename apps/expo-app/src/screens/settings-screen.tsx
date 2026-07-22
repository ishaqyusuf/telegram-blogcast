import { SafeArea } from "@/components/safe-area";
import { useLocalServicesSession } from "@/components/local-services";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { useColorScheme, useColors } from "@/hooks/use-color";
import { useTranslation } from "@/lib/i18n";
import { getLocalApiQueryKey } from "@/lib/local-api-query";
import {
  isValidIpv4Address,
  normalizeIpv4Input,
} from "@/lib/local-services-session";
import { useQuery } from "@/lib/react-query";
import { setThemeOverride } from "@/lib/theme-preference";
import { isHttpTranscriberUrl } from "@/lib/transcribe";
import { LOCAL_API_PORT } from "@/lib/local-service-urls";
import {
  TRANSCRIPTION_MODELS,
  formatTranscriptionCost,
} from "@/lib/transcription-models";
import type { AppLanguage } from "@/store/app-settings-store";
import { useAppSettingsStore } from "@/store/app-settings-store";
import * as Haptics from "expo-haptics";
import { type Href, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";

const LANGUAGES: AppLanguage[] = ["en", "ar"];

export default function SettingsScreen() {
  const router = useRouter();
  const {
    activeIp,
    connectionStatus,
    enableWithIp,
    ipMode,
    isEnabled: localServicesEnabled,
    localApiClient,
    requestSetup: requestLocalServicesSetup,
    retryConnection,
    urls: localServiceUrls,
  } = useLocalServicesSession();
  const colors = useColors();
  const { colorScheme, setColorScheme } = useColorScheme();
  const { language, setLanguage, t, textAlign, writingDirection, isRtl } =
    useTranslation();
  const transcriptionModel = useAppSettingsStore((s) => s.transcriptionModel);
  const setTranscriptionModel = useAppSettingsStore(
    (s) => s.setTranscriptionModel,
  );
  const localApiIpHistory = useAppSettingsStore((s) => s.localApiIpHistory);
  const resolvedTranscriberUrl = localServiceUrls?.transcriberBaseUrl ?? null;
  const [localServicesIpInput, setLocalServicesIpInput] = useState(
    activeIp ?? "",
  );
  const [localServicesIpMessage, setLocalServicesIpMessage] = useState("");
  const canCheckTranscriber = isHttpTranscriberUrl(resolvedTranscriberUrl);
  const { data: transcriberHealth, isFetching: checkingTranscriber } = useQuery(
    {
      queryKey: getLocalApiQueryKey(activeIp, "blog.checkLocalTranscriber", {
        baseUrl: canCheckTranscriber
          ? (resolvedTranscriberUrl ?? undefined)
          : undefined,
      }),
      queryFn: () =>
        localApiClient!.blog.checkLocalTranscriber.query({
          baseUrl: canCheckTranscriber
            ? (resolvedTranscriberUrl ?? undefined)
            : undefined,
        }),
      enabled:
        localServicesEnabled &&
        connectionStatus === "online" &&
        Boolean(localApiClient) &&
        canCheckTranscriber,
      retry: false,
    },
  );
  const whisperAvailable =
    connectionStatus === "online" && Boolean(transcriberHealth?.ok);

  useEffect(() => {
    setLocalServicesIpInput(activeIp ?? "");
  }, [activeIp]);

  function saveAndCheckLocalServicesIp() {
    if (ipMode === "automatic") {
      retryConnection();
      return;
    }
    const normalizedIp = normalizeIpv4Input(localServicesIpInput);
    if (!isValidIpv4Address(normalizedIp)) {
      setLocalServicesIpMessage("Enter a valid IPv4 address.");
      return;
    }
    enableWithIp(normalizedIp);
    const apiBaseUrl = `http://${normalizedIp}:${LOCAL_API_PORT}`;
    setLocalServicesIpMessage(
      `Saved ${apiBaseUrl}. The app will reconnect automatically.`,
    );
  }

  useEffect(() => {
    if (transcriptionModel !== "whisper-local") {
      setTranscriptionModel("whisper-local");
    }
  }, [setTranscriptionModel, transcriptionModel]);

  async function toggleColorScheme() {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const nextScheme = colorScheme === "dark" ? "light" : "dark";
    await setThemeOverride(nextScheme);
    setColorScheme(nextScheme);
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
            className="size-9 items-center justify-center rounded-full bg-card"
          >
            <Icon name="ChevronLeft" size={22} className="text-foreground" />
          </Pressable>
          <Text
            className="text-foreground"
            style={{
              flex: 1,
              textAlign,
              fontSize: 22,
              fontWeight: "800",
              writingDirection,
            }}
          >
            {t("settings")}
          </Text>
        </View>

        <ScrollView
          style={{ backgroundColor: colors.background }}
          contentContainerClassName="gap-4 px-4 pt-2 pb-8"
          keyboardShouldPersistTaps="handled"
        >
          <Pressable
            onPress={toggleColorScheme}
            className="flex-row items-center gap-3 rounded-xl bg-card p-4 active:opacity-80"
          >
            <View className="size-10 items-center justify-center rounded-full bg-secondary">
              <Icon
                name={colorScheme === "dark" ? "Sun" : "Moon"}
                size={18}
                className="text-foreground"
              />
            </View>
            <View className="flex-1 gap-1">
              <Text
                className="text-foreground"
                style={{
                  textAlign,
                  fontSize: 15,
                  fontWeight: "700",
                  writingDirection,
                }}
              >
                Appearance
              </Text>
              <Text
                className="text-muted-foreground"
                style={{
                  textAlign,
                  fontSize: 13,
                  lineHeight: 19,
                  writingDirection,
                }}
              >
                Switch to {colorScheme === "dark" ? "light" : "dark"} mode.
              </Text>
            </View>
            <Icon
              name={isRtl ? "ChevronLeft" : "ChevronRight"}
              size={18}
              className="text-muted-foreground"
            />
          </Pressable>

          <Pressable
            onPress={() => {
              if (!localServicesEnabled) {
                requestLocalServicesSetup();
                return;
              }
              router.push("/transcribe-queue" as Href);
            }}
            className={
              localServicesEnabled
                ? "flex-row items-center gap-3 rounded-xl bg-card p-4 active:opacity-80"
                : "flex-row items-center gap-3 rounded-xl bg-card p-4 opacity-60"
            }
          >
            <View className="size-10 items-center justify-center rounded-full bg-secondary">
              <Icon name="Captions" size={18} className="text-foreground" />
            </View>
            <View className="flex-1 gap-1">
              <Text
                className="text-foreground"
                style={{
                  textAlign,
                  fontSize: 15,
                  fontWeight: "700",
                  writingDirection,
                }}
              >
                Transcribe queue
              </Text>
              <Text
                className="text-muted-foreground"
                style={{
                  textAlign,
                  fontSize: 13,
                  lineHeight: 19,
                  writingDirection,
                }}
              >
                {localServicesEnabled
                  ? "Review local audio transcription jobs and progress."
                  : "Enable local services to review transcription jobs."}
              </Text>
            </View>
            <Icon
              name={isRtl ? "ChevronLeft" : "ChevronRight"}
              size={18}
              className="text-muted-foreground"
            />
          </Pressable>

          <Pressable
            onPress={() => router.push("/updates" as Href)}
            className="flex-row items-center gap-3 rounded-xl bg-card p-4 active:opacity-80"
          >
            <View className="size-10 items-center justify-center rounded-full bg-secondary">
              <Icon name="RefreshCw" size={18} className="text-foreground" />
            </View>
            <View className="flex-1 gap-1">
              <Text
                className="text-foreground"
                style={{
                  textAlign,
                  fontSize: 15,
                  fontWeight: "700",
                  writingDirection,
                }}
              >
                App updates
              </Text>
              <Text
                className="text-muted-foreground"
                style={{
                  textAlign,
                  fontSize: 13,
                  lineHeight: 19,
                  writingDirection,
                }}
              >
                Check, download, and restart into published EAS updates.
              </Text>
            </View>
            <Icon
              name={isRtl ? "ChevronLeft" : "ChevronRight"}
              size={18}
              className="text-muted-foreground"
            />
          </Pressable>

          <Pressable
            onPress={() => {
              if (!localServicesEnabled) {
                requestLocalServicesSetup();
                return;
              }
              router.push("/facebook-import" as Href);
            }}
            className={
              localServicesEnabled
                ? "flex-row items-center gap-3 rounded-xl bg-card p-4 active:opacity-80"
                : "flex-row items-center gap-3 rounded-xl bg-card p-4 opacity-60"
            }
          >
            <View className="size-10 items-center justify-center rounded-full bg-secondary">
              <Icon name="Download" size={18} className="text-foreground" />
            </View>
            <View className="flex-1 gap-1">
              <Text
                className="text-foreground"
                style={{
                  textAlign,
                  fontSize: 15,
                  fontWeight: "700",
                  writingDirection,
                }}
              >
                Facebook Import
              </Text>
              <Text
                className="text-muted-foreground"
                style={{
                  textAlign,
                  fontSize: 13,
                  lineHeight: 19,
                  writingDirection,
                }}
              >
                {localServicesEnabled
                  ? "Download saved Facebook media and attach Telegram file IDs."
                  : "Enable local services to import Facebook media."}
              </Text>
            </View>
            <Icon
              name={isRtl ? "ChevronLeft" : "ChevronRight"}
              size={18}
              className="text-muted-foreground"
            />
          </Pressable>

          <Pressable
            onPress={() => router.push("/album-organizer" as Href)}
            className="flex-row items-center gap-3 rounded-xl bg-card p-4 active:opacity-80"
          >
            <View className="size-10 items-center justify-center rounded-full bg-secondary">
              <Icon name="Sparkles" size={18} className="text-foreground" />
            </View>
            <View className="flex-1 gap-1">
              <Text
                className="text-foreground"
                style={{
                  textAlign,
                  fontSize: 15,
                  fontWeight: "700",
                  writingDirection,
                }}
              >
                Album Organizer
              </Text>
              <Text
                className="text-muted-foreground"
                style={{
                  textAlign,
                  fontSize: 13,
                  lineHeight: 19,
                  writingDirection,
                }}
              >
                Find saved AI album discoveries by channel and approve tracks.
              </Text>
            </View>
            <Icon
              name={isRtl ? "ChevronLeft" : "ChevronRight"}
              size={18}
              className="text-muted-foreground"
            />
          </Pressable>

          <View className="gap-3 rounded-xl bg-card p-4">
            <View
              className="flex-row items-center gap-3"
              style={{ flexDirection: isRtl ? "row-reverse" : "row" }}
            >
              <View className="size-10 items-center justify-center rounded-full bg-secondary">
                <Icon name="Wifi" size={18} className="text-foreground" />
              </View>
              <View className="flex-1">
                <Text
                  className="text-foreground"
                  style={{
                    textAlign,
                    fontSize: 15,
                    fontWeight: "700",
                    writingDirection,
                  }}
                >
                  Local services IP
                </Text>
                <Text
                  className="text-muted-foreground"
                  style={{
                    textAlign,
                    fontSize: 13,
                    lineHeight: 19,
                    writingDirection,
                  }}
                >
                  Use one LAN IP for Telegram updates, transcription, and
                  Facebook import.
                </Text>
                <Text className="mt-1 text-xs font-semibold text-muted-foreground">
                  {ipMode === "automatic"
                    ? "Automatic in development"
                    : localServicesEnabled
                      ? "Enabled for this session"
                      : "Disabled for this session"}
                </Text>
              </View>
            </View>

            <View className="flex-row items-center gap-2 rounded-xl border border-border bg-background px-3">
              <Icon
                name="HardDrive"
                size={16}
                className="text-muted-foreground"
              />
              <TextInput
                value={localServicesIpInput}
                onChangeText={setLocalServicesIpInput}
                onSubmitEditing={() => void saveAndCheckLocalServicesIp()}
                editable={ipMode === "manual"}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="192.168.1.20"
                placeholderTextColor={colors.mutedForeground}
                style={{
                  flex: 1,
                  color: colors.foreground,
                  fontSize: 13,
                  paddingVertical: 10,
                  textAlign: "left",
                }}
              />
              <Pressable
                onPress={() => {
                  void saveAndCheckLocalServicesIp();
                }}
                className="size-8 items-center justify-center rounded-full bg-muted active:opacity-70"
              >
                <Icon
                  name={ipMode === "automatic" ? "RefreshCw" : "Check"}
                  size={15}
                  className="text-foreground"
                />
              </Pressable>
            </View>

            <Text className="text-xs font-semibold text-muted-foreground">
              Local API: {connectionStatus}
            </Text>

            {localServicesIpMessage ? (
              <Text className="text-xs text-muted-foreground">
                {localServicesIpMessage}
              </Text>
            ) : null}

            {ipMode === "manual" && localApiIpHistory.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8 }}
              >
                {localApiIpHistory.map((ip) => (
                  <Pressable
                    key={ip}
                    onPress={() => {
                      setLocalServicesIpInput(ip);
                      enableWithIp(ip);
                    }}
                    className="rounded-full bg-secondary px-3 py-2 active:opacity-70"
                  >
                    <Text className="text-xs font-semibold text-foreground">
                      {ip}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}

            <View className="gap-1">
              <Text className="text-xs text-muted-foreground">
                API: {localServiceUrls?.apiBaseUrl ?? "Not set"}
              </Text>
              <Text className="text-xs text-muted-foreground">
                Transcriber: {localServiceUrls?.transcriberBaseUrl ?? "Not set"}
              </Text>
              <Text className="text-xs text-muted-foreground">
                Facebook:{" "}
                {localServiceUrls?.facebookMediaBridgeBaseUrl ?? "Not set"}
              </Text>
            </View>
          </View>

          <View className="gap-2 rounded-xl bg-card p-4">
            <Text
              className="text-foreground"
              style={{
                textAlign,
                fontSize: 15,
                fontWeight: "700",
                writingDirection,
              }}
            >
              {t("language")}
            </Text>
            <Text
              className="text-muted-foreground"
              style={{
                textAlign,
                fontSize: 13,
                lineHeight: 20,
                writingDirection,
              }}
            >
              {t("settingsDescription")}
            </Text>

            <View
              className="gap-2 pt-2"
              style={{ flexDirection: isRtl ? "row-reverse" : "row" }}
            >
              {LANGUAGES.map((item) => {
                const selected = language === item;
                return (
                  <Pressable
                    key={item}
                    onPress={() => setLanguage(item)}
                    className={
                      selected
                        ? "flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-primary py-3"
                        : "flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-secondary py-3"
                    }
                  >
                    {selected ? (
                      <Icon
                        name="Check"
                        size={16}
                        className="text-background"
                      />
                    ) : null}
                    <Text
                      className={
                        selected
                          ? "text-sm font-bold text-primary-foreground"
                          : "text-sm font-semibold text-foreground"
                      }
                    >
                      {item === "en" ? t("english") : t("arabic")}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View className="gap-3 rounded-xl bg-card p-4">
            <View
              className="flex-row items-center gap-3"
              style={{ flexDirection: isRtl ? "row-reverse" : "row" }}
            >
              <View className="size-10 items-center justify-center rounded-full bg-secondary">
                <Icon name="FileText" size={18} className="text-foreground" />
              </View>
              <View className="flex-1">
                <Text
                  className="text-foreground"
                  style={{
                    textAlign,
                    fontSize: 15,
                    fontWeight: "700",
                    writingDirection,
                  }}
                >
                  Transcription model
                </Text>
                <Text
                  className="text-muted-foreground"
                  style={{
                    textAlign,
                    fontSize: 13,
                    lineHeight: 19,
                    writingDirection,
                  }}
                >
                  Choose the default model used from audio screens.
                </Text>
              </View>
            </View>

            <View className="gap-2">
              {TRANSCRIPTION_MODELS.filter(
                (model) => model.id === "whisper-local",
              ).map((model) => {
                const selected = transcriptionModel === model.id;
                const disabled =
                  model.requiresLocalTranscriber && !whisperAvailable;
                return (
                  <Pressable
                    key={model.id}
                    disabled={disabled}
                    onPress={() => setTranscriptionModel(model.id)}
                    className={
                      selected
                        ? "rounded-xl border border-primary bg-primary/10 p-3"
                        : "rounded-xl border border-border bg-secondary p-3"
                    }
                    style={{ opacity: disabled ? 0.45 : 1 }}
                  >
                    <View
                      className="flex-row items-center gap-3"
                      style={{ flexDirection: isRtl ? "row-reverse" : "row" }}
                    >
                      <Icon
                        name={selected ? "CheckCircle2" : "Circle"}
                        size={18}
                        className={
                          selected ? "text-primary" : "text-muted-foreground"
                        }
                      />
                      <View className="flex-1">
                        <Text
                          className="text-foreground"
                          style={{
                            textAlign,
                            fontSize: 14,
                            fontWeight: "700",
                            writingDirection,
                          }}
                        >
                          {model.label}
                        </Text>
                        <Text
                          className="text-muted-foreground"
                          style={{
                            textAlign,
                            fontSize: 12,
                            lineHeight: 17,
                            writingDirection,
                          }}
                        >
                          {disabled
                            ? "Start the local transcriber to enable this model."
                            : `${model.description} ${formatTranscriptionCost(60, model.costPerMin)} / min`}
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            <View className="gap-2 rounded-xl border border-border bg-background p-3">
              <View
                className="flex-row items-center gap-2"
                style={{ flexDirection: isRtl ? "row-reverse" : "row" }}
              >
                <View
                  className={
                    whisperAvailable
                      ? "size-2 rounded-full bg-success"
                      : "size-2 rounded-full bg-destructive"
                  }
                />
                <Text
                  className="flex-1 text-muted-foreground"
                  style={{ textAlign, fontSize: 12, writingDirection }}
                >
                  {checkingTranscriber
                    ? "Checking local Whisper..."
                    : whisperAvailable
                      ? `Local Whisper online: ${transcriberHealth?.model ?? "ready"}`
                      : "Local Whisper offline"}
                </Text>
              </View>
              <TextInput
                value={resolvedTranscriberUrl ?? ""}
                editable={false}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="http://192.168.1.20:8787"
                className="rounded-lg bg-muted px-3 py-2 text-foreground"
                style={{ textAlign: "left", fontSize: 13 }}
              />
            </View>
          </View>
        </ScrollView>
      </SafeArea>
    </View>
  );
}
