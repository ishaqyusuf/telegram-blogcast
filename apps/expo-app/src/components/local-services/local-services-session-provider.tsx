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
	isValidIpv4Address,
	normalizeIpv4Input,
	resolveInitialLocalServicesSession,
	shouldProbeLocalServices,
	type LocalServicesConnectionStatus,
	transitionLocalServicesSession,
	type LocalServicesIpMode,
	type LocalServicesSessionStatus,
} from "@/lib/local-services-session";
import {
	checkLocalApiBaseUrl,
	getCurrentLocalApiIp,
} from "@/lib/local-api-ip-cache";
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
import { AppState, View } from "react-native";

import { LocalServicesLaunchSheet } from "./local-services-launch-sheet";

type PendingResolution = "enabled" | "disabled" | null;

type LocalServicesSessionValue = {
	status: LocalServicesSessionStatus;
	isEnabled: boolean;
	ipMode: LocalServicesIpMode;
	connectionStatus: LocalServicesConnectionStatus;
	activeIp: string | null;
	urls: LocalServiceUrls | null;
	localApiClient: LocalApiClient | null;
	requestSetup: () => void;
	enableWithIp: (ip: string) => void;
	retryConnection: () => void;
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
	const localApiIpHistory = useAppSettingsStore(
		(state) => state.localApiIpHistory,
	);
	const setLocalServicesIp = useAppSettingsStore(
		(state) => state.setLocalServicesIp,
	);
	const [status, setStatus] =
		useState<LocalServicesSessionStatus>("initializing");
	const [ipMode, setIpMode] = useState<LocalServicesIpMode>("manual");
	const [connectionStatus, setConnectionStatus] =
		useState<LocalServicesConnectionStatus>("offline");
	const [activeIp, setActiveIp] = useState<string | null>(null);
	const connectionAttemptRef = useRef(0);

	useEffect(() => {
		if (!hydrated || initializedRef.current) return;
		initializedRef.current = true;

		const appVariant = getRuntimeAppVariant();
		const preferredIp = getPreferredLocalServiceIp({
			manualIp: localServicesIp,
			lastUsedIp: localApiLastIp,
			savedApiBaseUrl: localApiBaseUrl,
		});
		const initial = resolveInitialLocalServicesSession({
			appVariant,
			currentIp: getCurrentLocalApiIp(),
			preferredSavedIp: preferredIp,
		});
		setIpMode(initial.ipMode);
		setActiveIp(initial.activeIp);
		setConnectionStatus(
			initial.status === "enabled" && initial.activeIp
				? "checking"
				: "offline",
		);
		setStatus(initial.status);
	}, [hydrated, localApiBaseUrl, localApiLastIp, localServicesIp]);

	const urls = useMemo(() => {
		if (!activeIp) return null;
		return buildLocalServiceUrls(activeIp);
	}, [activeIp]);
	const localApiClient = useMemo(
		() => (urls ? createLocalApiClient(urls.apiBaseUrl) : null),
		[urls],
	);

	const retryConnection = useCallback(async () => {
		if (status !== "enabled" || !urls) {
			setConnectionStatus("offline");
			return;
		}

		const attempt = ++connectionAttemptRef.current;
		setConnectionStatus("checking");
		try {
			const online = await checkLocalApiBaseUrl(urls.apiBaseUrl);
			if (connectionAttemptRef.current === attempt) {
				setConnectionStatus(online ? "online" : "offline");
			}
		} catch {
			if (connectionAttemptRef.current === attempt) {
				setConnectionStatus("offline");
			}
		}
	}, [status, urls]);

	useEffect(() => {
		if (status !== "enabled" || !urls) {
			connectionAttemptRef.current += 1;
			setConnectionStatus("offline");
			return;
		}
		void retryConnection();
	}, [retryConnection, status, urls]);

	useEffect(() => {
		if (
			!shouldProbeLocalServices({
				status,
				hasActiveIp: Boolean(activeIp),
				connectionStatus,
				trigger: "offline-retry",
			})
		)
			return;
		const timer = setTimeout(() => void retryConnection(), 5_000);
		return () => clearTimeout(timer);
	}, [activeIp, connectionStatus, retryConnection, status]);

	useEffect(() => {
		const subscription = AppState.addEventListener("change", (nextState) => {
			if (
				nextState === "active" &&
				shouldProbeLocalServices({
					status,
					hasActiveIp: Boolean(activeIp),
					connectionStatus,
					trigger: "foreground",
				})
			) {
				void retryConnection();
			}
		});
		return () => subscription.remove();
	}, [activeIp, connectionStatus, retryConnection, status]);

	const beginResolution = useCallback(
		(nextResolution: Exclude<PendingResolution, null>, ip?: string) => {
			if (ip) {
				const normalizedIp = normalizeIpv4Input(ip);
				if (!isValidIpv4Address(normalizedIp)) return;
				setLocalServicesIp(normalizedIp);
				setActiveIp(normalizedIp);
				setConnectionStatus("checking");
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
		setConnectionStatus(
			resolution === "enabled" ? "checking" : "offline",
		);
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
			setConnectionStatus("checking");
			pendingResolutionRef.current = null;
			setStatus("enabled");
		},
		[setLocalServicesIp],
	);

	const value = useMemo<LocalServicesSessionValue>(
		() => ({
			status,
			isEnabled: status === "enabled",
			ipMode,
			connectionStatus,
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
			retryConnection: () => void retryConnection(),
		}),
		[
			activeIp,
			connectionStatus,
			enableWithIp,
			ipMode,
			localApiClient,
			retryConnection,
			status,
			urls,
		],
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
