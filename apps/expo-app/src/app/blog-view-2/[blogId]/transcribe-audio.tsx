import { DesignSwitch } from "@/components/design-switch";
import TranscribeAudio from "@/screens.example/transcribe-audio";
import { useLocalSearchParams } from "expo-router";

export default function Modal() {
  const { blogId } = useLocalSearchParams();

  return <DesignSwitch screens={[<TranscribeAudio key={0} />]} />;
}
