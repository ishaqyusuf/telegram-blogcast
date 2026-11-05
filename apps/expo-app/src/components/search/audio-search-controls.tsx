import {
	BottomSheetFlatList,
	BottomSheetTextInput,
} from "@gorhom/bottom-sheet";
import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { FloatingBottomSheet } from "@/components/ui/floating-bottom-sheet";
import { Pressable } from "@/components/ui/pressable";
import { useColors } from "@/hooks/use-color";

export type AudioSearchChannel = {
	id: number;
	title?: string | null;
	username?: string | null;
};
export type AudioSearchView = "tracks" | "albums";
export type AlbumFilter = "in" | "not" | undefined;
export function AudioSearchControls({
	view,
	onView,
	channel,
	onChannel,
	channels,
	membership,
	onMembership,
	selecting,
	onSelect,
	onCancel,
}: {
	view: AudioSearchView;
	onView: (view: AudioSearchView) => void;
	channel: AudioSearchChannel | null;
	onChannel: (channel: AudioSearchChannel | null) => void;
	channels: AudioSearchChannel[];
	membership: AlbumFilter;
	onMembership: (filter: AlbumFilter) => void;
	selecting: boolean;
	onSelect: () => void;
	onCancel: () => void;
}) {
	const [showChannels, setShowChannels] = useState(false);
	const [term, setTerm] = useState("");
	const colors = useColors();
	const visible = channels.filter((item) =>
		`${item.title} ${item.username}`
			.toLowerCase()
			.includes(term.trim().toLowerCase()),
	);
	return (
		<>
			<View className="px-4 pt-3 gap-3">
				<View
					accessibilityRole="tablist"
					className="flex-row rounded-xl bg-card p-1"
				>
					{(["tracks", "albums"] as const).map((value) => (
						<Pressable
							key={value}
							accessibilityRole="tab"
							accessibilityState={{ selected: view === value }}
							onPress={() => onView(value)}
							className={`flex-1 min-h-10 rounded-lg items-center justify-center ${view === value ? "bg-primary" : ""}`}
						>
							<Text
								className={
									view === value
										? "font-semibold text-primary-foreground"
										: "font-semibold text-muted-foreground"
								}
							>
								{value === "tracks" ? "Tracks" : "Albums"}
							</Text>
						</Pressable>
					))}
				</View>
				<Pressable
					accessibilityLabel={`${view === "albums" ? "Album" : "Source"} channel filter`}
					onPress={() => setShowChannels(true)}
					className="rounded-full bg-card py-3 px-4 self-start max-w-full"
				>
					<Text className="text-foreground" numberOfLines={1}>
						{view === "albums" ? "Album channel" : "Source channel"}:{" "}
						{channel?.title || channel?.username || "All channels"} ▾
					</Text>
				</Pressable>
				{view === "tracks" ? (
					<ScrollView
						horizontal
						showsHorizontalScrollIndicator={false}
						contentContainerStyle={{ gap: 8, paddingBottom: 12 }}
					>
						{(
							[
								{ label: "All audio", value: undefined },
								{ label: "In an album", value: "in" },
								{ label: "Not in an album", value: "not" },
							] as const
						).map((item) => (
							<Pressable
								key={item.label}
								accessibilityRole="radio"
								accessibilityState={{ checked: membership === item.value }}
								onPress={() => onMembership(item.value)}
								className={`min-h-10 justify-center rounded-full border px-3 ${membership === item.value ? "bg-primary border-primary" : "bg-card border-border"}`}
							>
								<Text
									className={
										membership === item.value
											? "text-primary-foreground font-semibold"
											: "text-foreground"
									}
								>
									{item.label}
								</Text>
							</Pressable>
						))}
						<Pressable
							onPress={selecting ? onCancel : onSelect}
							className="min-h-10 justify-center px-3"
						>
							<Text className="text-primary font-semibold">
								{selecting ? "Cancel selection" : "Select"}
							</Text>
						</Pressable>
					</ScrollView>
				) : (
					<Text className="text-xs text-muted-foreground pb-3">
						Albums are grouped by their home channel. Tracks keep their source
						channel.
					</Text>
				)}
			</View>
			{showChannels ? (
				<FloatingBottomSheet
					visible
					onClose={() => setShowChannels(false)}
					title="Filter by channel"
					snapPoints={["75%"]}
					enableDynamicSizing={false}
					scrollableContent
					keyboardBehavior="extend"
					androidKeyboardInputMode="adjustResize"
				>
					<View className="px-4 pb-3">
						<BottomSheetTextInput
							accessibilityLabel="Search channels"
							placeholder="Search channels…"
							placeholderTextColor={colors.mutedForeground}
							value={term}
							onChangeText={setTerm}
							style={{
								color: colors.foreground,
								backgroundColor: colors.muted,
								borderRadius: 12,
								padding: 14,
							}}
						/>
					</View>
					<BottomSheetFlatList
						data={visible}
						keyExtractor={(item) => String(item.id)}
						keyboardShouldPersistTaps="handled"
						contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 28 }}
						ListHeaderComponent={
							<Pressable
								onPress={() => {
									onChannel(null);
									setShowChannels(false);
								}}
								className="py-4"
							>
								<Text className="text-primary font-semibold">
									All channels {!channel ? "✓" : ""}
								</Text>
							</Pressable>
						}
						ListEmptyComponent={
							<Text className="text-muted-foreground py-4">
								No matching channels
							</Text>
						}
						renderItem={({ item }) => (
							<Pressable
								accessibilityRole="radio"
								accessibilityState={{ checked: item.id === channel?.id }}
								onPress={() => {
									onChannel(item);
									setShowChannels(false);
								}}
								className="min-h-14 py-4 border-b border-border"
							>
								<Text className="text-foreground font-semibold">
									{item.title || item.username}{" "}
									{item.id === channel?.id ? "✓" : ""}
								</Text>
							</Pressable>
						)}
					/>
				</FloatingBottomSheet>
			) : null}
		</>
	);
}
