import { useLocalServicesSession } from "@/components/local-services";
import { SafeArea } from "@/components/safe-area";
import { _trpc } from "@/components/static-trpc";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";
import { useQuery } from "@/lib/react-query";
import { useAppSettingsStore } from "@/store/app-settings-store";
import { useRouter } from "expo-router";
import { ActivityIndicator, FlatList, View } from "react-native";

export default function ChannelUpdateSettingsScreen() {
	const router = useRouter();
	const enabled = useAppSettingsStore((s) => s.channelAutoUpdateEnabled);
	const selectedIds = useAppSettingsStore((s) => s.channelAutoUpdateIds);
	const setEnabled = useAppSettingsStore((s) => s.setChannelAutoUpdateEnabled);
	const toggleChannel = useAppSettingsStore((s) => s.toggleChannelAutoUpdate);
	const { isEnabled, connectionStatus, requestSetup } =
		useLocalServicesSession();
	const channels = useQuery(
		_trpc.channel.getContentFilterChannels.queryOptions(),
	);
	const connected = isEnabled && connectionStatus === "online";

	return (
		<View className="flex-1 bg-background">
			<SafeArea>
				<View className="flex-row items-center gap-3 px-4 py-3">
					<Pressable
						accessibilityRole="button"
						accessibilityLabel="Back to settings"
						onPress={() => router.back()}
						className="size-11 items-center justify-center rounded-full bg-card"
					>
						<Icon name="ChevronLeft" size={22} className="text-foreground" />
					</Pressable>
					<Text className="flex-1 text-xl font-extrabold text-foreground">
						Channel updates
					</Text>
				</View>
				<FlatList
					data={channels.data ?? []}
					extraData={selectedIds}
					keyExtractor={(channel) => String(channel.id)}
					contentContainerClassName="px-4 pb-12"
					ListHeaderComponent={
						<View className="gap-4 pb-3">
							<View className="flex-row items-center gap-4 rounded-xl bg-card p-4">
								<View className="flex-1 gap-1">
									<Text className="text-base font-bold">
										Auto-update channels
									</Text>
									<Text className="text-sm text-muted-foreground">
										Update marked channels without opening a popup or progress
										screen.
									</Text>
								</View>
								<View className="min-h-11 min-w-11 items-center justify-center">
									<Switch
										accessibilityLabel="Auto-update channels"
										hitSlop={12}
										checked={enabled}
										onCheckedChange={setEnabled}
									/>
								</View>
							</View>
							<Text className="text-sm leading-5 text-muted-foreground">
								Checks every five minutes while the app is open and local
								services are connected. Started updates continue on your local
								service. Choices are saved on this device, even when auto-update
								is off.
							</Text>
							{!connected && (
								<View className="gap-2 rounded-xl bg-card p-3">
									<Text className="text-sm text-muted-foreground">
										Automatic updates will wait for local services to connect.
									</Text>
									<Button variant="outline" onPress={requestSetup}>
										<Text>Local services</Text>
									</Button>
								</View>
							)}
							<Button
								variant="outline"
								onPress={() => router.push("/channel-updates")}
							>
								<Text>View update progress</Text>
							</Button>
							<View className="gap-1 pt-2">
								<Text className="text-base font-bold">Channels to update</Text>
								<Text className="text-sm text-muted-foreground">
									{selectedIds.length === 0
										? "Mark channels below to start automatic updates."
										: `${selectedIds.length} marked · Changes save automatically`}
								</Text>
							</View>
							{channels.isError && (
								<View className="gap-2 py-2">
									<Text
										accessibilityRole="alert"
										className="text-sm text-destructive"
									>
										Could not refresh channels. Your saved choices are kept.
									</Text>
									<Button
										variant="outline"
										disabled={channels.isFetching}
										onPress={() => void channels.refetch()}
									>
										<Text>{channels.isFetching ? "Retrying…" : "Retry"}</Text>
									</Button>
								</View>
							)}
						</View>
					}
					ListEmptyComponent={
						channels.isPending ? (
							<ActivityIndicator
								accessibilityLabel="Loading channels"
								className="py-8"
							/>
						) : !channels.isError ? (
							<Text className="py-8 text-center text-sm text-muted-foreground">
								No saved channels yet. Import Telegram posts to include their
								channels here.
							</Text>
						) : null
					}
					renderItem={({ item }) => {
						const selected = selectedIds.includes(item.id);
						return (
							<Pressable
								accessibilityRole="checkbox"
								accessibilityState={{ checked: selected }}
								accessibilityLabel={item.title || item.username}
								onPress={() => toggleChannel(item.id)}
								className="min-h-16 flex-row items-center gap-3 border-b border-border py-4 active:opacity-70"
							>
								<View
									className={
										selected
											? "size-7 items-center justify-center rounded-md bg-primary"
											: "size-7 items-center justify-center rounded-md border border-border"
									}
								>
									{selected && (
										<Icon
											name="Check"
											size={18}
											className="text-primary-foreground"
										/>
									)}
								</View>
								<View className="flex-1 gap-1">
									<Text className="text-sm font-semibold" numberOfLines={2}>
										{item.title || item.username}
									</Text>
									<Text
										className="text-xs text-muted-foreground"
										numberOfLines={1}
									>
										@{item.username}
									</Text>
								</View>
							</Pressable>
						);
					}}
				/>
			</SafeArea>
		</View>
	);
}
