import { FloatingBottomSheet } from "@/components/ui/floating-bottom-sheet";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { useColors } from "@/hooks/use-color";
import {
	filterRecentLocalServiceIps,
	isValidIpv4Address,
	normalizeIpv4Input,
} from "@/lib/local-services-session";
import { useEffect, useMemo, useRef, useState } from "react";
import { Platform, ScrollView, TextInput, View } from "react-native";
import { KeyboardStickyView } from "react-native-keyboard-controller";

type LocalServicesLaunchSheetProps = {
	visible: boolean;
	activeIp: string | null;
	history: string[];
	onSelectIp: (ip: string) => void;
	onSkip: () => void;
	onDismissed: () => void;
};

export function LocalServicesLaunchSheet({
	visible,
	activeIp,
	history,
	onSelectIp,
	onSkip,
	onDismissed,
}: LocalServicesLaunchSheetProps) {
	const colors = useColors();
	const inputRef = useRef<TextInput>(null);
	const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const [ipInput, setIpInput] = useState("");
	const recentIps = useMemo(
		() =>
			filterRecentLocalServiceIps({
				activeIp,
				history,
				query: ipInput,
			}),
		[activeIp, history, ipInput],
	);
	const canSubmit = isValidIpv4Address(ipInput);

	useEffect(() => {
		if (!visible) return;
		setIpInput("");
		if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
		focusTimerRef.current = setTimeout(() => inputRef.current?.focus(), 250);
		return () => {
			if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
		};
	}, [visible]);

	const submit = () => {
		if (!canSubmit) return;
		onSelectIp(ipInput);
	};

	return (
		<FloatingBottomSheet
			visible={visible}
			onClose={onSkip}
			onDismissed={onDismissed}
			accessibilityLabel="Local network setup"
			hideHandle
			snapPoints={["62%"]}
			enableDynamicSizing={false}
			keyboardBehavior="interactive"
			keyboardBlurBehavior="restore"
			androidKeyboardInputMode="adjustResize"
		>
			<View className="h-full bg-card">
				<View className="flex-row items-start gap-3 border-b border-border px-5 pb-4 pt-5">
					<View className="size-11 items-center justify-center rounded-full bg-muted">
						<Icon name="Wifi" size={20} className="text-foreground" />
					</View>
					<View className="min-w-0 flex-1 gap-1">
						<Text className="text-lg font-extrabold text-foreground">
							Connect local services
						</Text>
						<Text className="text-sm leading-5 text-muted-foreground">
							Choose the network IP used for Telegram updates, Facebook
							import, and local transcription.
						</Text>
					</View>
					<Pressable
						haptic
						onPress={onSkip}
						accessibilityLabel="Close local network setup"
						accessibilityHint="Disables local services for this session"
						className="size-10 items-center justify-center rounded-full bg-muted active:opacity-70"
					>
						<Icon name="X" size={18} className="text-foreground" />
					</Pressable>
				</View>

				<ScrollView
					className="flex-1"
					contentContainerClassName="gap-1 px-5 py-4"
					keyboardDismissMode="interactive"
					keyboardShouldPersistTaps="handled"
					showsVerticalScrollIndicator={false}
				>
					<Text className="pb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
						Recently used
					</Text>
					{recentIps.length > 0 ? (
						recentIps.map((ip) => (
							<Pressable
								key={ip}
								haptic
								onPress={() => onSelectIp(ip)}
								accessibilityLabel={`Use local services IP ${ip}`}
								className="min-h-14 flex-row items-center gap-3 border-b border-border active:opacity-70"
							>
								<View className="size-9 items-center justify-center rounded-full bg-muted">
									<Icon
										name="HardDrive"
										size={17}
										className="text-muted-foreground"
									/>
								</View>
								<Text className="flex-1 text-base font-semibold text-foreground">
									{ip}
								</Text>
								<Icon
									name="ChevronRight"
									size={17}
									className="text-muted-foreground"
								/>
							</Pressable>
						))
					) : (
						<View className="items-center gap-2 py-10">
							<Icon
								name="Search"
								size={22}
								className="text-muted-foreground"
							/>
							<Text className="text-center text-sm font-semibold text-foreground">
								{ipInput ? "No matching recent IP" : "No recent IPs yet"}
							</Text>
							<Text className="text-center text-xs text-muted-foreground">
								Enter an IPv4 address below to continue.
							</Text>
						</View>
					)}
				</ScrollView>

				<KeyboardStickyView offset={{ closed: 0, opened: 0 }}>
					<View className="border-t border-border bg-card px-5 pb-5 pt-3">
						<View className="h-14 flex-row items-center gap-2 rounded-2xl border border-border bg-background px-3">
							<Icon
								name="HardDrive"
								size={17}
								className="text-muted-foreground"
							/>
							<Input
								ref={inputRef}
								value={ipInput}
								onChangeText={(value) =>
									setIpInput(normalizeIpv4Input(value))
								}
								onSubmitEditing={submit}
								autoCapitalize="none"
								autoCorrect={false}
								keyboardType={
									Platform.OS === "ios"
										? "numbers-and-punctuation"
										: "decimal-pad"
								}
								placeholder="192.168.1.20"
								placeholderTextColor={colors.mutedForeground}
								accessibilityLabel="Local services IPv4 address"
								className="h-full min-w-0 flex-1 border-0 bg-transparent p-0 text-base font-semibold shadow-none"
							/>
							<Pressable
								haptic
								disabled={!canSubmit}
								onPress={submit}
								accessibilityLabel="Use this local services IP"
								accessibilityHint="Enables local services for this session"
								className={
									canSubmit
										? "size-11 items-center justify-center rounded-full bg-primary active:opacity-80"
										: "size-11 items-center justify-center rounded-full bg-muted opacity-50"
								}
							>
								<Icon
									name="Check"
									size={19}
									className={
										canSubmit
											? "text-primary-foreground"
											: "text-muted-foreground"
									}
								/>
							</Pressable>
						</View>
					</View>
				</KeyboardStickyView>
			</View>
		</FloatingBottomSheet>
	);
}
