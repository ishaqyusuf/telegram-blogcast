import { useCallback, useEffect, useRef, useState } from "react";

import { useGlobalAudioBarStore } from "@/store/global-audio-bar-store";

const HIDE_THRESHOLD = 28;
const SHOW_THRESHOLD = -18;
const SCROLL_TOP_THRESHOLD = 420;

type ScrollTarget = {
	scrollTo?: (options: { y?: number; animated?: boolean }) => void;
	scrollToOffset?: (options: { offset: number; animated?: boolean }) => void;
};

export function useScrollChrome<T extends ScrollTarget>() {
	const ref = useRef<T | null>(null);
	const setGlobalAudioBarScrollHidden = useGlobalAudioBarStore(
		(state) => state.setScrollHidden,
	);
	const [showScrollTop, setShowScrollTop] = useState(false);
	const lastScrollYRef = useRef(0);
	const scrollDeltaAccumulatorRef = useRef(0);
	const audioBarScrollHiddenRef = useRef(false);

	const onScroll = useCallback(
		(event: any) => {
			const currentY = event.nativeEvent.contentOffset?.y ?? 0;
			const deltaY = currentY - lastScrollYRef.current;
			lastScrollYRef.current = currentY;
			setShowScrollTop(currentY > SCROLL_TOP_THRESHOLD);

			if (currentY <= 0) {
				scrollDeltaAccumulatorRef.current = 0;
				if (audioBarScrollHiddenRef.current) {
					audioBarScrollHiddenRef.current = false;
					setGlobalAudioBarScrollHidden(false);
				}
				return;
			}

			if (Math.abs(deltaY) < 2) return;

			const previousAccumulated = scrollDeltaAccumulatorRef.current;
			const changedDirection =
				(previousAccumulated > 0 && deltaY < 0) ||
				(previousAccumulated < 0 && deltaY > 0);

			scrollDeltaAccumulatorRef.current = changedDirection
				? deltaY
				: previousAccumulated + deltaY;

			if (
				scrollDeltaAccumulatorRef.current > HIDE_THRESHOLD &&
				!audioBarScrollHiddenRef.current
			) {
				audioBarScrollHiddenRef.current = true;
				scrollDeltaAccumulatorRef.current = 0;
				setGlobalAudioBarScrollHidden(true);
			} else if (
				scrollDeltaAccumulatorRef.current < SHOW_THRESHOLD &&
				audioBarScrollHiddenRef.current
			) {
				audioBarScrollHiddenRef.current = false;
				scrollDeltaAccumulatorRef.current = 0;
				setGlobalAudioBarScrollHidden(false);
			}
		},
		[setGlobalAudioBarScrollHidden],
	);

	const scrollToTop = useCallback(() => {
		const target = ref.current;
		if (!target) return;
		if (typeof target.scrollToOffset === "function") {
			target.scrollToOffset({ offset: 0, animated: true });
			return;
		}
		target.scrollTo?.({ y: 0, animated: true });
	}, []);

	useEffect(() => {
		return () => {
			audioBarScrollHiddenRef.current = false;
			setGlobalAudioBarScrollHidden(false);
		};
	}, [setGlobalAudioBarScrollHidden]);

	return {
		ref,
		onScroll,
		scrollToTop,
		showScrollTop,
		scrollEventThrottle: 16,
	};
}
