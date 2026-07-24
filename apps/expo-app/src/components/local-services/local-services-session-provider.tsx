import { SafeArea } from "@/components/safe-area";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { useRouter } from "expo-router";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useMemo,
	useState,
} from "react";
import { View } from "react-native";

import { LocalServicesConnectionSheet } from "./local-services-connection-sheet";
import {
	type LocalServicesConnectionController,
	useLocalServicesConnection,
} from "./use-local-services-connection";

type LocalServicesSessionValue = LocalServicesConnectionController & {
	requestSetup: () => void;
};

const LocalServicesSessionContext =
	createContext<LocalServicesSessionValue | null>(null);

export function LocalServicesSessionProvider({
	children,
}: {
	children: ReactNode;
}) {
	const connection = useLocalServicesConnection();
	const [sheetVisible, setSheetVisible] = useState(false);
	const requestSetup = useCallback(() => setSheetVisible(true), []);
	const value = useMemo(
		() => ({ ...connection, requestSetup }),
		[connection, requestSetup],
	);

	return (
		<LocalServicesSessionContext.Provider value={value}>
			{children}
			<LocalServicesConnectionSheet
				visible={sheetVisible}
				activeIp={connection.savedIp ?? connection.activeIp}
				checkingIp={connection.checkingIp}
				connectionStatus={connection.connectionStatus}
				connectionError={connection.connectionError}
				discoveryProgress={connection.discoveryProgress}
				history={connection.history}
				onSelectIp={connection.enableWithIp}
				onFindConnection={connection.findConnection}
				onRetryConnection={connection.retryConnection}
				onClose={() => setSheetVisible(false)}
			/>
		</LocalServicesSessionContext.Provider>
	);
}

export function useLocalServicesSession() {
	const value = useContext(LocalServicesSessionContext);
	if (!value) {
		throw new Error(
			"useLocalServicesSession must be used inside LocalServicesSessionProvider",
		);
	}
	return value;
}

export function LocalServicesGuard({ children }: { children: ReactNode }) {
	const router = useRouter();
	const { isEnabled, requestSetup } = useLocalServicesSession();

	if (isEnabled) return children;

	return (
		<View className="flex-1 bg-background">
			<SafeArea>
				<View className="flex-row px-4 py-3">
					<Pressable
						haptic
						onPress={() => router.back()}
						accessibilityLabel="Go back"
						className="size-10 items-center justify-center rounded-full bg-card"
					>
						<Icon name="ChevronLeft" size={21} className="text-foreground" />
					</Pressable>
				</View>
				<View className="flex-1 items-center justify-center gap-4 px-8 pb-20">
					<View className="size-14 items-center justify-center rounded-full bg-muted">
						<Icon name="WifiOff" size={24} className="text-foreground" />
					</View>
					<View className="gap-2">
						<Text className="text-center text-xl font-extrabold text-foreground">
							Local services are off
						</Text>
						<Text className="text-center text-sm leading-5 text-muted-foreground">
							Enable a network IP to use Telegram updates, Facebook import, and
							local transcription.
						</Text>
					</View>
					<Pressable
						haptic
						onPress={requestSetup}
						accessibilityLabel="Enable local services"
						className="min-h-12 items-center justify-center rounded-xl bg-primary px-6 active:opacity-80"
					>
						<Text className="text-sm font-bold text-primary-foreground">
							Enable local services
						</Text>
					</Pressable>
				</View>
			</SafeArea>
		</View>
	);
}
