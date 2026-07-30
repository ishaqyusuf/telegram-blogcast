import { FacebookSavedSyncStatusCard } from "@/components/facebook-saved-sync/sync-status-card";
import { SafeArea } from "@/components/safe-area";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { useFacebookSavedSync } from "@/hooks/use-facebook-saved-sync";
import { useGlobalAudioBarStore } from "@/store/global-audio-bar-store";
import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { Text, View } from "react-native";
import { WebView } from "react-native-webview";

const FACEBOOK_SAVED_URL = "https://www.facebook.com/saved/?cref=28";
const DESKTOP_USER_AGENT =
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
	"(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

export default function FacebookSavedSyncScreen() {
	const router = useRouter();
	const webViewRef = useRef<WebView>(null);
	const setGlobalAudioBarHidden = useGlobalAudioBarStore((state) => state.setHidden);
	const sync = useFacebookSavedSync(webViewRef);

	useEffect(() => {
		setGlobalAudioBarHidden(true);
		return () => setGlobalAudioBarHidden(false);
	}, [setGlobalAudioBarHidden]);

	return (
		<SafeArea style={{ flex: 1 }}>
			<View className="flex-1 bg-background">
				<View className="flex-row items-center gap-3 border-b border-border px-4 py-3">
					<Pressable
						onPress={() => router.back()}
						className="size-11 items-center justify-center rounded-full bg-card"
					>
						<Icon name="ChevronLeft" size={22} className="text-foreground" />
					</Pressable>
					<View className="flex-1">
						<Text className="text-lg font-extrabold text-foreground">
							Sync Facebook saves
						</Text>
						<Text className="text-xs text-muted-foreground">
							Only newly saved posts are added
						</Text>
					</View>
					<Pressable
						onPress={() => {
							sync.reset();
							webViewRef.current?.reload();
						}}
						className="size-11 items-center justify-center rounded-full bg-card"
					>
						<Icon name="RefreshCw" size={18} className="text-foreground" />
					</Pressable>
				</View>

				<View className="px-4 py-3">
					<FacebookSavedSyncStatusCard
						phase={sync.phase}
						knownCount={sync.knownCount}
						progress={sync.progress}
						result={sync.result}
						error={sync.error}
					/>
				</View>

				<View className="flex-1 overflow-hidden border-y border-border">
					<WebView
						ref={webViewRef}
						source={{ uri: FACEBOOK_SAVED_URL }}
						userAgent={DESKTOP_USER_AGENT}
						javaScriptEnabled
						domStorageEnabled
						sharedCookiesEnabled
						thirdPartyCookiesEnabled
						setSupportMultipleWindows={false}
						onMessage={sync.handleMessage}
						onLoadEnd={sync.probe}
						startInLoadingState
					/>
				</View>

				<View className="border-t border-border px-4 py-3">
					<Pressable
						onPress={sync.start}
						disabled={!sync.canStart}
						className={
							sync.canStart
								? "min-h-11 flex-row items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3"
								: "min-h-11 flex-row items-center justify-center gap-2 rounded-xl bg-muted px-4 py-3 opacity-70"
						}
					>
						<Icon
							name="RefreshCw"
							size={18}
							className={
								sync.canStart
									? "text-primary-foreground"
									: "text-muted-foreground"
							}
						/>
						<Text
							className={
								sync.canStart
									? "text-sm font-extrabold text-primary-foreground"
									: "text-sm font-extrabold text-muted-foreground"
							}
						>
							{sync.phase === "complete" ? "Sync again" : "Sync saved posts"}
						</Text>
					</Pressable>
				</View>
			</View>
		</SafeArea>
	);
}
