import { LocalServicesGuard } from "@/components/local-services";
import FacebookSavedSyncScreen from "@/screens/facebook-saved-sync-screen";

export default function Page() {
	return (
		<LocalServicesGuard>
			<FacebookSavedSyncScreen />
		</LocalServicesGuard>
	);
}
