import { Pressable } from "@/components/ui/pressable";
import { SafeArea } from "@/components/safe-area";
import { _trpc } from "@/components/static-trpc";
import { Icon } from "@/components/ui/icon";
import { useTranslation } from "@/lib/i18n";
import {
  formatTranscriptionCost,
  TRANSCRIPTION_MODELS,
} from "@/lib/transcription-models";
import { getDefaultTranscriberUrl, isHttpTranscriberUrl } from "@/lib/transcribe";
import { useQuery } from "@/lib/react-query";
import type { AppLanguage } from "@/store/app-settings-store";
import { useAppSettingsStore } from "@/store/app-settings-store";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";

const LANGUAGES: AppLanguage[] = ["en", "ar"];

export default function SettingsScreen() {
  const router = useRouter();
  const { language, setLanguage, t, textAlign, writingDirection, isRtl } =
    useTranslation();
  const transcriptionModel = useAppSettingsStore((s) => s.transcriptionModel);
  const setTranscriptionModel = useAppSettingsStore((s) => s.setTranscriptionModel);
  const localTranscriberBaseUrl = useAppSettingsStore((s) => s.localTranscriberBaseUrl);
  const setLocalTranscriberBaseUrl = useAppSettingsStore((s) => s.setLocalTranscriberBaseUrl);
  const resolvedTranscriberUrl = getDefaultTranscriberUrl(localTranscriberBaseUrl);
  const [transcriberUrlInput, setTranscriberUrlInput] = useState(
    localTranscriberBaseUrl ?? resolvedTranscriberUrl ?? "",
  );
  const canCheckTranscriber = isHttpTranscriberUrl(resolvedTranscriberUrl);
  const { data: transcriberHealth, isFetching: checkingTranscriber } = useQuery({
    ..._trpc.blog.checkLocalTranscriber.queryOptions({
      baseUrl: canCheckTranscriber ? resolvedTranscriberUrl ?? undefined : undefined,
    }),
    enabled: canCheckTranscriber,
    retry: false,
  });
  const whisperAvailable = Boolean(transcriberHealth?.ok);

  useEffect(() => {
    setTranscriberUrlInput(localTranscriberBaseUrl ?? resolvedTranscriberUrl ?? "");
  }, [localTranscriberBaseUrl, resolvedTranscriberUrl]);

  return (
    <View className="flex-1 bg-background">
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
          contentContainerClassName="gap-4 px-4 pt-2 pb-8"
          keyboardShouldPersistTaps="handled"
        >
          <Pressable
            onPress={() => router.push("/updates" as any)}
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
                      <Icon name="Check" size={16} className="text-background" />
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
              {TRANSCRIPTION_MODELS.map((model) => {
                const selected = transcriptionModel === model.id;
                const disabled = model.requiresLocalTranscriber && !whisperAvailable;
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
                        className={selected ? "text-primary" : "text-muted-foreground"}
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
                value={transcriberUrlInput}
                onChangeText={(value) => {
                  setTranscriberUrlInput(value);
                  setLocalTranscriberBaseUrl(value.trim() ? value.trim() : null);
                }}
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
