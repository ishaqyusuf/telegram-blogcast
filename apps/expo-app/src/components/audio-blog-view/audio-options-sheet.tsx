import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { useEffect, useRef, useState } from "react";
import { View } from "react-native";

import {
	AudioMoreControls,
	AudioOptionRow,
	AudioQuickAction,
} from "@/components/audio-blog-view/audio-options-actions";
import { FloatingBottomSheet } from "@/components/ui/floating-bottom-sheet";

export type AudioOptionsSheetProps = {
	canResetTranscription: boolean;
	hasAlbum: boolean;
	onAddArt: () => void;
	onAddToAlbum: () => void;
	onAddToPlaylist: () => void;
	onClose: () => void;
	onComment: () => void;
	onOpenLocalServices: () => void;
	onResetTranscription: () => void;
	onShare: () => void;
	onSleepTimer: () => void;
	onToggleTashkeel: () => void;
	onTranscribe: () => void;
	onViewAlbum: () => void;
	tashkeelEnabled: boolean;
	transcriptionActionLabel: string;
	visible: boolean;
};

export function AudioOptionsSheet(props: AudioOptionsSheetProps) {
	const [moreExpanded, setMoreExpanded] = useState(false);
	const pendingActionRef = useRef<(() => void) | null>(null);

	useEffect(() => {
		if (props.visible) setMoreExpanded(false);
	}, [props.visible]);

	const dismissThen = (action: () => void) => () => {
		if (pendingActionRef.current) return;
		pendingActionRef.current = action;
		props.onClose();
	};

	const handleDismissed = () => {
		const pendingAction = pendingActionRef.current;
		pendingActionRef.current = null;
		pendingAction?.();
	};

	return (
		<FloatingBottomSheet
			visible={props.visible}
			onClose={props.onClose}
			title="Audio options"
			accessibilityLabel="Audio options"
			scrollableContent
			onDismissed={handleDismissed}
		>
			<BottomSheetScrollView
				contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
			>
				<View className="flex-row gap-2">
					<AudioQuickAction
						icon="Share"
						label="Share"
						onPress={dismissThen(props.onShare)}
					/>
					<AudioQuickAction
						icon="MessageSquare"
						label="Comment"
						onPress={dismissThen(props.onComment)}
					/>
					<AudioQuickAction
						icon="Timer"
						label="Sleep timer"
						onPress={dismissThen(props.onSleepTimer)}
					/>
				</View>

				<View className="mt-3 gap-1">
					<AudioOptionRow
						icon="Captions"
						label={props.transcriptionActionLabel}
						onPress={dismissThen(props.onTranscribe)}
						showChevron
					/>
					<AudioOptionRow
						icon={props.hasAlbum ? "Disc3" : "ListMusic"}
						label={props.hasAlbum ? "View album" : "Add to album"}
						onPress={dismissThen(
							props.hasAlbum ? props.onViewAlbum : props.onAddToAlbum,
						)}
						showChevron
					/>
					<AudioOptionRow
						icon="ListMusic"
						label="Add to playlist"
						onPress={dismissThen(props.onAddToPlaylist)}
						showChevron
					/>
					<AudioOptionRow
						expanded={moreExpanded}
						icon="Settings"
						label="More controls"
						onPress={() => setMoreExpanded((expanded) => !expanded)}
					/>
					{moreExpanded ? (
						<AudioMoreControls
							canResetTranscription={props.canResetTranscription}
							hasAlbum={props.hasAlbum}
							onAddArt={dismissThen(props.onAddArt)}
							onChangeAlbum={dismissThen(props.onAddToAlbum)}
							onOpenLocalServices={dismissThen(
								props.onOpenLocalServices,
							)}
							onResetTranscription={dismissThen(
								props.onResetTranscription,
							)}
							onToggleTashkeel={props.onToggleTashkeel}
							tashkeelEnabled={props.tashkeelEnabled}
						/>
					) : null}
				</View>
			</BottomSheetScrollView>
		</FloatingBottomSheet>
	);
}
