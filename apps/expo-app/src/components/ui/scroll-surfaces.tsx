/* Type/value pairs preserve native ref types for drop-in scroll surfaces. */
/* eslint-disable @typescript-eslint/no-redeclare */
import { useCallback, forwardRef, type Ref } from "react";
import {
	FlatList as NativeFlatList,
	ScrollView as NativeScrollView,
	type FlatListProps,
	type ScrollViewProps,
} from "react-native";
import {
	LegendList as NativeLegendList,
	type LegendListProps,
	type LegendListRef,
} from "@legendapp/list";
import {
	KeyboardAwareScrollView as NativeKeyboardAwareScrollView,
	type KeyboardAwareScrollViewProps,
} from "react-native-keyboard-controller";
import { useScrollChrome } from "@/hooks/use-scroll-chrome";

function usePlayerScroll(
	props: Pick<ScrollViewProps, "horizontal" | "onScroll">,
) {
	const { onScroll: onPlayerScroll } = useScrollChrome<NativeScrollView>();
	const { onScroll, horizontal } = props;
	return useCallback<NonNullable<ScrollViewProps["onScroll"]>>(
		(event) => {
			// Horizontal carousels must not reveal/hide the screen's persistent player.
			if (!horizontal) onPlayerScroll(event);
			onScroll?.(event);
		},
		[onPlayerScroll, horizontal, onScroll],
	);
}

export type ScrollView = NativeScrollView;
export const ScrollView = forwardRef<NativeScrollView, ScrollViewProps>(
	(props, ref) => {
		const onScroll = usePlayerScroll(props);
		return (
			<NativeScrollView
				{...props}
				ref={ref}
				onScroll={onScroll}
				scrollEventThrottle={16}
			/>
		);
	},
);
ScrollView.displayName = "PlayerScrollView";

export type FlatList<T> = NativeFlatList<T>;
// React 19 accepts ref as a prop and retains generic item/ref inference.
export function FlatList<T>({
	ref,
	...props
}: FlatListProps<T> & { ref?: Ref<NativeFlatList<T>> }) {
	const onScroll = usePlayerScroll(props);
	return (
		<NativeFlatList
			{...props}
			ref={ref}
			onScroll={onScroll}
			scrollEventThrottle={16}
		/>
	);
}

export const LegendList = forwardRef<LegendListRef, LegendListProps<unknown>>(
	function PlayerLegendList(props, ref) {
		const onScroll = usePlayerScroll(props);
		return (
			<NativeLegendList
				{...props}
				ref={ref}
				onScroll={onScroll}
				scrollEventThrottle={16}
			/>
		);
	},
) as typeof NativeLegendList;

export const KeyboardAwareScrollView = forwardRef<
	NativeScrollView,
	KeyboardAwareScrollViewProps
>((props, ref) => {
	const onScroll = usePlayerScroll(props);
	return (
		<NativeKeyboardAwareScrollView
			{...props}
			ref={ref}
			onScroll={onScroll}
			scrollEventThrottle={16}
		/>
	);
});
KeyboardAwareScrollView.displayName = "PlayerKeyboardAwareScrollView";
