import { resolveReachableLocalGateway } from "@/lib/local-gateway-discovery";
import {
	buildLocalApiBaseUrl,
	checkLocalApiBaseUrl,
	resolveReachableLocalApi,
} from "@/lib/local-api-ip-cache";
import { getCurrentLocalApiIp } from "@/lib/local-api-runtime-host";
import {
	buildLocalServiceUrls,
	buildRemoteLocalServiceUrls,
	getPreferredLocalServiceIp,
	type LocalServiceUrls,
} from "@/lib/local-service-urls";
import {
	getInitialLocalServicesSessionStatus,
	getLocalServicesIpMode,
	isValidIpv4Address,
	normalizeIpv4Input,
	type LocalServicesConnectionStatus,
	type LocalServicesDiscoveryProgress,
	type LocalServicesIpMode,
	type LocalServicesSessionStatus,
} from "@/lib/local-services-session";
import { useAppSettingsStore } from "@/store/app-settings-store";
import {
	createLocalApiClient,
	type LocalApiClient,
} from "@/trpc/local-api-client";
import NetInfo from "@react-native-community/netinfo";
import Constants from "expo-constants";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";

export type LocalServicesConnectionController = {
	status: LocalServicesSessionStatus;
	isEnabled: boolean;
	isResolving: boolean;
	ipMode: LocalServicesIpMode;
	connectionStatus: LocalServicesConnectionStatus;
	connectionSource: "lan" | "remote" | null;
	activeGatewayUrl: string | null;
	activeIp: string | null;
	savedIp: string | null;
	checkingIp: string | null;
	connectionError: string | null;
	discoveryProgress: LocalServicesDiscoveryProgress;
	history: string[];
	urls: LocalServiceUrls | null;
	localApiClient: LocalApiClient | null;
	enableWithIp: (ip: string) => Promise<boolean>;
	findConnection: () => Promise<boolean>;
	retryConnection: () => Promise<boolean>;
};

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

export function useLocalServicesConnection(): LocalServicesConnectionController {
	const hydrated = useAppSettingsHydrated();
	const appVariantRef = useRef(getRuntimeAppVariant().toLowerCase());
	const initializedRef = useRef(false);
	const mountedRef = useRef(true);
	const connectionAttemptRef = useRef(0);
	const discoveryAbortRef = useRef<AbortController | null>(null);
	const networkSignatureRef = useRef<string | null>(null);
	const offlineRetryCountRef = useRef(0);
	const savedIp = useAppSettingsStore((state) => state.localServicesIp);
	const localApiLastIp = useAppSettingsStore((state) => state.localApiLastIp);
	const localApiBaseUrl = useAppSettingsStore((state) => state.localApiBaseUrl);
	const history = useAppSettingsStore((state) => state.localApiIpHistory);
	const setLocalServicesIp = useAppSettingsStore(
		(state) => state.setLocalServicesIp,
	);
	const [status, setStatus] = useState<LocalServicesSessionStatus>(() =>
		getInitialLocalServicesSessionStatus(appVariantRef.current),
	);
	const [ipMode, setIpMode] = useState<LocalServicesIpMode>("manual");
	const [connectionStatus, setConnectionStatus] =
		useState<LocalServicesConnectionStatus>("offline");
	const [connectionSource, setConnectionSource] = useState<
		"lan" | "remote" | null
	>(null);
	const [activeGatewayUrl, setActiveGatewayUrl] = useState<string | null>(null);
	const [activeIp, setActiveIp] = useState<string | null>(null);
	const [checkingIp, setCheckingIp] = useState<string | null>(null);
	const [connectionError, setConnectionError] = useState<string | null>(null);
	const [discoveryProgress, setDiscoveryProgress] =
		useState<LocalServicesDiscoveryProgress>(null);

	const urls = useMemo(() => {
		if (connectionSource === "remote" && activeGatewayUrl) {
			return buildRemoteLocalServiceUrls(activeGatewayUrl);
		}
		if (!activeIp) return null;
		return buildLocalServiceUrls(activeIp);
	}, [activeGatewayUrl, activeIp, connectionSource]);
	const localApiClient = useMemo(
		() => (urls ? createLocalApiClient(urls.apiBaseUrl) : null),
		[urls],
	);

	const stopCurrentDiscovery = useCallback(() => {
		connectionAttemptRef.current += 1;
		discoveryAbortRef.current?.abort();
		discoveryAbortRef.current = null;
	}, []);

	const commitLanConnection = useCallback(
		(ip: string) => {
			offlineRetryCountRef.current = 0;
			setLocalServicesIp(ip);
			setConnectionSource("lan");
			setActiveGatewayUrl(buildLocalApiBaseUrl(ip));
			setActiveIp(ip);
			setConnectionStatus("online");
			setStatus("enabled");
			setCheckingIp(null);
			setDiscoveryProgress(null);
			setConnectionError(null);
		},
		[setLocalServicesIp],
	);

	const commitRemoteConnection = useCallback((gatewayUrl: string) => {
		offlineRetryCountRef.current = 0;
		setConnectionSource("remote");
		setActiveGatewayUrl(gatewayUrl);
		setActiveIp(null);
		setConnectionStatus("online");
		setStatus("enabled");
		setCheckingIp(null);
		setDiscoveryProgress(null);
		setConnectionError(null);
	}, []);

	const enableWithIp = useCallback(
		async (ip: string) => {
			const normalizedIp = normalizeIpv4Input(ip);
			if (!isValidIpv4Address(normalizedIp)) {
				setConnectionError("Enter a valid IPv4 address.");
				return false;
			}

			const preserveExistingConnection =
				connectionStatus === "online" &&
				Boolean(activeIp) &&
				activeIp !== normalizedIp;
			stopCurrentDiscovery();
			const attempt = connectionAttemptRef.current;
			const controller = new AbortController();
			discoveryAbortRef.current = controller;
			setCheckingIp(normalizedIp);
			setDiscoveryProgress({ attempted: 1, total: 1 });
			setConnectionError(null);
			if (!preserveExistingConnection) {
				setConnectionStatus("checking");
				setStatus("initializing");
			}

			const online = await checkLocalApiBaseUrl(
				buildLocalApiBaseUrl(normalizedIp),
				{ signal: controller.signal },
			);
			if (
				!mountedRef.current ||
				controller.signal.aborted ||
				connectionAttemptRef.current !== attempt
			) {
				return false;
			}

			discoveryAbortRef.current = null;
			setCheckingIp(null);
			setDiscoveryProgress(null);
			if (online) {
				commitLanConnection(normalizedIp);
				return true;
			}

			setConnectionError(`Could not reach local services at ${normalizedIp}.`);
			if (!preserveExistingConnection) {
				setConnectionStatus("offline");
				setStatus("disabled");
			}
			return false;
		},
		[activeIp, commitLanConnection, connectionStatus, stopCurrentDiscovery],
	);

	const findRemoteConnection = useCallback(async (background = false) => {
		stopCurrentDiscovery();
		const attempt = connectionAttemptRef.current;
		const controller = new AbortController();
		discoveryAbortRef.current = controller;
		if (!background) {
			setConnectionError(null);
			setStatus("initializing");
			setConnectionStatus("checking");
			setCheckingIp(null);
			setDiscoveryProgress(null);
		}

		const gatewayUrl = await resolveReachableLocalGateway({
			productionBaseUrl: process.env.EXPO_PUBLIC_BASE_URL,
			checkHealth: checkLocalApiBaseUrl,
			signal: controller.signal,
		});
		if (
			!mountedRef.current ||
			controller.signal.aborted ||
			connectionAttemptRef.current !== attempt
		) {
			return false;
		}

		discoveryAbortRef.current = null;
		if (gatewayUrl) {
			commitRemoteConnection(gatewayUrl);
			return true;
		}

		setConnectionSource(null);
		setActiveGatewayUrl(null);
		setActiveIp(null);
		setConnectionStatus("offline");
		setStatus("disabled");
		setConnectionError(null);
		return false;
	}, [commitRemoteConnection, stopCurrentDiscovery]);

	const findConnection = useCallback(async () => {
		if (appVariantRef.current === "preview") {
			return findRemoteConnection();
		}

		const preferredIp = getPreferredLocalServiceIp({
			manualIp: savedIp,
			lastUsedIp: localApiLastIp,
			savedApiBaseUrl: localApiBaseUrl,
		});
		const isDevelopment =
			appVariantRef.current === "development" ||
			appVariantRef.current === "dev";
		const currentIp = isDevelopment ? getCurrentLocalApiIp() : "";
		const hasCandidates = Boolean(preferredIp || currentIp || history.length);

		stopCurrentDiscovery();
		const attempt = connectionAttemptRef.current;
		const controller = new AbortController();
		discoveryAbortRef.current = controller;
		setConnectionError(null);
		setStatus("initializing");
		setConnectionStatus(hasCandidates ? "checking" : "offline");
		setCheckingIp(preferredIp || history[0] || currentIp || null);
		setDiscoveryProgress(hasCandidates ? { attempted: 0, total: 0 } : null);

		if (!hasCandidates) {
			discoveryAbortRef.current = null;
			setStatus("disabled");
			setConnectionError("No saved local-service addresses yet.");
			return false;
		}

		const result = await resolveReachableLocalApi({
			lastUsedIp: preferredIp,
			currentIp,
			history,
			signal: controller.signal,
			onAttempt: (candidate, progress) => {
				if (!mountedRef.current || connectionAttemptRef.current !== attempt)
					return;
				setCheckingIp(candidate.ip);
				setDiscoveryProgress(progress);
			},
		});
		if (
			!mountedRef.current ||
			controller.signal.aborted ||
			connectionAttemptRef.current !== attempt
		) {
			return false;
		}

		discoveryAbortRef.current = null;
		setCheckingIp(null);
		setDiscoveryProgress(null);
		if (result) {
			commitLanConnection(result.ip);
			return true;
		}

		setConnectionSource(preferredIp ? "lan" : null);
		setActiveGatewayUrl(
			preferredIp ? buildLocalApiBaseUrl(preferredIp) : null,
		);
		setActiveIp(preferredIp || null);
		setConnectionStatus("offline");
		setStatus("disabled");
		setConnectionError("No saved local-service address is reachable.");
		return false;
	}, [
		commitLanConnection,
		findRemoteConnection,
		history,
		localApiBaseUrl,
		localApiLastIp,
		savedIp,
		stopCurrentDiscovery,
	]);

	const retryConnection = useCallback(async () => {
		if (connectionSource === "remote" || appVariantRef.current === "preview") {
			return findConnection();
		}
		if (activeIp) return enableWithIp(activeIp);
		return findConnection();
	}, [activeIp, connectionSource, enableWithIp, findConnection]);

	useEffect(() => {
		if (!hydrated || initializedRef.current) return;
		initializedRef.current = true;
		setIpMode(getLocalServicesIpMode(appVariantRef.current));
		void findConnection();
	}, [findConnection, hydrated]);

	useEffect(() => {
		const subscription = AppState.addEventListener("change", (nextState) => {
			if (nextState !== "active" || !initializedRef.current) return;
			void findConnection();
		});
		return () => subscription.remove();
	}, [findConnection]);

	useEffect(() => {
		const unsubscribe = NetInfo.addEventListener((networkState) => {
			const details = networkState.details as {
				ipAddress?: string | null;
			} | null;
			const signature = [
				networkState.type,
				networkState.isConnected,
				details?.ipAddress ?? "",
			].join(":");
			const previousSignature = networkSignatureRef.current;
			networkSignatureRef.current = signature;
			if (
				previousSignature &&
				previousSignature !== signature &&
				networkState.isConnected &&
				initializedRef.current
			) {
				void findConnection();
			}
		});
		return unsubscribe;
	}, [findConnection]);

	useEffect(() => {
		if (!hydrated || connectionStatus !== "offline") return;
		const delay = Math.min(30_000 * 2 ** offlineRetryCountRef.current, 120_000);
		const timer = setTimeout(() => {
			offlineRetryCountRef.current += 1;
			void findConnection();
		}, delay);
		return () => clearTimeout(timer);
	}, [connectionStatus, findConnection, hydrated]);

	useEffect(() => {
		if (
			appVariantRef.current !== "preview" ||
			connectionStatus !== "online"
		) {
			return;
		}
		const timer = setInterval(() => {
			void findRemoteConnection(true);
		}, 60_000);
		return () => clearInterval(timer);
	}, [connectionStatus, findRemoteConnection]);

	useEffect(() => {
		mountedRef.current = true;
		return () => {
			mountedRef.current = false;
			stopCurrentDiscovery();
		};
	}, [stopCurrentDiscovery]);

	return useMemo(
		() => ({
			status,
			isEnabled: connectionStatus === "online",
			isResolving: connectionStatus === "checking",
			ipMode,
			connectionStatus,
			connectionSource,
			activeGatewayUrl,
			activeIp,
			savedIp,
			checkingIp,
			connectionError,
			discoveryProgress,
			history,
			urls,
			localApiClient,
			enableWithIp,
			findConnection,
			retryConnection,
		}),
		[
			activeIp,
			activeGatewayUrl,
			checkingIp,
			connectionError,
			connectionSource,
			connectionStatus,
			discoveryProgress,
			enableWithIp,
			findConnection,
			history,
			ipMode,
			localApiClient,
			retryConnection,
			savedIp,
			status,
			urls,
		],
	);
}
