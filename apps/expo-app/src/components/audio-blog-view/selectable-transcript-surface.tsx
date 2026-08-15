import { SELECTABLE_TRANSCRIPT_HTML } from "@/components/audio-blog-view/selectable-transcript-html";
import {
	type TranscriptToSurfaceMessage,
	createTranscriptHydrateMessage,
	getTranscriptDocumentKey,
	parseTranscriptSurfaceMessage,
} from "@/components/audio-blog-view/selectable-transcript-protocol";
import type { SelectableTranscriptSurfaceProps } from "@/components/audio-blog-view/selectable-transcript-surface.types";
import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { View, useWindowDimensions } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";

export function SelectableTranscriptSurface(
	props: SelectableTranscriptSurfaceProps,
) {
	const webViewRef = useRef<WebView>(null);
	const loadedRef = useRef(false);
	const positionedRef = useRef(false);
	const hydratedKeyRef = useRef("");
	const previousActiveRef = useRef(props.activeSegmentIndex);
	const previousFollowRef = useRef(props.follow);
	const previousSelectionRef = useRef(props.selection);
	const latestPropsRef = useRef(props);
	const { fontScale } = useWindowDimensions();
	const fontScaleRef = useRef(fontScale);
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
			selection: latest.selection,
		});
		if (message.documentKey !== documentKey) return;
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
		const resumed = !wasFollowing && props.follow;
		const changed = previousActive !== props.activeSegmentIndex;
		if (!resumed && !changed && props.activeWordIndex < 0) return;
		post({
			type: "sync",
			activeSegmentIndex: props.activeSegmentIndex,
			activeWordIndex: props.activeWordIndex,
			follow: props.follow,
			behavior: resumed ? "instant" : "smooth",
			scrollToActive: resumed || changed,
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
				return;
			}
			if (message.type === "selection") return props.onSelectionChange(message);
			if (message.type === "selection-cleared")
				return props.onSelectionChange(null);
			if (message.type === "manual-scroll") return props.onManualScroll();
			if (message.type === "edge") {
				return message.edge === "start"
					? props.onStartReached?.()
					: props.onEndReached?.();
			}
			const segment = props.document.segments[message.index];
			if (segment)
				props.onPressSegment?.(segment, message.index, message.shouldPlay);
		},
		[props],
	);

	return (
		<View style={{ flex: 1, backgroundColor: "#080807" }}>
			<WebView
				ref={webViewRef}
				source={{ html: SELECTABLE_TRANSCRIPT_HTML, baseUrl: "about:blank" }}
				style={{ flex: 1, backgroundColor: "#080807" }}
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
		</View>
	);
}
