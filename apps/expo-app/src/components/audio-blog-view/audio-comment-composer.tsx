import { useCommentDraft } from "@/components/comments-sheet/use-comment-draft";
import { useFloatingFooterInset } from "@/components/floating-footer";
import {
	useFloatingBottomSheetRegistration,
	useFloatingBottomSheetStore,
} from "@/components/ui/floating-bottom-sheet-store";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { useColors } from "@/hooks/use-color";
import { useIsFocused } from "@react-navigation/native";
import { useEffect, useLayoutEffect } from "react";
import {
	ActivityIndicator,
	BackHandler,
	Keyboard,
	Text,
	TextInput,
	View,
} from "react-native";
import {
	KeyboardStickyView,
	useKeyboardState,
} from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export function AudioCommentComposer({
	blogId,
	scrolled,
	visible,
	onVisibleChange,
	onCommentAdded,
}: {
	blogId: number;
	scrolled: boolean;
	visible: boolean;
	onVisibleChange: (visible: boolean) => void;
	onCommentAdded: () => void;
}) {
	const colors = useColors();
	const focused = useIsFocused();
	const insets = useSafeAreaInsets();
	const footerInset = useFloatingFooterInset();
	const keyboardVisible = useKeyboardState((state) => state.isVisible);
	const sheetsOpen = useFloatingBottomSheetStore(
		(state) => Object.keys(state.openSheetIds).length > 0,
	);
	const { markSheetPresented, markSheetDismissed } =
		useFloatingBottomSheetRegistration();
	const close = () => {
		Keyboard.dismiss();
		onVisibleChange(false);
	};
	const draft = useCommentDraft({
		blogId,
		timestampMode: true,
		onCommentAdded,
		onClose: close,
	});

	useEffect(() => {
		if (!focused && visible) {
			Keyboard.dismiss();
			onVisibleChange(false);
		}
	}, [focused, visible, onVisibleChange]);

	useLayoutEffect(() => {
		if (visible) markSheetPresented();
		else markSheetDismissed();
	}, [visible, markSheetPresented, markSheetDismissed]);

	useEffect(() => {
		if (!visible) return;
		const hide = Keyboard.addListener("keyboardDidHide", () =>
			onVisibleChange(false),
		);
		const back = BackHandler.addEventListener("hardwareBackPress", () => {
			Keyboard.dismiss();
			onVisibleChange(false);
			return true;
		});
		return () => {
			hide.remove();
			back.remove();
		};
	}, [visible, onVisibleChange]);

	const canSend = Boolean(draft.text.trim()) && !draft.isPending;
	return (
		<>
			{focused && scrolled && !visible && !keyboardVisible && !sheetsOpen ? (
				<View
					style={{
						position: "absolute",
						right: 20,
						bottom: Math.max(insets.bottom + 20, footerInset + 12),
						zIndex: 100,
					}}
				>
					<Pressable
						accessibilityRole="button"
						accessibilityLabel="Add a comment"
						haptic
						onPress={() => {
							if (!draft.text.trim()) draft.captureTimestamp();
							onVisibleChange(true);
						}}
						style={{
							width: 56,
							height: 56,
							borderRadius: 28,
							backgroundColor: colors.primary,
							alignItems: "center",
							justifyContent: "center",
							elevation: 6,
						}}
					>
						<Icon name="Plus" size={26} color={colors.primaryForeground} />
					</Pressable>
				</View>
			) : null}
			{visible ? (
				<KeyboardStickyView
					offset={{ closed: insets.bottom, opened: 0 }}
					style={{
						position: "absolute",
						bottom: 0,
						left: 0,
						right: 0,
						zIndex: 100,
					}}
				>
					<View
						style={{
							backgroundColor: colors.background,
							borderTopWidth: 1,
							borderColor: colors.border,
							paddingHorizontal: 16,
							paddingBottom: 12,
							paddingTop: 8,
							gap: 8,
							borderTopLeftRadius: 24,
							borderTopRightRadius: 24,
						}}
					>
						<View
							style={{
								width: 48,
								height: 5,
								borderRadius: 3,
								alignSelf: "center",
								backgroundColor: colors.mutedForeground,
								opacity: 0.4,
							}}
						/>
						<View
							style={{
								flexDirection: "row",
								alignItems: "center",
								justifyContent: "space-between",
							}}
						>
							<Text
								accessibilityRole="header"
								style={{
									color: colors.primary,
									fontSize: 12,
									fontWeight: "800",
									letterSpacing: 1.4,
								}}
							>
								ADD A COMMENT
							</Text>
							<Pressable
								onPress={close}
								accessibilityRole="button"
								accessibilityLabel="Close comment input"
								style={{
									width: 44,
									height: 44,
									alignItems: "center",
									justifyContent: "center",
								}}
							>
								<Icon name="X" size={20} color={colors.mutedForeground} />
							</Pressable>
						</View>
						<View
							style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
						>
							<View
								style={{
									flex: 1,
									minWidth: 0,
									minHeight: 48,
									flexDirection: "row",
									alignItems: "center",
									gap: 8,
									borderWidth: 1,
									borderColor: colors.primary,
									borderRadius: 24,
									backgroundColor: colors.card,
									paddingHorizontal: 16,
								}}
							>
								<Pressable
									onPress={draft.toggleTimestamp}
									disabled={draft.isPending}
									hitSlop={12}
									accessibilityRole="button"
									accessibilityLabel={
										draft.timestampEnabled
											? `Remove timestamp ${draft.timestampLabel}`
											: `Include timestamp ${draft.timestampLabel}`
									}
									accessibilityState={{
										selected: draft.timestampEnabled,
										disabled: draft.isPending,
									}}
									style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
								>
									<Icon
										name="Timer"
										size={16}
										color={
											draft.timestampEnabled
												? colors.primary
												: colors.mutedForeground
										}
									/>
									{draft.timestampEnabled ? (
										<Text
											style={{
												color: colors.primary,
												fontSize: 12,
												fontWeight: "700",
											}}
										>
											{draft.timestampLabel}
										</Text>
									) : null}
								</Pressable>
								<TextInput
									autoFocus
									value={draft.text}
									onChangeText={draft.setText}
									editable={!draft.isPending}
									maxLength={500}
									placeholder="Add a comment…"
									accessibilityLabel="New comment"
									placeholderTextColor={colors.mutedForeground}
									selectionColor={colors.primary}
									returnKeyType="send"
									submitBehavior="submit"
									onSubmitEditing={draft.handleSend}
									style={{
										minWidth: 0,
										flex: 1,
										minHeight: 48,
										color: colors.foreground,
										paddingHorizontal: 0,
										paddingVertical: 10,
										fontSize: 14,
									}}
								/>
							</View>
							<Pressable
								onPress={draft.handleSend}
								disabled={!canSend}
								accessibilityRole="button"
								accessibilityLabel={
									draft.isPending ? "Sending comment" : "Send comment"
								}
								accessibilityState={{
									disabled: !canSend,
									busy: draft.isPending,
								}}
								style={{
									width: 48,
									height: 48,
									borderRadius: 24,
									backgroundColor: canSend ? colors.primary : colors.muted,
									alignItems: "center",
									justifyContent: "center",
								}}
							>
								{draft.isPending ? (
									<ActivityIndicator color={colors.mutedForeground} />
								) : (
									<Icon
										name="ChevronRight"
										size={20}
										color={
											canSend
												? colors.primaryForeground
												: colors.mutedForeground
										}
									/>
								)}
							</Pressable>
						</View>
						{draft.error ? (
							<Text
								accessibilityRole="alert"
								style={{ color: colors.destructive, fontSize: 13 }}
							>
								{draft.error}
							</Text>
						) : null}
					</View>
				</KeyboardStickyView>
			) : null}
		</>
	);
}
