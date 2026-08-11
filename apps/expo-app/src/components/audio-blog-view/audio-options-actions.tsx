import { Text, View } from "react-native";

import { Icon, type IconKeys } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";

type AudioActionProps = {
	icon: IconKeys;
	label: string;
	onPress: () => void;
};

export function AudioQuickAction({ icon, label, onPress }: AudioActionProps) {
	return (
		<Pressable
			haptic
			transition
			onPress={onPress}
			className="min-h-16 min-w-11 flex-1 items-center justify-center gap-1.5 rounded-2xl bg-muted active:opacity-70"
			accessibilityRole="button"
			accessibilityLabel={label}
		>
			<Icon name={icon} className="size-base text-foreground" />
			<Text className="text-xs font-semibold text-foreground" numberOfLines={1}>
				{label}
			</Text>
		</Pressable>
	);
}

type AudioOptionRowProps = AudioActionProps & {
	checked?: boolean;
	expanded?: boolean;
	showChevron?: boolean;
	value?: string;
};

export function AudioOptionRow({
	checked,
	expanded,
	icon,
	label,
	onPress,
	showChevron = false,
	value,
}: AudioOptionRowProps) {
	const isSwitch = checked !== undefined;
	const isDisclosure = expanded !== undefined;

	return (
		<Pressable
			haptic
			transition
			onPress={onPress}
			className="min-h-12 flex-row items-center gap-3 rounded-xl px-3 active:bg-muted"
			accessibilityRole={isSwitch ? "switch" : "button"}
			accessibilityState={
				isSwitch
					? { checked }
					: isDisclosure
						? { expanded }
						: undefined
			}
		>
			<Icon name={icon} className="size-base text-muted-foreground" />
			<Text
				className="min-w-0 flex-1 text-sm font-medium text-foreground"
				numberOfLines={1}
			>
				{label}
			</Text>
			{value ? (
				<Text className="text-xs font-medium text-muted-foreground">
					{value}
				</Text>
			) : null}
			{showChevron || isDisclosure ? (
				<Icon
					name={isDisclosure && expanded ? "ChevronUp" : "ChevronRight"}
					className="size-sm text-muted-foreground"
				/>
			) : null}
		</Pressable>
	);
}

export type AudioMoreControlsProps = {
	canResetTranscription: boolean;
	hasAlbum: boolean;
	onAddArt: () => void;
	onChangeAlbum: () => void;
	onOpenLocalServices: () => void;
	onResetTranscription: () => void;
	onToggleTashkeel: () => void;
	tashkeelEnabled: boolean;
};

export function AudioMoreControls(props: AudioMoreControlsProps) {
	return (
		<View className="mt-1 gap-1 border-t border-border pt-1">
			<AudioOptionRow
				icon="Wifi"
				label="Local services"
				onPress={props.onOpenLocalServices}
				showChevron
			/>
			<AudioOptionRow
				checked={props.tashkeelEnabled}
				icon="Sparkles"
				label="Arabic vowel marks"
				onPress={props.onToggleTashkeel}
				value={props.tashkeelEnabled ? "On" : "Off"}
			/>
			{props.canResetTranscription ? (
				<AudioOptionRow
					icon="RotateCcw"
					label="Reset transcript"
					onPress={props.onResetTranscription}
					showChevron
				/>
			) : null}
			{props.hasAlbum ? (
				<AudioOptionRow
					icon="ListMusic"
					label="Change album"
					onPress={props.onChangeAlbum}
					showChevron
				/>
			) : null}
			<AudioOptionRow
				icon="Image"
				label="Add/Edit artwork"
				onPress={props.onAddArt}
				showChevron
			/>
		</View>
	);
}
