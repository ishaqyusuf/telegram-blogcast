import { DesignSwitch } from "@/components/design-switch";
import { LocalServicesGuard } from "@/components/local-services";
import TranscribeAudio from "@/screens.example/transcribe-audio";

export default function Modal() {
  return (
    <LocalServicesGuard>
      <DesignSwitch screens={[<TranscribeAudio key={0} />]} />
    </LocalServicesGuard>
  );
}
