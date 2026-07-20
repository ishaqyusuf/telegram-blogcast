import { LocalServicesGuard } from "@/components/local-services";
import ChannelUpdatesScreen from "@/screens/channel-updates-screen";

export default function Page() {
  return (
    <LocalServicesGuard>
      <ChannelUpdatesScreen />
    </LocalServicesGuard>
  );
}
