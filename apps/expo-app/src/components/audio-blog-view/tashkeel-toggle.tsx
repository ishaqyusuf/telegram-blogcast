import { ActivityIndicator, Text } from "react-native";

import { Pressable } from "@/components/ui/pressable";

type TashkeelToggleProps = {
	enabled: boolean;
	isLoading?: boolean;
	onPress: () => void;
	size?: "compact" | "regular";
};

export function TashkeelToggle({
	enabled,
	isLoading = false,
	onPress,
	size = "regular",
}: TashkeelToggleProps) {
	const dimensionClass = size === "compact" ? "size-10" : "size-11";

	return (
		<Pressable
			onPress={onPress}
			className={`${dimensionClass} items-center justify-center rounded-full ${
				enabled ? "bg-white/20" : "active:bg-white/10"
			}`}
			accessibilityRole="switch"
			accessibilityState={{ checked: enabled, busy: isLoading }}
			accessibilityLabel={
				enabled ? "Hide Arabic vowel marks" : "Show Arabic vowel marks"
			}
			hitSlop={6}
		>
			{isLoading ? (
				<ActivityIndicator size="small" color="#ffffff" />
			) : (
				<Text
					style={{
						color: enabled ? "#facc15" : "#ffffff",
						fontSize: 17,
						fontWeight: "900",
						writingDirection: "rtl",
					}}
				>
					عَ
				</Text>
			)}
		</Pressable>
	);
}
