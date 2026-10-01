import { _trpc } from "@/components/static-trpc";
import { useMutation, useQueryClient } from "@/lib/react-query";
import { useAudioStore } from "@/store/audio-store";
import { useState } from "react";

function formatTimestamp(positionMs: number) {
	const seconds = Math.floor(positionMs / 1000);
	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	const parts = [minutes, seconds % 60];
	if (hours) parts.unshift(hours);
	return parts.map((part) => String(part).padStart(2, "0")).join(":");
}

export function useCommentDraft({
	blogId,
	timestampMode,
	onCommentAdded,
	onClose,
}: {
	blogId: number;
	timestampMode?: boolean;
	onCommentAdded?: () => void;
	onClose?: () => void;
}) {
	const qc = useQueryClient();
	const [text, setText] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [timestampEnabled, setTimestampEnabled] = useState(
		Boolean(timestampMode),
	);
	const [timestampMs, setTimestampMs] = useState<number | null>(null);
	// A different track may keep playing while this lesson is being viewed.
	const position = useAudioStore((s) =>
		s.blog?.id === blogId ? s.position : 0,
	);
	const { mutate, isPending } = useMutation(
		_trpc.blog.addComment.mutationOptions({
			onSuccess() {
				setText("");
				setError(null);
				setTimestampMs(null);
				setTimestampEnabled(Boolean(timestampMode));
				qc.invalidateQueries({ queryKey: _trpc.blog.getComments.queryKey() });
				qc.invalidateQueries({
					queryKey: _trpc.blog.getBlog.queryKey({ id: blogId }),
				});
				onCommentAdded?.();
				onClose?.();
			},
			onError() {
				setError(
					"Could not send comment. Check your connection and try again.",
				);
			},
		}),
	);

	function handleTimestampPress() {
		setTimestampMs(position);
		setTimestampEnabled((value) => !value || timestampMs !== position);
	}

	function captureTimestamp() {
		setTimestampMs(position);
		setTimestampEnabled(Boolean(timestampMode));
	}

	function toggleTimestamp() {
		setTimestampEnabled((enabled) => !enabled);
	}

	function handleSend() {
		const trimmed = text.trim();
		if (!trimmed || isPending) return;
		setError(null);
		mutate({
			blogId,
			content: trimmed,
			timestampSeconds: timestampEnabled
				? Math.floor((timestampMs ?? position) / 1000)
				: undefined,
		});
	}

	return {
		text,
		setText,
		error,
		isPending,
		timestampEnabled,
		timestampLabel: formatTimestamp(timestampMs ?? position),
		handleTimestampPress,
		toggleTimestamp,
		captureTimestamp,
		handleSend,
	};
}
