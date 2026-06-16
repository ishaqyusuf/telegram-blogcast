export type TranscriptionModel =
  | "gpt-4o-transcribe"
  | "gpt-4o-mini-transcribe"
  | "gemini-2.0-flash"
  | "whisper-local";

export type TranscriptionModelOption = {
  id: TranscriptionModel;
  label: string;
  description: string;
  costPerMin: number;
  requiresLocalTranscriber?: boolean;
};

export const TRANSCRIPTION_MODELS: TranscriptionModelOption[] = [
  {
    id: "gpt-4o-transcribe",
    label: "GPT-4o Transcribe",
    description: "Best hosted quality for manual transcript ranges.",
    costPerMin: 0.006,
  },
  {
    id: "gpt-4o-mini-transcribe",
    label: "GPT-4o Mini Transcribe",
    description: "Cheaper hosted option for background and bulk transcription.",
    costPerMin: 0.003,
  },
  {
    id: "gemini-2.0-flash",
    label: "Gemini 2.0 Flash",
    description: "Useful fallback for long-context audio understanding.",
    costPerMin: 0,
  },
  {
    id: "whisper-local",
    label: "Local Whisper",
    description: "Private LAN transcription through the local MLX Whisper service.",
    costPerMin: 0,
    requiresLocalTranscriber: true,
  },
];

export function getTranscriptionModelOption(model: TranscriptionModel) {
  return (
    TRANSCRIPTION_MODELS.find((option) => option.id === model) ??
    TRANSCRIPTION_MODELS[0]
  );
}

export function formatTranscriptionCost(durationSec: number, costPerMin: number) {
  const cost = (durationSec / 60) * costPerMin;
  if (cost === 0) return "Free";
  return `~$${cost.toFixed(4)}`;
}
