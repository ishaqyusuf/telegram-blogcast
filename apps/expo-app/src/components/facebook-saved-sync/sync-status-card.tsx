import { Icon } from "@/components/ui/icon";
import type {
	FacebookSavedSyncPhase,
} from "@/hooks/use-facebook-saved-sync";
import type { FacebookSavedCollectorProgress } from "@acme/blog/facebook-saved";
import type { RouterOutputs } from "@api/trpc/routers/_app";
import { ActivityIndicator, Text, View } from "react-native";

type SyncResult = RouterOutputs["facebookImport"]["syncSavedPosts"];

export function FacebookSavedSyncStatusCard({
	phase,
	knownCount,
	progress,
	result,
	error,
}: {
	phase: FacebookSavedSyncPhase;
	knownCount: number;
	progress: FacebookSavedCollectorProgress | null;
	result: SyncResult | null;
	error: string | null;
}) {
	const busy = phase === "syncing" || phase === "submitting";
	const title =
		phase === "sign_in"
			? "Sign in to Facebook"
			: phase === "complete"
				? "Saved posts updated"
				: phase === "error"
					? "Sync needs attention"
					: busy
						? phase === "submitting"
							? "Adding new posts"
							: "Checking recent saves"
						: "Ready to sync";
	const detail =
		phase === "sign_in"
			? "Complete Facebook sign-in below, return to Saved, then start again."
			: result
				? `${result.imported} added · ${result.existing} existing · ${result.scanned} scanned`
				: error
					? error
					: progress
						? `${progress.newCount} new · ${progress.knownCount} known · pass ${progress.pass}`
						: `${knownCount.toLocaleString()} saved posts already known`;

	return (
		<View className="gap-2 rounded-2xl border border-border bg-card p-4">
			<View className="flex-row items-center gap-3">
				<View className="size-11 items-center justify-center rounded-full bg-secondary">
					{busy ? (
						<ActivityIndicator size="small" />
					) : (
						<Icon
							name={
								phase === "complete"
									? "CheckCircle2"
									: phase === "error" || phase === "sign_in"
										? "AlertCircle"
										: "RefreshCw"
							}
							size={20}
							className={
								phase === "error"
									? "text-destructive"
									: phase === "complete"
										? "text-primary"
										: "text-foreground"
							}
						/>
					)}
				</View>
				<View className="flex-1 gap-1">
					<Text className="text-base font-extrabold text-foreground">
						{title}
					</Text>
					<Text className="text-xs leading-5 text-muted-foreground">
						{detail}
					</Text>
				</View>
			</View>
		</View>
	);
}
