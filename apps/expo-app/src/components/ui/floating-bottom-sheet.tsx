import {
	BottomSheetBackdrop,
	BottomSheetModal,
	BottomSheetView,
	type BottomSheetBackdropProps,
	type BottomSheetBackgroundProps,
	type BottomSheetModalProps,
} from "@gorhom/bottom-sheet";
import { type ReactNode, useCallback, useEffect, useMemo, useRef } from "react";
import { Platform, StyleSheet, Text, View, useWindowDimensions } from "react-native";

import { useColors } from "@/hooks/use-color";

const SHEET_RADIUS = 32;

export type FloatingBottomSheetProps = {
	visible: boolean;
	onClose: () => void;
	children: ReactNode;
	snapPoints?: BottomSheetModalProps["snapPoints"];
	enableDynamicSizing?: boolean;
	maxDynamicContentSize?: number;
	title?: string;
	hideHandle?: boolean;
	bottomInset?: number;
	sideInset?: number;
	overlayOpacity?: number;
	accessibilityLabel?: string;
	scrollableContent?: boolean;
	onDismissed?: () => void;
	keyboardBehavior?: BottomSheetModalProps["keyboardBehavior"];
	keyboardBlurBehavior?: BottomSheetModalProps["keyboardBlurBehavior"];
	androidKeyboardInputMode?: BottomSheetModalProps["android_keyboardInputMode"];
};

export function FloatingBottomSheet({
	visible,
	onClose,
	children,
	snapPoints,
	enableDynamicSizing = true,
	maxDynamicContentSize,
	title,
	hideHandle = false,
	bottomInset,
	sideInset = 8,
	overlayOpacity = 0.38,
	accessibilityLabel,
	scrollableContent = false,
	onDismissed,
	keyboardBehavior,
	keyboardBlurBehavior,
	androidKeyboardInputMode,
}: FloatingBottomSheetProps) {
	const ref = useRef<BottomSheetModal>(null);
	const wasPresentedRef = useRef(false);
	const colors = useColors();
	const { height } = useWindowDimensions();
	const resolvedBottomInset = bottomInset ?? (Platform.OS === "android" ? 20 : 28);
	const resolvedMaxDynamicContentSize =
		maxDynamicContentSize ??
		Math.max(240, height - resolvedBottomInset - sideInset * 2);

	useEffect(() => {
		if (visible) {
			wasPresentedRef.current = true;
			ref.current?.present();
			return;
		}

		if (wasPresentedRef.current) ref.current?.dismiss();
	}, [visible]);

	const handleDismiss = useCallback(() => {
		const wasPresented = wasPresentedRef.current;
		wasPresentedRef.current = false;
		if (wasPresented && visible) onClose();
		onDismissed?.();
	}, [onClose, onDismissed, visible]);

	const renderBackdrop = useCallback(
		(props: BottomSheetBackdropProps) => (
			<BottomSheetBackdrop
				{...props}
				appearsOnIndex={0}
				disappearsOnIndex={-1}
				opacity={overlayOpacity}
				pressBehavior="close"
			/>
		),
		[overlayOpacity],
	);

	const renderBackground = useCallback(
		({ pointerEvents, style }: BottomSheetBackgroundProps) => (
			<View
				pointerEvents={pointerEvents}
				style={[style, styles.background, { backgroundColor: colors.card, borderColor: colors.border }]}
			/>
		),
		[colors.border, colors.card],
	);

	const renderHandle = useCallback(() => {
		if (hideHandle) return null;

		return (
			<View style={styles.handleContainer}>
				<View style={[styles.handle, { backgroundColor: colors.mutedForeground }]} />
				{title ? (
					<Text
						accessibilityRole="header"
						numberOfLines={1}
						style={[styles.title, { color: colors.foreground }]}
					>
						{title}
					</Text>
				) : null}
			</View>
		);
	}, [colors.foreground, colors.mutedForeground, hideHandle, title]);

	const containerStyle = useMemo(
		() => [styles.container, { marginHorizontal: sideInset }],
		[sideInset],
	);

	return (
		<BottomSheetModal
			ref={ref}
			index={0}
			snapPoints={snapPoints}
			enableDynamicSizing={enableDynamicSizing}
			maxDynamicContentSize={resolvedMaxDynamicContentSize}
			enablePanDownToClose
			detached
			bottomInset={resolvedBottomInset}
			containerStyle={containerStyle}
			style={styles.sheet}
			backgroundComponent={renderBackground}
			backdropComponent={renderBackdrop}
			handleComponent={renderHandle}
			onDismiss={handleDismiss}
			accessibilityLabel={accessibilityLabel}
			keyboardBehavior={keyboardBehavior}
			keyboardBlurBehavior={keyboardBlurBehavior}
			android_keyboardInputMode={androidKeyboardInputMode}
		>
			{scrollableContent ? (
				children
			) : (
				<BottomSheetView style={styles.content}>{children}</BottomSheetView>
			)}
		</BottomSheetModal>
	);
}

const styles = StyleSheet.create({
	background: { borderRadius: SHEET_RADIUS, borderWidth: StyleSheet.hairlineWidth },
	container: { elevation: 2000, zIndex: 2000 },
	content: { overflow: "hidden" },
	handle: { borderRadius: 999, height: 6, opacity: 0.25, width: 48 },
	handleContainer: { alignItems: "center", paddingBottom: 8, paddingTop: 12 },
	sheet: { borderRadius: SHEET_RADIUS, overflow: "hidden" },
	title: { fontSize: 16, fontWeight: "700", marginTop: 12, maxWidth: "86%", textAlign: "center" },
});
