import { FloatingBottomSheet } from "@/components/ui/floating-bottom-sheet";
import { Pressable } from "@/components/ui/pressable";
import { useNativeBuildUpdate } from "@/hooks/use-native-build-update";
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import {
	ActivityIndicator,
	Text,
	View,
	useWindowDimensions,
} from "react-native";

const DISMISS_KEY = "native-build-dismiss-v1";

export function NativeBuildUpdatePrompt({ enabled }: { enabled: boolean }) {
	const update = useNativeBuildUpdate(enabled);
	const [dismissedRevision, setDismissedRevision] = useState<number | null>(
		null,
	);
	const [ready, setReady] = useState(false);
	const [bodyHeight, setBodyHeight] = useState(120);
	const [footerHeight, setFooterHeight] = useState(48);
	const { height } = useWindowDimensions();
	useEffect(() => {
		let mounted = true;
		void AsyncStorage.getItem(DISMISS_KEY)
			.then((raw) => {
				try {
					const saved = JSON.parse(raw ?? "null");
					if (mounted && saved?.until > Date.now())
						setDismissedRevision(saved.revision);
				} catch {
					/* Ignore damaged preferences. */
				}
			})
			.catch(() => undefined)
			.finally(() => {
				if (mounted) setReady(true);
			});
		return () => {
			mounted = false;
		};
	}, []);
	const dismiss = () => {
		if (!update.build || update.opening) return;
		setDismissedRevision(update.build.revision);
		void AsyncStorage.setItem(
			DISMISS_KEY,
			JSON.stringify({
				revision: update.build.revision,
				until: Date.now() + 86400000,
			}),
		).catch(() => undefined);
	};
	return (
		<FloatingBottomSheet
			visible={
				enabled &&
				ready &&
				!!update.build &&
				update.build.revision !== dismissedRevision
			}
			onClose={dismiss}
			title="New app build available"
			maxDynamicContentSize={height * 0.44}
		>
			<View className="gap-4 px-5 pb-5">
				<BottomSheetScrollView
					style={{
						height: Math.min(
							bodyHeight,
							Math.max(40, height * 0.44 - 100 - footerHeight),
						),
					}}
				>
					<View
						onLayout={(event) => setBodyHeight(event.nativeEvent.layout.height)}
						className="gap-3"
					>
						<Text className="text-base text-foreground">
							Version {update.build?.appVersion} · Build{" "}
							{update.build?.buildNumber}
						</Text>
						<Text className="text-sm leading-5 text-muted-foreground">
							Download the new Preview APK, then approve installation on
							Android. Install over the current app to keep your data.
						</Text>
						{update.error ? (
							<Text
								accessibilityRole="alert"
								className="text-sm text-destructive"
							>
								{update.error}
							</Text>
						) : null}
					</View>
				</BottomSheetScrollView>
				<View
					onLayout={(event) => setFooterHeight(event.nativeEvent.layout.height)}
					className="flex-row gap-3"
				>
					<Pressable
						accessibilityRole="button"
						onPress={dismiss}
						disabled={update.opening}
						className="flex-1 items-center rounded-xl bg-secondary py-3.5"
					>
						<Text className="font-semibold text-foreground">Later</Text>
					</Pressable>
					<Pressable
						accessibilityRole="button"
						onPress={() => void update.openDownload()}
						disabled={update.opening}
						className="flex-1 items-center rounded-xl bg-primary py-3.5"
					>
						{update.opening ? (
							<ActivityIndicator />
						) : (
							<Text className="font-semibold text-primary-foreground">
								Download APK
							</Text>
						)}
					</Pressable>
				</View>
			</View>
		</FloatingBottomSheet>
	);
}

export function NativeBuildUpdateCard() {
	const update = useNativeBuildUpdate();
	if (!update.installed) return null;
	return (
		<View className="gap-3 rounded-2xl bg-card p-4">
			<Text className="text-base font-extrabold text-foreground">
				Android app build
			</Text>
			<Text className="text-sm text-muted-foreground">
				Installed build {update.installed.buildNumber}
				{update.build ? ` · Build ${update.build.buildNumber} available` : ""}
			</Text>
			<Text className="text-sm leading-5 text-muted-foreground">
				APK updates install through Android. Download expiry does not stop
				compatible updates to an installed app.
			</Text>
			{update.build?.notes ? (
				<Text className="text-sm text-foreground">{update.build.notes}</Text>
			) : null}
			{update.error ? (
				<Text accessibilityRole="alert" className="text-sm text-destructive">
					{update.error}
				</Text>
			) : null}
			<Pressable
				accessibilityRole="button"
				disabled={update.checking || update.opening}
				onPress={() => {
					void (update.build ? update.openDownload() : update.check()).catch(
						() => undefined,
					);
				}}
				className="items-center rounded-xl bg-secondary py-3.5"
			>
				{update.checking || update.opening ? (
					<ActivityIndicator />
				) : (
					<Text className="font-semibold text-foreground">
						{update.build ? "Download APK" : "Check for a newer build"}
					</Text>
				)}
			</Pressable>
		</View>
	);
}
