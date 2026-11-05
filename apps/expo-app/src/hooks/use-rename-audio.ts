import { useMutation, useQueryClient } from "@tanstack/react-query";
import { _trpc } from "@/components/static-trpc";
import { reconcileAudioTitle } from "@/lib/audio-title-cache";
import { updateAudioDetailPreviewTitle } from "@/lib/audio-detail-preview";
import { useAudioStore } from "@/store/audio-store";

export function useRenameAudio() {
	const client = useQueryClient();
	return useMutation(
		_trpc.blog.updateMediaTitleOverride.mutationOptions({
			onSuccess: async (media) => {
				updateAudioDetailPreviewTitle(media.id, media.titleOverride);
				const blog = useAudioStore.getState().blog;
				if (blog?.audio?.mediaId === media.id) {
					useAudioStore.setState({
						blog: {
							...blog,
							audio: { ...blog.audio, titleOverride: media.titleOverride },
						},
					});
				}
				await reconcileAudioTitle(client, media.id, media.titleOverride);
			},
		}),
	);
}
