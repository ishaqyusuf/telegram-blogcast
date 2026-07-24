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
	type LocalServicesConnectionStatus,
	type LocalServicesDiscoveryProgress,
} from "@/lib/local-services-session";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Platform, ScrollView, View } from "react-native";
import { KeyboardStickyView } from "react-native-keyboard-controller";

type LocalServicesConnectionSheetProps = {
	visible: boolean;
	activeIp: string | null;
	checkingIp: string | null;
	connectionStatus: LocalServicesConnectionStatus;
	connectionError: string | null;
	discoveryProgress: LocalServicesDiscoveryProgress;
	history: string[];
	onSelectIp: (ip: string) => Promise<boolean>;
	onFindConnection: () => Promise<boolean>;
	onRetryConnection: () => Promise<boolean>;
	onClose: () => void;
};

export function LocalServicesConnectionSheet({
	visible,
	activeIp,
	checkingIp,
	connectionStatus,
	connectionError,
	discoveryProgress,
	history,
	onSelectIp,
	onFindConnection,
	onRetryConnection,
	onClose,
}: LocalServicesConnectionSheetProps) {
	const colors = useColors();
	const wasVisibleRef = useRef(false);
	const previousConnectionStatusRef =
		useRef<LocalServicesConnectionStatus>(connectionStatus);
	const [ipInput, setIpInput] = useState("");
	const [showAddressPicker, setShowAddressPicker] = useState(false);
	const isResolving = checkingIp !== null;
	const isConnected = connectionStatus === "online";
	const recentIps = useMemo(
		() =>
			filterRecentLocalServiceIps({
				activeIp,
				history,
				query: ipInput,
			}),
		[activeIp, history, ipInput],
	);
	const canSubmit = isValidIpv4Address(ipInput) && !isResolving;

	useEffect(() => {
		if (visible && !wasVisibleRef.current) {
			setIpInput("");
			setShowAddressPicker(connectionStatus !== "online");
		} else if (
			visible &&
			previousConnectionStatusRef.current !== "online" &&
			connectionStatus === "online"
		) {
			setShowAddressPicker(false);
		}
		wasVisibleRef.current = visible;
		previousConnectionStatusRef.current = connectionStatus;
	}, [connectionStatus, visible]);

	const connectToIp = async (ip: string) => {
		const connected = await onSelectIp(ip);
		if (connected) setShowAddressPicker(false);
	};

	const submit = () => {
		if (!canSubmit) return;
		void connectToIp(ipInput);
	};

	const title = isResolving
		? "Checking local services"
		: isConnected && !showAddressPicker
			? "Connected"
			: "Connect local services";

	return (
		<FloatingBottomSheet
			visible={visible}
			onClose={onClose}
			accessibilityLabel="Local services connection"
			hideHandle
			snapPoints={["68%"]}
			enableDynamicSizing={false}
			keyboardBehavior="interactive"
			keyboardBlurBehavior="restore"
			androidKeyboardInputMode="adjustResize"
		>
			<View className="h-full bg-card">
				<View className="flex-row items-start gap-3 border-b border-border px-5 pb-4 pt-5">
					<View
						className={
							isConnected && !isResolving
								? "size-11 items-center justify-center rounded-full bg-success/15"
								: "size-11 items-center justify-center rounded-full bg-muted"
						}
					>
						{isResolving ? (
							<ActivityIndicator size="small" color={colors.primary} />
						) : (
							<Icon
								name={isConnected ? "Wifi" : "WifiOff"}
								size={20}
								className={
									isConnected ? "text-success" : "text-muted-foreground"
								}
							/>
						)}
					</View>
					<View className="min-w-0 flex-1 gap-1">
						<Text className="text-lg font-extrabold text-foreground">
							{title}
						</Text>
						<Text className="text-sm leading-5 text-muted-foreground">
							{isResolving
								? checkingIp
									? `Trying ${checkingIp}`
									: "Looking for a saved address"
								: isConnected && activeIp
									? `Local API is available at ${activeIp}.`
									: "Find your computer on this Wi-Fi or enter its LAN IP."}
						</Text>
					</View>
					<Pressable
						haptic
						onPress={onClose}
						accessibilityLabel="Close local services"
						className="size-10 items-center justify-center rounded-full bg-muted active:opacity-70"
					>
						<Icon name="X" size={18} className="text-foreground" />
					</Pressable>
				</View>

				{isResolving ? (
					<View className="flex-1 items-center justify-center gap-4 px-6">
						<ActivityIndicator size="large" color={colors.primary} />
						<View className="gap-1">
							<Text className="text-center text-base font-bold text-foreground">
								Checking {checkingIp}
							</Text>
							<Text className="text-center text-sm text-muted-foreground">
								{discoveryProgress?.total
									? `Address ${Math.min(
											discoveryProgress.attempted,
											discoveryProgress.total,
										)} of ${discoveryProgress.total}`
									: "Waiting for the local API health check"}
							</Text>
						</View>
					</View>
				) : isConnected && !showAddressPicker ? (
					<View className="flex-1 gap-5 px-5 py-6">
						<View className="items-center gap-3 rounded-2xl border border-border bg-background px-5 py-7">
							<View className="size-14 items-center justify-center rounded-full bg-success/15">
								<Icon name="CheckCircle2" size={27} className="text-success" />
							</View>
							<View className="gap-1">
								<Text className="text-center text-base font-extrabold text-foreground">
									Connected to local services
								</Text>
								<Text className="text-center text-sm text-muted-foreground">
									{activeIp}
								</Text>
							</View>
						</View>
						<View className="flex-row gap-3">
							<Pressable
								haptic
								onPress={() => void onRetryConnection()}
								accessibilityLabel="Check local services again"
								className="min-h-12 flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-secondary px-4 active:opacity-70"
							>
								<Icon name="RefreshCw" size={17} className="text-foreground" />
								<Text className="text-sm font-bold text-foreground">
									Check again
								</Text>
							</Pressable>
							<Pressable
								haptic
								onPress={() => setShowAddressPicker(true)}
								accessibilityLabel="Change local services address"
								className="min-h-12 flex-1 items-center justify-center rounded-xl bg-primary px-4 active:opacity-80"
							>
								<Text className="text-sm font-bold text-primary-foreground">
									Change address
								</Text>
							</Pressable>
						</View>
					</View>
				) : (
					<>
						<ScrollView
							className="flex-1"
							contentContainerClassName="gap-3 px-5 py-4"
							keyboardDismissMode="interactive"
							keyboardShouldPersistTaps="handled"
							showsVerticalScrollIndicator={false}
						>
							{connectionError ? (
								<View className="flex-row gap-2 rounded-xl bg-destructive/10 px-3 py-3">
									<Icon
										name="AlertCircle"
										size={17}
										className="mt-0.5 text-destructive"
									/>
									<Text className="min-w-0 flex-1 text-xs leading-5 text-destructive">
										{connectionError}
									</Text>
								</View>
							) : null}

							<Pressable
								haptic
								onPress={() => void onFindConnection()}
								accessibilityLabel="Find local services from saved addresses"
								className="min-h-12 flex-row items-center justify-center gap-2 rounded-xl bg-primary px-4 active:opacity-80"
							>
								<Icon
									name="RefreshCw"
									size={17}
									className="text-primary-foreground"
								/>
								<Text className="text-sm font-bold text-primary-foreground">
									Find saved services
								</Text>
							</Pressable>

							<Text className="pt-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
								Recently connected
							</Text>
							{recentIps.length > 0 ? (
								recentIps.map((ip) => (
									<Pressable
										key={ip}
										haptic
										onPress={() => {
											setIpInput(ip);
											void connectToIp(ip);
										}}
										accessibilityLabel={`Connect to local services at ${ip}`}
										className="min-h-13 flex-row items-center gap-3 rounded-xl border border-border bg-background px-3 active:opacity-70"
									>
										<View className="size-9 items-center justify-center rounded-full bg-muted">
											<Icon
												name="HardDrive"
												size={17}
												className="text-muted-foreground"
											/>
										</View>
										<Text className="flex-1 text-sm font-semibold text-foreground">
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
								<Text className="py-4 text-center text-sm text-muted-foreground">
									{ipInput
										? "No matching successful addresses."
										: "No successful addresses saved yet."}
								</Text>
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
										placeholder="Computer IP, e.g. 192.168.1.20"
										placeholderTextColor={colors.mutedForeground}
										accessibilityLabel="Computer local services IPv4 address"
										className="h-full min-w-0 flex-1 border-0 bg-transparent p-0 text-sm font-semibold shadow-none"
									/>
									<Pressable
										haptic
										disabled={!canSubmit}
										onPress={submit}
										accessibilityLabel="Connect to this local services IP"
										className={
											canSubmit
												? "size-11 items-center justify-center rounded-full bg-primary active:opacity-80"
												: "size-11 items-center justify-center rounded-full bg-muted opacity-50"
										}
									>
										<Icon
											name="ChevronRight"
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
					</>
				)}
			</View>
		</FloatingBottomSheet>
	);
}
