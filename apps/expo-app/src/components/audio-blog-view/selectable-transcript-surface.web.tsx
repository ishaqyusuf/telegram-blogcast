import type { SelectableTranscriptSurfaceProps } from "@/components/audio-blog-view/selectable-transcript-surface.types";
import { buildTranscriptDisplayRuns } from "@/components/audio-blog-view/transcript-display-runs";
import React, { useCallback, useLayoutEffect, useMemo, useRef } from "react";
import { useWindowDimensions } from "react-native";

function absoluteOffset(root: HTMLElement, node: Node | null, offset: number) {
	if (!node || !root.contains(node)) return null;
	const range = window.document.createRange();
	range.selectNodeContents(root);
	range.setEnd(node, offset);
	return range.toString().length;
}

function pointAtOffset(root: HTMLElement, targetOffset: number) {
	const walker = window.document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
	let remaining = Math.max(0, targetOffset);
	let node = walker.nextNode();
	let last: Node = root;
	while (node) {
		last = node;
		const length = node.nodeValue?.length ?? 0;
		if (remaining <= length) return { node, offset: remaining };
		remaining -= length;
		node = walker.nextNode();
	}
	return { node: last, offset: last.nodeValue?.length ?? 0 };
}

export function SelectableTranscriptSurface(
	props: SelectableTranscriptSurfaceProps,
) {
	const scrollerRef = useRef<HTMLDivElement>(null);
	const rootRef = useRef<HTMLDivElement>(null);
	const positionedRef = useRef(false);
	const previousActiveRef = useRef(props.activeSegmentIndex);
	const activeSegmentIndexRef = useRef(props.activeSegmentIndex);
	const previousFollowRef = useRef(props.follow);
	const centerKeyRef = useRef<string | null>(null);
	const userScrollingRef = useRef(false);
	const segmentElementsRef = useRef<HTMLElement[]>([]);
	const viewportFrameRef = useRef<number | null>(null);
	const pressSegmentRef = useRef(props.onPressSegment);
	const { fontScale } = useWindowDimensions();
	const displaySegments = useMemo(
		() => buildTranscriptDisplayRuns(props.document),
		[props.document],
	);
	activeSegmentIndexRef.current = props.activeSegmentIndex;
	pressSegmentRef.current = props.onPressSegment;
	const documentContent = useMemo(
		() =>
			displaySegments.flatMap((segment, index) => [
				index > 0 ? "\n\n" : "",
				React.createElement(
					"span",
					{
						key: segment.key,
						"data-segment-key": segment.key,
						"data-segment-index": segment.index,
						onClick: (event: React.MouseEvent) => {
							if (!window.getSelection()?.isCollapsed) return;
							pressSegmentRef.current?.(
								segment.segment,
								segment.index,
								event.detail > 1,
							);
						},
					},
					segment.runs.map((run) =>
						React.createElement(
							"span",
							{
								key: run.key,
								"data-word-index": run.wordIndex ?? undefined,
							},
							run.text,
						),
					),
				),
			]),
		[displaySegments],
	);

	const reportSelection = useCallback(() => {
		const root = rootRef.current;
		const selected = window.getSelection();
		if (
			!root ||
			!selected ||
			selected.isCollapsed ||
			selected.rangeCount === 0
		) {
			props.onSelectionChange(null);
			return;
		}
		const range = selected.getRangeAt(0);
		const startOffset = absoluteOffset(
			root,
			range.startContainer,
			range.startOffset,
		);
		const endOffset = absoluteOffset(root, range.endContainer, range.endOffset);
		const dragStartOffset = absoluteOffset(
			root,
			selected.anchorNode,
			selected.anchorOffset,
		);
		if (startOffset == null || endOffset == null || dragStartOffset == null)
			return;
		props.onSelectionChange({ startOffset, endOffset, dragStartOffset });
	}, [props]);

	useLayoutEffect(() => {
		if (!props.document.fullText) return;
		const root = rootRef.current;
		if (!root) return;
		const previousSegment = root.querySelector<HTMLElement>(
			'[data-active-segment="true"]',
		);
		const previousWord = root.querySelector<HTMLElement>(
			'[data-active-word="true"]',
		);
		previousSegment?.removeAttribute("data-active-segment");
		previousSegment?.style.removeProperty("color");
		previousWord?.removeAttribute("data-active-word");
		previousWord?.style.removeProperty("color");

		const segment = root.querySelector<HTMLElement>(
			`[data-segment-index="${props.activeSegmentIndex}"]`,
		);
		segment?.setAttribute("data-active-segment", "true");
		if (segment) segment.style.color = "rgba(255,255,255,.86)";
		const word = segment?.querySelector<HTMLElement>(
			`[data-word-index="${props.activeWordIndex}"]`,
		);
		word?.setAttribute("data-active-word", "true");
		if (word) word.style.color = "#fff";
	}, [props.activeSegmentIndex, props.activeWordIndex, props.document]);

	useLayoutEffect(() => {
		if (!props.document.fullText) return;
		const root = rootRef.current;
		segmentElementsRef.current = Array.from(
			root?.querySelectorAll<HTMLElement>("[data-segment-key]") ?? [],
		);
		const targetKey = positionedRef.current ? centerKeyRef.current : null;
		const target = targetKey
			? root?.querySelector<HTMLElement>(
					`[data-segment-key="${CSS.escape(targetKey)}"]`,
				)
			: root?.querySelector<HTMLElement>(
					`[data-segment-index="${activeSegmentIndexRef.current}"]`,
				);
		target?.scrollIntoView({ block: "center", behavior: "auto" });
		positionedRef.current = true;
		if (root) root.style.opacity = "1";
	}, [props.document]);

	useLayoutEffect(
		() => () => {
			if (viewportFrameRef.current != null) {
				window.cancelAnimationFrame(viewportFrameRef.current);
			}
		},
		[],
	);

	useLayoutEffect(() => {
		const wasFollowing = previousFollowRef.current;
		const previousActive = previousActiveRef.current;
		previousFollowRef.current = props.follow;
		previousActiveRef.current = props.activeSegmentIndex;
		if (!positionedRef.current || !props.follow) return;
		const resumed = !wasFollowing;
		const changed = previousActive !== props.activeSegmentIndex;
		if (!resumed && !changed) return;
		rootRef.current
			?.querySelector<HTMLElement>(
				`[data-segment-index="${props.activeSegmentIndex}"]`,
			)
			?.scrollIntoView({
				block: "center",
				behavior: resumed ? "auto" : "smooth",
			});
	}, [props.activeSegmentIndex, props.follow]);

	useLayoutEffect(() => {
		if (!props.selection) {
			window.getSelection()?.removeAllRanges();
			return;
		}
		const root = rootRef.current;
		if (!root) return;
		const boundedEnd = Math.min(
			props.document.fullText.length,
			props.selection.endOffset,
		);
		const start = pointAtOffset(root, props.selection.startOffset);
		const end = pointAtOffset(root, boundedEnd);
		const anchor = pointAtOffset(root, props.selection.dragStartOffset);
		const focus =
			props.selection.dragStartOffset === props.selection.endOffset
				? start
				: end;
		const range = window.document.createRange();
		range.setStart(start.node, start.offset);
		range.setEnd(end.node, end.offset);
		const selected = window.getSelection();
		selected?.removeAllRanges();
		if (selected?.setBaseAndExtent) {
			selected.setBaseAndExtent(
				anchor.node,
				anchor.offset,
				focus.node,
				focus.offset,
			);
		} else {
			selected?.addRange(range);
		}
	}, [props.document, props.selection]);

	return React.createElement(
		"div",
		{
			ref: scrollerRef,
			dir: "rtl",
			lang: "ar",
			onPointerDown: () => {
				userScrollingRef.current = true;
			},
			onWheel: () => {
				userScrollingRef.current = true;
			},
			onPointerUp: reportSelection,
			onScroll: (event: React.UIEvent<HTMLDivElement>) => {
				const scroller = event.currentTarget;
				if (userScrollingRef.current) props.onManualScroll();
				userScrollingRef.current = false;
				if (viewportFrameRef.current != null) return;
				viewportFrameRef.current = window.requestAnimationFrame(() => {
					viewportFrameRef.current = null;
					const elements = segmentElementsRef.current;
					const center =
						scroller.getBoundingClientRect().top + scroller.clientHeight / 2;
					let low = 0;
					let high = elements.length - 1;
					let closest: HTMLElement | null = null;
					let closestDistance = Number.POSITIVE_INFINITY;
					while (low <= high) {
						const middle = Math.floor((low + high) / 2);
						const element = elements[middle];
						if (!element) break;
						const rect = element.getBoundingClientRect();
						const elementCenter = (rect.top + rect.bottom) / 2;
						const distance = Math.abs(elementCenter - center);
						if (distance < closestDistance) {
							closest = element;
							closestDistance = distance;
						}
						if (elementCenter < center) low = middle + 1;
						else high = middle - 1;
					}
					centerKeyRef.current = closest?.dataset.segmentKey ?? null;
					if (scroller.scrollTop < 160) props.onStartReached?.();
					if (
						scroller.scrollTop + scroller.clientHeight >
						scroller.scrollHeight - 260
					) {
						props.onEndReached?.();
					}
				});
			},
			style: { height: "100%", overflowY: "auto", background: "#080807" },
		},
		React.createElement(
			"div",
			{
				ref: rootRef,
				role: "document",
				"aria-label": "Transcript",
				style: {
					boxSizing: "border-box",
					minHeight: "100%",
					padding: "120px 24px",
					opacity: 0,
					whiteSpace: "pre-wrap",
					wordBreak: "normal",
					overflowWrap: "normal",
					hyphens: "none",
					fontSize: 26 * fontScale,
					lineHeight: `${40 * fontScale}px`,
					fontWeight: 700,
					textAlign: "right",
					direction: "rtl",
					userSelect: "text",
					color: "rgba(255,255,255,.48)",
				},
			},
			documentContent,
		),
	);
}
