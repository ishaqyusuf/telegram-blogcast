import { SELECTABLE_TRANSCRIPT_HTML } from "@/components/audio-blog-view/selectable-transcript-html";
import {
	type TranscriptToSurfaceMessage,
	createTranscriptHydrateMessage,
	getTranscriptDocumentKey,
	parseTranscriptSurfaceMessage,
} from "@/components/audio-blog-view/selectable-transcript-protocol";
import type { SelectableTranscriptSurfaceProps } from "@/components/audio-blog-view/selectable-transcript-surface.types";
import { resolveTranscriptScrollBehavior } from "@/components/audio-blog-view/transcript-follow-state";
import React, {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { ActivityIndicator, View, useWindowDimensions } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";

export function SelectableTranscriptSurface(
	props: SelectableTranscriptSurfaceProps,
) {
	const webViewRef = useRef<WebView>(null);
	const loadedRef = useRef(false);
	const hydratingRef = useRef(false);
	const positionedRef = useRef(false);
	const hydratedKeyRef = useRef("");
	const hydratedSnapshotRef = useRef<{
		activeSegmentIndex: number;
		activeWordIndex: number;
		follow: boolean;
	} | null>(null);
	const previousActiveRef = useRef(props.activeSegmentIndex);
	const previousFollowRef = useRef(props.follow);
	const previousSelectionRef = useRef(props.selection);
	const latestPropsRef = useRef(props);
	const { fontScale } = useWindowDimensions();
	const fontScaleRef = useRef(fontScale);
	const [surfaceReady, setSurfaceReady] = useState(false);
	const surfaceBackgroundColor =
		props.presentation === "karaoke" ? "transparent" : "#080807";
	fontScaleRef.current = fontScale;
	latestPropsRef.current = props;
	const documentKey = useMemo(
		() => getTranscriptDocumentKey(props.document),
		[props.document],
	);
	const post = useCallback((message: TranscriptToSurfaceMessage) => {
		webViewRef.current?.postMessage(JSON.stringify(message));
	}, []);

	const hydrate = useCallback(() => {
		const latest = latestPropsRef.current;
		const message = createTranscriptHydrateMessage({
			document: latest.document,
			activeSegmentIndex: latest.activeSegmentIndex,
			activeWordIndex: latest.activeWordIndex,
			follow: latest.follow,
			initial: !positionedRef.current,
			fontScale: fontScaleRef.current,
			presentation: latest.presentation,
			selectionEnabled: latest.selectionEnabled,
			contentPaddingVertical: latest.contentPaddingVertical,
			selection: latest.selection,
		});
		if (message.documentKey !== documentKey) return;
		hydratingRef.current = true;
		hydratedSnapshotRef.current = {
			activeSegmentIndex: message.activeSegmentIndex,
			activeWordIndex: message.activeWordIndex,
			follow: message.follow,
		};
		hydratedKeyRef.current = message.documentKey;
		post(message);
	}, [documentKey, post]);

	useEffect(() => {
		if (!loadedRef.current || hydratedKeyRef.current === documentKey) return;
		hydrate();
	}, [documentKey, hydrate]);

	useEffect(() => {
		const wasFollowing = previousFollowRef.current;
		const previousActive = previousActiveRef.current;
		previousFollowRef.current = props.follow;
		previousActiveRef.current = props.activeSegmentIndex;
		if (!loadedRef.current || hydratedKeyRef.current !== documentKey) return;
		if (hydratingRef.current) return;
		const resumed = !wasFollowing && props.follow;
		const changed = previousActive !== props.activeSegmentIndex;
		if (!resumed && !changed && props.activeWordIndex < 0) return;
		const scrollBehavior = resolveTranscriptScrollBehavior({
			hasPositioned: positionedRef.current,
			wasFollowing,
			follow: props.follow,
			activeSegmentIndex: props.activeSegmentIndex,
			previousActiveSegmentIndex: previousActive,
		});
		post({
			type: "sync",
			activeSegmentIndex: props.activeSegmentIndex,
			activeWordIndex: props.activeWordIndex,
			follow: props.follow,
			behavior: scrollBehavior ?? "smooth",
			scrollToActive: scrollBehavior != null,
		});
	}, [
		documentKey,
		post,
		props.activeSegmentIndex,
		props.activeWordIndex,
		props.follow,
	]);

	useEffect(() => {
		if (loadedRef.current) post({ type: "font-scale", fontScale });
	}, [fontScale, post]);

	useEffect(() => {
		if (loadedRef.current && previousSelectionRef.current && !props.selection) {
			post({ type: "clear-selection" });
		}
		previousSelectionRef.current = props.selection;
	}, [post, props.selection]);

	const handleMessage = useCallback(
		(event: WebViewMessageEvent) => {
			const message = parseTranscriptSurfaceMessage(event.nativeEvent.data);
			if (!message) return;
			if (message.type === "ready") {
				positionedRef.current = true;
				hydratingRef.current = false;
				setSurfaceReady(true);
				const hydrated = hydratedSnapshotRef.current;
				const latest = latestPropsRef.current;
				if (
					hydrated &&
					(hydrated.activeSegmentIndex !== latest.activeSegmentIndex ||
						hydrated.activeWordIndex !== latest.activeWordIndex ||
						hydrated.follow !== latest.follow)
				) {
					const scrollBehavior = resolveTranscriptScrollBehavior({
						hasPositioned: true,
						wasFollowing: hydrated.follow,
						follow: latest.follow,
						activeSegmentIndex: latest.activeSegmentIndex,
						previousActiveSegmentIndex: hydrated.activeSegmentIndex,
					});
					post({
						type: "sync",
						activeSegmentIndex: latest.activeSegmentIndex,
						activeWordIndex: latest.activeWordIndex,
						follow: latest.follow,
						behavior: scrollBehavior ?? "smooth",
						scrollToActive: scrollBehavior != null,
					});
				}
				return;
			}
			if (message.type === "selection")
				return props.onSelectionChange?.(message);
			if (message.type === "selection-cleared")
				return props.onSelectionChange?.(null);
			if (message.type === "manual-scroll") return props.onManualScroll();
			if (message.type === "edge") {
				return message.edge === "start"
					? props.onStartReached?.()
					: props.onEndReached?.();
			}
			const segment = props.document.segments[message.index];
			if (!segment) return;
			if (message.type === "long-press-segment") {
				props.onLongPressSegment?.(segment, message.index);
				return;
			}
			props.onPressSegment?.(segment, message.index, message.shouldPlay);
		},
		[post, props],
	);

	return (
		<View style={{ flex: 1, backgroundColor: surfaceBackgroundColor }}>
			<WebView
				ref={webViewRef}
				source={{ html: SELECTABLE_TRANSCRIPT_HTML, baseUrl: "about:blank" }}
				style={{
					flex: 1,
					backgroundColor: surfaceBackgroundColor,
					opacity: surfaceReady ? 1 : 0,
				}}
				opaque={false}
				nestedScrollEnabled
				onLoadEnd={() => {
					loadedRef.current = true;
					hydrate();
				}}
				onMessage={handleMessage}
				allowFileAccess={false}
				allowUniversalAccessFromFileURLs={false}
				javaScriptCanOpenWindowsAutomatically={false}
				setSupportMultipleWindows={false}
				mixedContentMode="never"
				onShouldStartLoadWithRequest={(request) =>
					request.url === "about:blank"
				}
			/>
			{!surfaceReady ? (
				<View
					pointerEvents="none"
					style={{
						position: "absolute",
						inset: 0,
						alignItems: "center",
						justifyContent: "center",
						backgroundColor: surfaceBackgroundColor,
					}}
				>
					<ActivityIndicator color="rgba(255,255,255,0.72)" />
				</View>
			) : null}
		</View>
	);
}
