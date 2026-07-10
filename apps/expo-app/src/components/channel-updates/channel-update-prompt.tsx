import { Modal, useModal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { useMutation, useQueryClient } from "@/lib/react-query";
import { storage } from "@/store/mmkv";
import { useTRPC } from "@/trpc/client";
import type { RouterOutputs } from "@api/trpc/routers/_app";
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  View,
} from "react-native";
import { Pressable } from "@/components/ui/pressable";

type SummaryChannel =
  RouterOutputs["channel"]["getUpdatePromptSummary"]["channels"][number];
type AuthStep = "checking" | "authorized" | "phone" | "otp" | "unavailable";

let didRunPromptThisSession = false;
const TELEGRAM_LOGIN_PHONE_KEY = "telegram_login_phone";

function formatCount(value: number | null | undefined) {
  if (value === null || value === undefined) return "Unknown";
  return String(value);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  try {
    return date.toLocaleString();
  } catch {
    return date.toISOString();
  }
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
        {selected && (
          <Icon name="Check" className="size-sm text-primary-foreground" />
        )}
      </View>
      <View className="flex-1 gap-1">
        <View className="flex-row items-center gap-2">
          <Text
            className="flex-1 text-sm font-bold text-foreground"
            numberOfLines={1}
          >
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

function OtpInput({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const refs = useRef<(TextInput | null)[]>([]);
  const digits = value.padEnd(5, " ").slice(0, 5).split("");

  const updateDigit = (index: number, text: string) => {
    const onlyDigits = text.replace(/\D/g, "");
    if (onlyDigits.length > 1) {
      const next = onlyDigits.slice(0, 5);
      onChange(next);
      refs.current[Math.min(next.length, 4)]?.focus();
      return;
    }

    const next = digits.map((digit) => (digit === " " ? "" : digit));
    next[index] = onlyDigits;
    onChange(next.join("").slice(0, 5));
    if (onlyDigits && index < 4) refs.current[index + 1]?.focus();
  };

  const handleBackspace = (index: number) => {
    if (digits[index] !== " ") return;
    refs.current[Math.max(index - 1, 0)]?.focus();
  };

  return (
    <View className="flex-row justify-center gap-2">
      {digits.map((digit, index) => (
        <TextInput
          key={index}
          ref={(ref) => {
            refs.current[index] = ref;
          }}
          editable={!disabled}
          keyboardType="number-pad"
          maxLength={index === 0 ? 5 : 1}
          onChangeText={(text) => updateDigit(index, text)}
          onKeyPress={({ nativeEvent }) => {
            if (nativeEvent.key === "Backspace") handleBackspace(index);
          }}
          selectTextOnFocus
          textContentType="oneTimeCode"
          value={digit === " " ? "" : digit}
          className="h-12 w-11 rounded-lg border border-border bg-background text-center text-xl font-extrabold text-foreground"
        />
      ))}
    </View>
  );
}

export function ChannelUpdatePrompt() {
  const modal = useModal();
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [channels, setChannels] = useState<SummaryChannel[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [authStep, setAuthStep] = useState<AuthStep>("checking");
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [rememberedPhone, setRememberedPhone] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otpCode, setOtpCode] = useState("");

  const selectedCount = selectedIds.size;
  const updateMutation = useMutation(
    trpc.channel.startRecentUpdateJob.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.channel.getRecentUpdateJob.queryKey(),
        });
        modal.dismiss();
        router.push("/channel-updates" as any);
      },
    }),
  );
  const sendCodeMutation = useMutation(
    trpc.channel.telegramSendCode.mutationOptions({
      onSuccess: (result) => {
        if (result.authorized) {
          void loadPrompt();
          return;
        }

        setOtpCode("");
        setAuthMessage(null);
        setAuthStep("otp");
      },
      onError: (error) => {
        setAuthMessage(error.message);
      },
    }),
  );
  const verifyCodeMutation = useMutation(
    trpc.channel.telegramVerifyCode.mutationOptions({
      onSuccess: (result) => {
        if (!result.ok) {
          setAuthMessage(
            result.needs2FA
              ? "This Telegram account requires a password. Password login is not supported here yet."
              : result.error,
          );
          return;
        }

        queryClient.invalidateQueries({
          queryKey: trpc.channel.telegramAuthStatus.queryKey(),
        });
        void loadPrompt();
      },
      onError: (error) => {
        setAuthMessage(error.message);
      },
    }),
  );

  useEffect(() => {
    let mounted = true;
    storage
      .getString(TELEGRAM_LOGIN_PHONE_KEY)
      .then((value) => {
        if (!mounted || !value) return;
        setRememberedPhone(value);
        setPhoneNumber(value);
      })
      .catch((error) => {
        console.warn("[channel-updates] remembered phone read failed", error);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const presentPrompt = useCallback(() => {
    const present = () => {
      try {
        modal.present();
      } catch (error) {
        console.warn("[channel-updates] prompt present failed", error);
      }
    };

    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(present);
      return;
    }

    setTimeout(present, 0);
  }, [modal]);

  const loadPrompt = useCallback(
    async (mountedRef?: { current: boolean }) => {
      setLoading(true);
      setAuthStep("checking");
      setAuthMessage(null);
      try {
        try {
          await queryClient.fetchQuery(
            trpc.channel.pingFetcher.queryOptions(),
          );
        } catch {
          if (mountedRef && !mountedRef.current) return;
          setChannels([]);
          setSelectedIds(new Set());
          setAuthStep("unavailable");
          setAuthMessage(
            "The local API is not reachable. Start the local fetcher and try again.",
          );
          if (mountedRef) return;
          presentPrompt();
          return;
        }

        const authStatus = await queryClient.fetchQuery(
          trpc.channel.telegramAuthStatus.queryOptions(),
        );
        if (mountedRef && !mountedRef.current) return;

        if (!authStatus.authorized) {
          setChannels([]);
          setSelectedIds(new Set());
          setAuthStep("phone");
          setAuthMessage(authStatus.error);
          presentPrompt();
          return;
        }

        const summary = await queryClient.fetchQuery(
          trpc.channel.getUpdatePromptSummary.queryOptions(),
        );
        if (mountedRef && !mountedRef.current) return;
        setAuthStep("authorized");
        if (summary.channels.length === 0) return;

        setChannels(summary.channels);
        setSelectedIds(
          new Set(
            summary.channels
              .filter((channel) => channel.delta !== null && channel.delta > 0)
              .map((channel) => channel.channelId),
          ),
        );
        presentPrompt();
      } catch {
        if (mountedRef && !mountedRef.current) return;
        setChannels([]);
        setSelectedIds(new Set());
        setAuthStep("unavailable");
        setAuthMessage("Unable to check Telegram updates right now.");
        if (mountedRef) return;
        presentPrompt();
      } finally {
        if (!mountedRef || mountedRef.current) setLoading(false);
      }
    },
    [presentPrompt, queryClient, trpc],
  );

  useEffect(() => {
    if (didRunPromptThisSession) return;
    didRunPromptThisSession = true;

    const mountedRef = { current: true };
    void loadPrompt(mountedRef);

    return () => {
      mountedRef.current = false;
    };
  }, [loadPrompt]);

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

  const handlePhoneChange = (value: string) => {
    setPhoneNumber(value);
    void storage.set(TELEGRAM_LOGIN_PHONE_KEY, value);
  };

  const submitPhone = () => {
    const trimmed = phoneNumber.trim();
    if (!trimmed || sendCodeMutation.isPending) return;

    setRememberedPhone(trimmed);
    setAuthMessage(null);
    void storage.set(TELEGRAM_LOGIN_PHONE_KEY, trimmed);
    sendCodeMutation.mutate({ phoneNumber: trimmed });
  };

  const submitOtp = () => {
    const trimmedPhone = phoneNumber.trim();
    const trimmedCode = otpCode.trim();
    if (!trimmedPhone || trimmedCode.length < 4 || verifyCodeMutation.isPending)
      return;

    setAuthMessage(null);
    verifyCodeMutation.mutate({
      phoneNumber: trimmedPhone,
      code: trimmedCode,
    });
  };

  const startUpdate = () => {
    if (
      authStep !== "authorized" ||
      selectedChannelIds.length === 0 ||
      updateMutation.isPending
    )
      return;
    updateMutation.mutate({ channelIds: selectedChannelIds });
  };

  const isBusy =
    loading || sendCodeMutation.isPending || verifyCodeMutation.isPending;

  return (
    <Modal
      ref={modal.ref}
      title="Channel updates available"
      snapPoints={authStep === "authorized" ? ["55%"] : ["72%"]}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <View className="flex-1 gap-3 bg-background px-4 pb-4">
          <View className="gap-1">
            <Text className="text-sm text-muted-foreground">
              {authStep === "authorized"
                ? "Select channels to fetch recent chats in the background."
                : "Connect Telegram on this local fetcher to enable channel updates."}
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

          {authStep === "unavailable" ? (
            <View className="flex-1 items-center justify-center gap-3 rounded-lg border border-border bg-card px-4 py-8">
              <View className="size-10 items-center justify-center rounded-full bg-secondary">
                <Icon name="WifiOff" className="size-sm text-foreground" />
              </View>
              <Text className="text-center text-base font-bold text-foreground">
                Local fetcher unavailable
              </Text>
              <Text className="text-center text-sm text-muted-foreground">
                Start the local API, then check again.
              </Text>
              {authMessage && (
                <Text className="text-center text-xs text-muted-foreground">
                  {authMessage}
                </Text>
              )}
            </View>
          ) : authStep === "phone" ? (
            <View className="flex-1 items-center justify-center gap-3 rounded-lg border border-border bg-card px-4 py-8">
              <View className="size-10 items-center justify-center rounded-full bg-secondary">
                <Icon name="Lock" className="size-sm text-foreground" />
              </View>
              <Text className="text-center text-base font-bold text-foreground">
                Log in with Telegram
              </Text>
              <Text className="text-center text-sm text-muted-foreground">
                Enter the phone number connected to the Telegram account that
                can read these channels.
              </Text>
              <Input
                key={rememberedPhone || "telegram-phone"}
                defaultValue={rememberedPhone}
                editable={!isBusy}
                keyboardType="phone-pad"
                onChangeText={handlePhoneChange}
                placeholder="+234 000 000 0000"
                textContentType="telephoneNumber"
                className="mt-2 min-h-12 text-center text-base font-semibold"
              />
              {authMessage && (
                <Text className="text-center text-xs text-muted-foreground">
                  {authMessage}
                </Text>
              )}
            </View>
          ) : authStep === "otp" ? (
            <View className="flex-1 items-center justify-center gap-3 rounded-lg border border-border bg-card px-4 py-8">
              <View className="size-10 items-center justify-center rounded-full bg-secondary">
                <Icon name="Lock" className="size-sm text-foreground" />
              </View>
              <Text className="text-center text-base font-bold text-foreground">
                Enter Telegram code
              </Text>
              <Text className="text-center text-sm text-muted-foreground">
                Telegram sent a login code to {phoneNumber.trim()}.
              </Text>
              <OtpInput
                value={otpCode}
                onChange={setOtpCode}
                disabled={isBusy}
              />
              {authMessage && (
                <Text className="text-center text-xs text-destructive">
                  {authMessage}
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
            {authStep === "unavailable" ? (
              <Button
                disabled={loading}
                onPress={() => void loadPrompt()}
                className="min-h-11"
              >
                {loading ? (
                  <ActivityIndicator size="small" />
                ) : (
                  <Text>Check again</Text>
                )}
              </Button>
            ) : authStep === "phone" ? (
              <Button
                disabled={!phoneNumber.trim() || sendCodeMutation.isPending}
                onPress={submitPhone}
                className="min-h-11"
              >
                {sendCodeMutation.isPending ? (
                  <ActivityIndicator size="small" />
                ) : (
                  <Text>Send login code</Text>
                )}
              </Button>
            ) : authStep === "otp" ? (
              <View className="gap-2">
                <Button
                  disabled={
                    otpCode.trim().length < 4 || verifyCodeMutation.isPending
                  }
                  onPress={submitOtp}
                  className="min-h-11"
                >
                  {verifyCodeMutation.isPending ? (
                    <ActivityIndicator size="small" />
                  ) : (
                    <Text>Verify code</Text>
                  )}
                </Button>
                <Button
                  variant="outline"
                  disabled={verifyCodeMutation.isPending}
                  onPress={() => {
                    setOtpCode("");
                    setAuthMessage(null);
                    setAuthStep("phone");
                  }}
                  className="min-h-11"
                >
                  <Text>Use another number</Text>
                </Button>
              </View>
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
      </KeyboardAvoidingView>
    </Modal>
  );
}
