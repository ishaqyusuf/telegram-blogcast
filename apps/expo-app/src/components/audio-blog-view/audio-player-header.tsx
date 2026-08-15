import { Text, View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";

type AudioPlayerHeaderProps = {
	canOpenContext: boolean;
	contextName: string;
	contextType: "Album" | "Channel";
	onClose: () => void;
	onOpenContext: () => void;
	onOpenMore: () => void;
};

export function AudioPlayerHeader({
	canOpenContext,
	contextName,
	contextType,
	onClose,
	onOpenContext,
	onOpenMore,
}: AudioPlayerHeaderProps) {
	const isRtlContext = /[\u0590-\u08ff]/.test(contextName);
	const isolatedContextName = `${isRtlContext ? "\u2067" : "\u2066"}${contextName}\u2069`;

	return (
		<View style={{ paddingHorizontal: 16, paddingTop: 8, direction: "ltr" }}>
			<View
				style={{
					minHeight: 52,
					flexDirection: "row",
					alignItems: "center",
					direction: "ltr",
				}}
			>
				<Pressable
					onPress={onClose}
					className="size-11 items-center justify-center rounded-full active:bg-black/20"
					accessibilityRole="button"
					accessibilityLabel="Close player"
				>
					<Icon
						name="ChevronDown"
						className="size-base text-media-foreground"
					/>
				</Pressable>
				<Pressable
					disabled={!canOpenContext}
					onPress={onOpenContext}
					className="min-h-11 min-w-0 flex-1 justify-center px-2 py-1 active:opacity-70"
					accessibilityRole={canOpenContext ? "link" : undefined}
					accessibilityLabel={`Playing from ${contextType.toLowerCase()} ${contextName}`}
				>
					<Text
						numberOfLines={1}
						style={{
							color: "rgba(255,255,255,0.68)",
							fontSize: 11,
							fontWeight: "600",
							letterSpacing: 0.2,
						}}
					>
						Playing from {contextType.toLowerCase()}
					</Text>
					<Text
						numberOfLines={1}
						ellipsizeMode="tail"
						style={{
							marginTop: 4,
							color: "#ffffff",
							fontSize: 14,
							fontWeight: "500",
							lineHeight: 20,
							textAlign: isRtlContext ? "right" : "left",
							writingDirection: isRtlContext ? "rtl" : "ltr",
						}}
					>
						{isolatedContextName}
					</Text>
				</Pressable>
				<Pressable
					onPress={onOpenMore}
					className="size-11 items-center justify-center rounded-full active:bg-black/20"
					accessibilityRole="button"
					accessibilityLabel="More player options"
				>
					<Icon
						name="MoreHorizontal"
						className="size-base text-media-foreground"
					/>
				</Pressable>
			</View>
		</View>
	);
}
