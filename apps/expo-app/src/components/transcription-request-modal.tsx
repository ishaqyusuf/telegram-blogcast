import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { useColors } from "@/hooks/use-color";
import { ActivityIndicator, Modal, Text, View } from "react-native";

type TranscriptionRequestModalProps = {
	visible: boolean;
	mediaKind: "audio" | "video";
	title: string;
	statusLabel?: string | null;
	isStarting?: boolean;
	canStart?: boolean;
	onClose: () => void;
	onStart: () => void;
};

export function TranscriptionRequestModal({
	visible,
	mediaKind,
	title,
	statusLabel,
	isStarting = false,
	canStart = true,
	onClose,
	onStart,
}: TranscriptionRequestModalProps) {
	const colors = useColors();
	const disabled = isStarting || !canStart;
	const kindLabel = mediaKind === "video" ? "video" : "audio";

	return (
		<Modal
			visible={visible}
			transparent
			animationType="slide"
			onRequestClose={onClose}
		>
			<View className="flex-1 justify-end bg-black/60">
				<Pressable className="flex-1" onPress={onClose} />
				<View className="gap-4 rounded-t-3xl bg-card px-4 pb-6 pt-4">
					<View className="items-center">
						<View className="h-1.5 w-12 rounded-full bg-muted" />
					</View>

					<View className="flex-row items-start gap-3">
						<View className="size-11 items-center justify-center rounded-full bg-secondary">
							<Icon name="Captions" size={21} className="text-foreground" />
						</View>
						<View className="flex-1 gap-1">
							<Text className="text-lg font-extrabold text-foreground">
								Transcribe {kindLabel}
							</Text>
							<Text
								className="text-sm font-semibold text-muted-foreground"
								numberOfLines={2}
							>
								{title}
							</Text>
						</View>
						<Pressable
							onPress={onClose}
							className="size-9 items-center justify-center rounded-full bg-background"
						>
							<Icon name="X" size={18} className="text-foreground" />
						</Pressable>
					</View>

					<View className="rounded-2xl bg-background p-4">
						<Text className="text-sm leading-6 text-muted-foreground">
							This will add the {kindLabel} to the local Whisper transcription
							queue. It only starts when you request it here.
						</Text>
						{statusLabel ? (
							<Text className="mt-2 text-xs font-bold text-primary">
								{statusLabel}
							</Text>
						) : null}
					</View>

					<Pressable
						disabled={disabled}
						onPress={onStart}
						className={
							disabled
								? "flex-row items-center justify-center gap-2 rounded-xl bg-muted px-4 py-3 opacity-70"
								: "flex-row items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3"
						}
					>
						{isStarting ? (
							<ActivityIndicator size="small" color={colors.background} />
						) : (
							<Icon
								name="Captions"
								size={18}
								className={
									disabled ? "text-muted-foreground" : "text-primary-foreground"
								}
							/>
						)}
						<Text
							className={
								disabled
									? "text-sm font-extrabold text-muted-foreground"
									: "text-sm font-extrabold text-primary-foreground"
							}
						>
							{isStarting ? "Queueing" : "Start transcribe"}
						</Text>
					</Pressable>
				</View>
			</View>
		</Modal>
	);
}
