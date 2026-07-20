import { LocalServicesGuard } from "@/components/local-services";
import TranscribeQueueScreen from "@/screens/transcribe-queue-screen";

export default function Page() {
  return (
    <LocalServicesGuard>
      <TranscribeQueueScreen />
    </LocalServicesGuard>
  );
}
