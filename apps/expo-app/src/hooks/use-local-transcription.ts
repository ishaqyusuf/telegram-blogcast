import { useCallback, useState } from "react";
import {
  transcribeAudio,
  type TranscribeRequest,
  type TranscribeResponse,
} from "@/lib/transcribe";

export function useLocalTranscription() {
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [result, setResult] = useState<TranscribeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const transcribe = useCallback(async (params: TranscribeRequest, baseUrl?: string | null) => {
    setIsTranscribing(true);
    setError(null);
    setResult(null);
    try {
      const res = await transcribeAudio(params, baseUrl ?? undefined);
      setResult(res);
      return res;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transcription failed");
      return null;
    } finally {
      setIsTranscribing(false);
    }
  }, []);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return { isTranscribing, result, error, transcribe, reset, setError } as const;
}
