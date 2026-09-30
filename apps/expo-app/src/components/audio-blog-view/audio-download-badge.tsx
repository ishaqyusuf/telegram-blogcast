import { ActivityIndicator } from "react-native";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { useColors } from "@/hooks/use-color";

export function AudioDownloadBadge({
	downloaded,
	downloading,
	progress,
	error,
	disabled,
	onPress,
}: {
	downloaded: boolean;
	downloading: boolean;
	progress: number;
	error?: string | null;
	disabled?: boolean;
	onPress: () => void;
}) {
	const colors = useColors();
	if (downloaded) return null;

	return (
		<Pressable
			onPress={(event) => {
				event.stopPropagation();
				onPress();
			}}
			disabled={disabled || downloading}
			accessibilityRole="button"
			accessibilityLabel={
				downloading
					? `Downloading audio ${Math.round(progress * 100)} percent`
					: error
						? "Retry audio download"
						: "Download audio for offline use"
			}
			accessibilityState={{
				disabled: Boolean(disabled || downloading),
				busy: downloading,
			}}
			style={{
				position: "absolute",
				right: -8,
				bottom: -8,
				width: 30,
				height: 30,
				borderRadius: 15,
				borderWidth: 2,
				borderColor: colors.background,
				alignItems: "center",
				justifyContent: "center",
				backgroundColor: error ? colors.destructive : colors.primary,
				opacity: disabled ? 0.5 : 1,
			}}
		>
			{downloading ? (
				<ActivityIndicator size="small" color={colors.primaryForeground} />
			) : (
				<Icon name="Download" size={15} color={colors.primaryForeground} />
			)}
		</Pressable>
	);
}
