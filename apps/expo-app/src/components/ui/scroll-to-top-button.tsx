import { Pressable } from "@/components/ui/pressable";
import { Icon } from "@/components/ui/icon";
import { useColors } from "@/hooks/use-color";

export function ScrollToTopButton({
	visible,
	onPress,
	bottom = 24,
}: {
	visible: boolean;
	onPress: () => void;
	bottom?: number;
}) {
	const colors = useColors();
	if (!visible) return null;

	return (
		<Pressable
			accessibilityLabel="Scroll to top"
			onPress={onPress}
			style={{
				position: "absolute",
				alignSelf: "center",
				bottom,
				width: 48,
				height: 48,
				borderRadius: 24,
				alignItems: "center",
				justifyContent: "center",
				backgroundColor: colors.card,
				borderWidth: 1,
				borderColor: colors.border,
				shadowColor: "#000",
				shadowOffset: { width: 0, height: 6 },
				shadowOpacity: 0.22,
				shadowRadius: 10,
				elevation: 18,
				zIndex: 70,
			}}
		>
			<Icon name="ArrowUp" size={19} className="text-foreground" />
		</Pressable>
	);
}
