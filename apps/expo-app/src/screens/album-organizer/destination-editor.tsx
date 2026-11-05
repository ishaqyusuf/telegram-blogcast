import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { useColors } from "@/hooks/use-color";
import { Text, TextInput, View } from "react-native";
import type { Draft } from "./use-review-draft";

export function DestinationEditor({
	draft,
	change,
	saving,
	channelAlbums,
	error,
	onDone,
}: {
	draft: Draft;
	change: (draft: Draft) => void;
	saving: boolean;
	channelAlbums: { id: number; name: string }[];
	error?: string;
	onDone: () => void;
}) {
	const colors = useColors();
	return (
		<View className="gap-3">
			<Pressable
				disabled={saving}
				onPress={() => change({ ...draft, targetAlbumId: null })}
				className="min-h-11 justify-center"
			>
				<Text className="font-bold text-primary">Create a new album</Text>
			</Pressable>
			{draft.targetAlbumId == null ? (
				<TextInput
					accessibilityLabel="New album name"
					value={draft.name}
					editable={!saving}
					maxLength={200}
					onChangeText={(name) => change({ ...draft, name })}
					placeholder="Album name"
					placeholderTextColor={colors.mutedForeground}
					className="rounded-xl border border-border bg-background px-3 py-3 text-base text-foreground"
				/>
			) : null}
			<Text className="text-xs text-muted-foreground">
				Or choose an existing album
			</Text>
			{error ? <Text className="text-destructive">{error}</Text> : null}
			{channelAlbums.map((album) => (
				<Pressable
					key={album.id}
					disabled={saving}
					accessibilityRole="radio"
					accessibilityState={{
						selected: draft.targetAlbumId === album.id,
					}}
					onPress={() =>
						change({
							...draft,
							targetAlbumId: album.id,
							name: album.name,
						})
					}
					className="min-h-11 flex-row items-center gap-2 border-b border-border py-2"
				>
					{draft.targetAlbumId === album.id ? (
						<Icon name="CheckCircle2" size={20} className="text-primary" />
					) : (
						<View className="size-5 rounded-full border border-border" />
					)}
					<Text className="flex-1 text-foreground">{album.name}</Text>
				</Pressable>
			))}
			<Pressable onPress={() => onDone()} className="min-h-11 justify-center">
				<Text className="font-bold text-primary">Done</Text>
			</Pressable>
		</View>
	);
}
