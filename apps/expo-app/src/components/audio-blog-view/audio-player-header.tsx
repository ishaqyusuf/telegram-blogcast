import { Text, View, useWindowDimensions } from "react-native";

import { LocalServicesConnectionButton } from "@/components/local-services";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";

type AudioPlayerHeaderProps = {
	canOpenContext: boolean;
	contextName: string;
	contextType: "Album" | "Channel";
	localServicesEnabled: boolean;
	onClose: () => void;
	onOpenContext: () => void;
	onOpenMore: () => void;
	onOpenTranscript: () => void;
	onOpenTranscription: () => void;
	transcriptStatusLabel?: string | null;
};

export function AudioPlayerHeader({
	canOpenContext,
	contextName,
	contextType,
	localServicesEnabled,
	onClose,
	onOpenContext,
	onOpenMore,
	onOpenTranscript,
	onOpenTranscription,
	transcriptStatusLabel,
}: AudioPlayerHeaderProps) {
	const { fontScale, width } = useWindowDimensions();
	const isCompact = width < 340 || fontScale >= 1.3;
	const isRtlContext = /[\u0590-\u08ff]/.test(contextName);
	const isolatedContextName = `${isRtlContext ? "\u2067" : "\u2066"}${contextName}\u2069`;

	return (
		<View style={{ paddingHorizontal: 16, paddingTop: 8, direction: "ltr" }}>
			<View style={{ minHeight: 52, flexDirection: "row", alignItems: "center", direction: "ltr" }}>
				<Pressable
					onPress={onClose}
					className="size-11 items-center justify-center rounded-full active:bg-black/20"
					accessibilityRole="button"
					accessibilityLabel="Close player"
				>
					<Icon name="ChevronDown" className="size-base text-media-foreground" />
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
					<Icon name="MoreHorizontal" className="size-base text-media-foreground" />
				</Pressable>
			</View>
			{transcriptStatusLabel || !isCompact ? (
				<View style={{ minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 8, direction: "ltr" }}>
					{!isCompact ? <LocalServicesConnectionButton appearance="plain" /> : null}
					{transcriptStatusLabel ? (
						<Pressable
							onPress={onOpenTranscript}
							className="min-h-11 min-w-11 max-w-44 justify-center rounded-full active:opacity-75"
							accessibilityRole="button"
							accessibilityLabel={`Open ${transcriptStatusLabel.toLowerCase()}`}
						>
							<View style={{ height: 40, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderRadius: 999, paddingHorizontal: 12, backgroundColor: "rgba(255,255,255,0.11)" }}>
								<Icon name="FileText" className="size-base text-media-foreground" />
								<Text numberOfLines={1} style={{ color: "#ffffff", fontSize: 12, fontWeight: "700" }}>
									{transcriptStatusLabel}
								</Text>
							</View>
						</Pressable>
					) : null}
					{!isCompact ? (
						<Pressable
							onPress={onOpenTranscription}
							className={localServicesEnabled ? "size-11 items-center justify-center rounded-full active:bg-black/20" : "size-11 items-center justify-center rounded-full opacity-60 active:bg-black/20"}
							accessibilityRole="button"
							accessibilityLabel={localServicesEnabled ? "Transcription options" : "Enable local services"}
						>
							<Icon name="Captions" className="size-base text-media-foreground" />
						</Pressable>
					) : null}
				</View>
			) : null}
		</View>
	);
}
