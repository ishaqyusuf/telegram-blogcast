import Constants from "expo-constants";
import * as Updates from "expo-updates";
import { useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";

export type LaunchAutoUpdatePhase =
  | "idle"
  | "checking"
  | "downloading"
  | "updating"
  | "restarting"
  | "failed";

const STEP_DELAY_MS = 650;
const DEFAULT_FOREGROUND_CHECK_COOLDOWN_MS = 5 * 60 * 1000;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readBooleanFlag(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    return !["0", "false", "off", "no"].includes(value.toLowerCase());
  }
  return fallback;
}

function readPositiveNumber(value: unknown, fallback: number) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "The update could not be applied.";
}

export function useLaunchAutoUpdate() {
  const { downloadProgress } = Updates.useUpdates();
  const [phase, setPhase] = useState<LaunchAutoUpdatePhase>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const isCheckingRef = useRef(false);
  const lastCheckAtRef = useRef(0);
  const extra = Constants.expoConfig?.extra;
  const autoUpdateOnForeground = readBooleanFlag(
    extra?.autoUpdateOnForeground ??
      process.env.EXPO_PUBLIC_AUTO_UPDATE_ON_FOREGROUND,
    true,
  );
  const foregroundCheckCooldownMs = readPositiveNumber(
    extra?.autoUpdateForegroundCooldownMs ??
      process.env.EXPO_PUBLIC_AUTO_UPDATE_FOREGROUND_COOLDOWN_MS,
    DEFAULT_FOREGROUND_CHECK_COOLDOWN_MS,
  );

  useEffect(() => {
    let cancelled = false;
    const setPhaseIfMounted = (nextPhase: LaunchAutoUpdatePhase) => {
      if (!cancelled) setPhase(nextPhase);
    };

    const runUpdateCheck = async (force = false) => {
      if (__DEV__ || !Updates.isEnabled || isCheckingRef.current) return;

      const now = Date.now();
      if (!force && now - lastCheckAtRef.current < foregroundCheckCooldownMs) {
        return;
      }

      isCheckingRef.current = true;
      lastCheckAtRef.current = now;

      setPhaseIfMounted("checking");

      let checkResult: Updates.UpdateCheckResult;
      try {
        checkResult = await Updates.checkForUpdateAsync();
      } catch (error) {
        console.warn("[updates] launch check failed", error);
        setPhaseIfMounted("idle");
        isCheckingRef.current = false;
        return;
      }

      if (!checkResult.isAvailable && !checkResult.isRollBackToEmbedded) {
        setPhaseIfMounted("idle");
        isCheckingRef.current = false;
        return;
      }

      setErrorMessage(null);
      setPhaseIfMounted("downloading");

      try {
        const fetchResult = await Updates.fetchUpdateAsync();

        if (!fetchResult.isNew && !fetchResult.isRollBackToEmbedded) {
          setPhaseIfMounted("idle");
          isCheckingRef.current = false;
          return;
        }

        setPhaseIfMounted("updating");
        await delay(STEP_DELAY_MS);
        setPhaseIfMounted("restarting");
        await delay(STEP_DELAY_MS);
        await Updates.reloadAsync();
      } catch (error) {
        console.warn("[updates] launch update failed", error);
        if (!cancelled) {
          setErrorMessage(getErrorMessage(error));
          setPhase("failed");
        }
      } finally {
        isCheckingRef.current = false;
      }
    };

    void runUpdateCheck(true);

    const subscription = AppState.addEventListener("change", (nextState) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextState;

      const wasBackgrounded =
        previousState === "background" || previousState === "inactive";
      if (
        !autoUpdateOnForeground ||
        nextState !== "active" ||
        !wasBackgrounded
      ) {
        return;
      }

    void runUpdateCheck();
    });

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [autoUpdateOnForeground, foregroundCheckCooldownMs]);

  return {
    dismissFailure: () => {
      setPhase("idle");
      setErrorMessage(null);
    },
    downloadProgress,
    errorMessage,
    phase,
    visible: phase !== "idle" && phase !== "checking",
  };
}
