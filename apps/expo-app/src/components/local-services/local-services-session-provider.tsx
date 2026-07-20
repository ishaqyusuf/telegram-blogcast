import { SafeArea } from "@/components/safe-area";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import {
	buildLocalServiceUrls,
	getPreferredLocalServiceIp,
	type LocalServiceUrls,
} from "@/lib/local-service-urls";
import {
	getInitialLocalServicesSessionStatus,
	isValidIpv4Address,
	normalizeIpv4Input,
	transitionLocalServicesSession,
	type LocalServicesSessionStatus,
} from "@/lib/local-services-session";
import { getDefaultTranscriberUrl } from "@/lib/transcribe";
import { getCurrentLocalApiIp } from "@/lib/local-api-ip-cache";
import { useAppSettingsStore } from "@/store/app-settings-store";
import {
	createLocalApiClient,
	type LocalApiClient,
} from "@/trpc/local-api-client";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { View } from "react-native";

import { LocalServicesLaunchSheet } from "./local-services-launch-sheet";

type PendingResolution = "enabled" | "disabled" | null;

type LocalServicesSessionValue = {
	status: LocalServicesSessionStatus;
	isEnabled: boolean;
	activeIp: string | null;
	urls: LocalServiceUrls | null;
	localApiClient: LocalApiClient | null;
	requestSetup: () => void;
	enableWithIp: (ip: string) => void;
};

const LocalServicesSessionContext =
	createContext<LocalServicesSessionValue | null>(null);

function getRuntimeAppVariant() {
	const configuredVariant = Constants.expoConfig?.extra?.appVariant;
	if (typeof configuredVariant === "string") return configuredVariant;
	if (process.env.EXPO_PUBLIC_APP_VARIANT) {
		return process.env.EXPO_PUBLIC_APP_VARIANT;
	}
	if (typeof __DEV__ !== "undefined" && __DEV__) return "development";
	return "production";
}

function useAppSettingsHydrated() {
	const [hydrated, setHydrated] = useState(() =>
		useAppSettingsStore.persist.hasHydrated(),
	);

	useEffect(() => {
		if (useAppSettingsStore.persist.hasHydrated()) setHydrated(true);
		return useAppSettingsStore.persist.onFinishHydration(() =>
			setHydrated(true),
		);
	}, []);

	return hydrated;
}

export function LocalServicesSessionProvider({
	children,
}: {
	children: ReactNode;
}) {
	const hydrated = useAppSettingsHydrated();
	const initializedRef = useRef(false);
	const pendingResolutionRef = useRef<PendingResolution>(null);
	const localServicesIp = useAppSettingsStore((state) => state.localServicesIp);
	const localApiLastIp = useAppSettingsStore((state) => state.localApiLastIp);
	const localApiBaseUrl = useAppSettingsStore(
		(state) => state.localApiBaseUrl,
	);
	const localTranscriberBaseUrl = useAppSettingsStore(
		(state) => state.localTranscriberBaseUrl,
	);
	const localApiIpHistory = useAppSettingsStore(
		(state) => state.localApiIpHistory,
	);
	const setLocalServicesIp = useAppSettingsStore(
		(state) => state.setLocalServicesIp,
	);
	const [status, setStatus] =
		useState<LocalServicesSessionStatus>("initializing");
	const [activeIp, setActiveIp] = useState<string | null>(null);

	useEffect(() => {
		if (!hydrated || initializedRef.current) return;
		initializedRef.current = true;

		const initialStatus = getInitialLocalServicesSessionStatus(
			getRuntimeAppVariant(),
		);
		const preferredIp = getPreferredLocalServiceIp({
			manualIp: localServicesIp,
			lastUsedIp: localApiLastIp,
			savedApiBaseUrl: localApiBaseUrl,
			currentIp: getCurrentLocalApiIp(),
		});
		const normalizedPreferredIp = normalizeIpv4Input(preferredIp);
		setActiveIp(
			isValidIpv4Address(normalizedPreferredIp)
				? normalizedPreferredIp
				: null,
		);
		setStatus(initialStatus);
	}, [hydrated, localApiBaseUrl, localApiLastIp, localServicesIp]);

	const urls = useMemo(() => {
		if (!activeIp) return null;
		const derivedUrls = buildLocalServiceUrls(activeIp);
		if (!derivedUrls) return null;
		return {
			...derivedUrls,
			transcriberBaseUrl:
				getDefaultTranscriberUrl(localTranscriberBaseUrl, activeIp) ??
				derivedUrls.transcriberBaseUrl,
		};
	}, [activeIp, localTranscriberBaseUrl]);
	const localApiClient = useMemo(
		() => (urls ? createLocalApiClient(urls.apiBaseUrl) : null),
		[urls],
	);

	const beginResolution = useCallback(
		(nextResolution: Exclude<PendingResolution, null>, ip?: string) => {
			if (ip) {
				const normalizedIp = normalizeIpv4Input(ip);
				if (!isValidIpv4Address(normalizedIp)) return;
				setLocalServicesIp(normalizedIp);
				setActiveIp(normalizedIp);
			}
			pendingResolutionRef.current = nextResolution;
			setStatus((current) =>
				transitionLocalServicesSession(current, "begin-resolution"),
			);
		},
		[setLocalServicesIp],
	);

	const handleSheetDismissed = useCallback(() => {
		const resolution = pendingResolutionRef.current;
		if (!resolution) return;
		pendingResolutionRef.current = null;
		setStatus((current) =>
			transitionLocalServicesSession(
				current,
				resolution === "enabled" ? "finish-enabled" : "finish-disabled",
			),
		);
	}, []);

	const enableWithIp = useCallback(
		(ip: string) => {
			const normalizedIp = normalizeIpv4Input(ip);
			if (!isValidIpv4Address(normalizedIp)) return;
			setLocalServicesIp(normalizedIp);
			setActiveIp(normalizedIp);
			pendingResolutionRef.current = null;
			setStatus("enabled");
		},
		[setLocalServicesIp],
	);

	const value = useMemo<LocalServicesSessionValue>(
		() => ({
			status,
			isEnabled: status === "enabled",
			activeIp,
			urls,
			localApiClient,
			requestSetup: () => {
				pendingResolutionRef.current = null;
				setStatus((current) =>
					transitionLocalServicesSession(current, "request-setup"),
				);
			},
			enableWithIp,
		}),
		[activeIp, enableWithIp, localApiClient, status, urls],
	);

	return (
		<LocalServicesSessionContext.Provider value={value}>
			{children}
			<LocalServicesLaunchSheet
				visible={status === "prompting"}
				activeIp={localServicesIp ?? activeIp}
				history={localApiIpHistory}
				onSelectIp={(ip) => beginResolution("enabled", ip)}
				onSkip={() => beginResolution("disabled")}
				onDismissed={handleSheetDismissed}
			/>
		</LocalServicesSessionContext.Provider>
	);
}

export function useLocalServicesSession() {
	const value = useContext(LocalServicesSessionContext);
	if (!value) {
		throw new Error(
			"useLocalServicesSession must be used inside LocalServicesSessionProvider",
		);
	}
	return value;
}

export function LocalServicesGuard({ children }: { children: ReactNode }) {
	const router = useRouter();
	const { isEnabled, requestSetup } = useLocalServicesSession();

	if (isEnabled) return children;

	return (
		<View className="flex-1 bg-background">
			<SafeArea>
				<View className="flex-row px-4 py-3">
					<Pressable
						haptic
						onPress={() => router.back()}
						accessibilityLabel="Go back"
						className="size-10 items-center justify-center rounded-full bg-card"
					>
						<Icon
							name="ChevronLeft"
							size={21}
							className="text-foreground"
						/>
					</Pressable>
				</View>
				<View className="flex-1 items-center justify-center gap-4 px-8 pb-20">
					<View className="size-14 items-center justify-center rounded-full bg-muted">
						<Icon name="WifiOff" size={24} className="text-foreground" />
					</View>
					<View className="gap-2">
						<Text className="text-center text-xl font-extrabold text-foreground">
							Local services are off
						</Text>
						<Text className="text-center text-sm leading-5 text-muted-foreground">
							Enable a network IP to use Telegram updates, Facebook import,
							and local transcription.
						</Text>
					</View>
					<Pressable
						haptic
						onPress={requestSetup}
						accessibilityLabel="Enable local services"
						className="min-h-12 items-center justify-center rounded-xl bg-primary px-6 active:opacity-80"
					>
						<Text className="text-sm font-bold text-primary-foreground">
							Enable local services
						</Text>
					</Pressable>
				</View>
			</SafeArea>
		</View>
	);
}
