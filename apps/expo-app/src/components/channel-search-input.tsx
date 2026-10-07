import { Keyboard, TextInput, View } from "react-native";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { useColors } from "@/hooks/use-color";

export function ChannelSearchInput({
	value,
	onChangeText,
}: { value: string; onChangeText: (value: string) => void }) {
	const colors = useColors();
	return (
		<View className="mx-4 mb-3 min-h-12 flex-row items-center gap-2 rounded-xl bg-muted px-3">
			<Icon name="Search" size={18} className="text-muted-foreground" />
			<TextInput
				value={value}
				onChangeText={onChangeText}
				placeholder="Search channels by name or @username"
				placeholderTextColor={colors.mutedForeground}
				accessibilityLabel="Search channels"
				autoCapitalize="none"
				autoCorrect={false}
				returnKeyType="search"
				onSubmitEditing={Keyboard.dismiss}
				className="min-h-12 flex-1 text-sm text-foreground"
			/>
			{value ? (
				<Pressable
					onPress={() => onChangeText("")}
					accessibilityRole="button"
					accessibilityLabel="Clear channel search"
					className="size-11 items-center justify-center"
				>
					<Icon name="X" size={18} className="text-muted-foreground" />
				</Pressable>
			) : null}
		</View>
	);
}
