import { LocalServicesGuard } from "@/components/local-services";
import FacebookImportScreen from "@/screens/facebook-import-screen";

export default function Page() {
  return (
    <LocalServicesGuard>
      <FacebookImportScreen />
    </LocalServicesGuard>
  );
}
