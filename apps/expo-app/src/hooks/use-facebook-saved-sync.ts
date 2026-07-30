import { useLocalServicesSession } from "@/components/local-services";
import { getLocalApiQueryKey } from "@/lib/local-api-query";
import { useMutation, useQuery } from "@/lib/react-query";
import {
	type FacebookSavedCollector,
	type FacebookSavedCollectorProgress,
	type FacebookSavedSnapshot,
	buildFacebookSavedCapture,
	createFacebookSavedCollector,
	createFacebookSavedSnapshotScript,
	processFacebookSavedSnapshot,
} from "@acme/blog/facebook-saved";
import type { RouterOutputs } from "@api/trpc/routers/_app";
import {
	type RefObject,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import type { WebView, WebViewMessageEvent } from "react-native-webview";

export type FacebookSavedSyncPhase =
	| "loading"
	| "ready"
	| "sign_in"
	| "syncing"
	| "submitting"
	| "complete"
	| "error";

type SyncResult = RouterOutputs["facebookImport"]["syncSavedPosts"];

export function useFacebookSavedSync(webViewRef: RefObject<WebView | null>) {
	const { activeGatewayUrl, connectionStatus, localApiClient } =
		useLocalServicesSession();
	const collectorRef = useRef<FacebookSavedCollector | null>(null);
	const runningRef = useRef(false);
	const [phase, setPhase] = useState<FacebookSavedSyncPhase>("loading");
	const [progress, setProgress] =
		useState<FacebookSavedCollectorProgress | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [result, setResult] = useState<SyncResult | null>(null);
	const stateQueryKey = getLocalApiQueryKey(
		activeGatewayUrl,
		"facebookImport.getSavedSyncState",
	);
	const localApiReady =
		connectionStatus === "online" && Boolean(localApiClient);
	const stateQuery = useQuery({
		queryKey: stateQueryKey,
		queryFn: () => {
			if (!localApiClient) throw new Error("Local API is not configured.");
			return localApiClient.facebookImport.getSavedSyncState.query();
		},
		enabled: localApiReady,
		retry: false,
	});

	const submitMutation = useMutation({
		mutationFn: async (input: {
			collector: FacebookSavedCollector;
			snapshot: FacebookSavedSnapshot;
			progress: FacebookSavedCollectorProgress;
		}) => {
			if (!localApiClient) throw new Error("Local API is not configured.");
			return localApiClient.facebookImport.syncSavedPosts.mutate({
				capture: buildFacebookSavedCapture(
					input.collector,
					input.snapshot,
					input.progress,
				),
				dryRun: false,
				batchSize: 50,
			});
		},
		onSuccess: async (data) => {
			setResult(data);
			setPhase("complete");
			await stateQuery.refetch();
		},
		onError: (mutationError) => {
			setError(mutationError.message);
			setPhase("error");
		},
	});

	const processSnapshot = useCallback(
		(snapshot: FacebookSavedSnapshot) => {
			const pageUrl = snapshot.url ?? "";
			const pageTitle = snapshot.title ?? "";
			if (/log in|login/i.test(pageTitle)) {
				runningRef.current = false;
				setPhase("sign_in");
				return;
			}
			if (!pageUrl.includes("facebook.com/saved")) {
				if (runningRef.current) {
					runningRef.current = false;
					setError("Open Facebook Saved before starting the sync.");
					setPhase("error");
				}
				return;
			}
			if (!runningRef.current) {
				if (stateQuery.data) setPhase("ready");
				return;
			}

			const collector = collectorRef.current;
			if (!collector) return;
			const nextProgress = processFacebookSavedSnapshot(collector, snapshot);
			setProgress(nextProgress);
			if (!nextProgress.done) {
				webViewRef.current?.injectJavaScript(
					createFacebookSavedSnapshotScript(900),
				);
				return;
			}

			runningRef.current = false;
			if (!nextProgress.complete) {
				setError(
					`The capture stopped without a safe known-post boundary (${nextProgress.stopReason}). Nothing was imported.`,
				);
				setPhase("error");
				return;
			}
			setPhase("submitting");
			submitMutation.mutate({
				collector,
				snapshot,
				progress: nextProgress,
			});
		},
		[stateQuery.data, submitMutation, webViewRef],
	);

	const handleMessage = useCallback(
		(event: WebViewMessageEvent) => {
			try {
				const payload = JSON.parse(event.nativeEvent.data);
				if (payload.type === "facebook-saved-snapshot") {
					processSnapshot(payload.snapshot as FacebookSavedSnapshot);
				} else if (payload.type === "facebook-saved-error") {
					runningRef.current = false;
					setError(payload.error || "Facebook page extraction failed.");
					setPhase("error");
				}
			} catch {
				runningRef.current = false;
				setError("Facebook returned an unreadable capture message.");
				setPhase("error");
			}
		},
		[processSnapshot],
	);

	const start = useCallback(() => {
		if (!stateQuery.data || !localApiReady || submitMutation.isPending) return;
		setError(null);
		setResult(null);
		setProgress(null);
		collectorRef.current = createFacebookSavedCollector(
			stateQuery.data.knownIdentities,
			{ boundaryThreshold: 20, stopAfterNoGrowthPasses: 8, maxPasses: 250 },
		);
		runningRef.current = true;
		setPhase("syncing");
		webViewRef.current?.injectJavaScript(createFacebookSavedSnapshotScript());
	}, [localApiReady, stateQuery.data, submitMutation.isPending, webViewRef]);

	const probe = useCallback(() => {
		if (!stateQuery.data && localApiReady) void stateQuery.refetch();
		webViewRef.current?.injectJavaScript(createFacebookSavedSnapshotScript());
	}, [localApiReady, stateQuery, webViewRef]);

	const reset = useCallback(() => {
		runningRef.current = false;
		collectorRef.current = null;
		setProgress(null);
		setResult(null);
		setError(null);
		setPhase(stateQuery.data ? "ready" : "loading");
	}, [stateQuery.data]);

	useEffect(() => {
		if (stateQuery.data && phase === "loading") setPhase("ready");
	}, [phase, stateQuery.data]);

	return {
		phase,
		progress,
		result,
		error: error ?? stateQuery.error?.message ?? null,
		knownCount: stateQuery.data?.count ?? 0,
		canStart:
			(phase === "ready" || phase === "complete") &&
			localApiReady &&
			Boolean(stateQuery.data) &&
			!submitMutation.isPending,
		handleMessage,
		start,
		probe,
		reset,
	};
}
