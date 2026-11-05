import { _trpc } from "@/components/static-trpc";
import { useMutation, useQueryClient } from "@/lib/react-query";
import {
	type NavigationAction,
	useNavigation,
	usePreventRemove,
} from "@react-navigation/native";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert } from "react-native";
export type Draft = {
	selectedIds: number[];
	targetAlbumId: number | null;
	name: string;
};

export function useReviewDraft(
	runId: number,
	suggestionId: number,
	initial: Draft,
	approving: boolean,
) {
	const navigation = useNavigation();
	const qc = useQueryClient();
	const saveMutation = useMutation(
		_trpc.album.saveOrganizerReview.mutationOptions(),
	);
	const saving = saveMutation.isPending || approving;
	const saveDraft = saveMutation.mutateAsync;
	const [saveError, setSaveError] = useState("");
	const [pendingAction, setPendingAction] = useState<NavigationAction | null>(
		null,
	);
	const [destination, setDestination] = useState<(() => void) | null>(null);
	const [draft, setDraft] = useState<Draft>(() => initial);
	const currentDraft = useRef(draft);
	const saveQueue = useRef<Promise<unknown>>(Promise.resolve());
	const [saved, setSaved] = useState("");
	const draftJson = JSON.stringify(draft);
	const dirty = saved !== draftJson;

	function change(next: Draft) {
		currentDraft.current = next;
		setDraft(next);
	}
	const persist = useCallback(() => {
		const snapshot = currentDraft.current;
		const serialized = JSON.stringify(snapshot);
		const request = saveQueue.current
			.catch(() => undefined)
			.then(() =>
				saveDraft({
					runId,
					suggestionId,
					draft: snapshot,
				}),
			);
		saveQueue.current = request;
		return request
			.then((review) => {
				qc.setQueryData(
					_trpc.album.getAutomaticIndexRun.queryKey({ id: runId }),
					(previous) => (previous ? { ...previous, review } : previous),
				);
				setSaved(serialized);
				setSaveError("");
			})
			.catch((error) => {
				setSaveError(error.message);
				throw error;
			});
	}, [qc, runId, suggestionId, saveDraft]);
	useEffect(() => {
		if (saved === draftJson) return;
		const timer = setTimeout(() => {
			void persist().catch(() => undefined);
		}, 500);
		return () => clearTimeout(timer);
	}, [draftJson, saved, persist]);
	usePreventRemove(dirty || saving, ({ data }) => {
		void persist()
			.then(() => setPendingAction(data.action))
			.catch(() =>
				Alert.alert(
					"Progress could not be saved",
					"Your edits are still here. Retry before leaving.",
				),
			);
	});
	useEffect(() => {
		if (dirty || saving) return;
		if (pendingAction) navigation.dispatch(pendingAction);
		if (destination) destination();
	}, [dirty, saving, pendingAction, destination, navigation]);
	function leave(action: () => void) {
		void persist()
			.then(() => setDestination(() => action))
			.catch(() => undefined);
	}

	return {
		draft,
		change,
		currentDraft,
		persist,
		leave,
		dirty,
		saving,
		saveError,
		setDestination,
	};
}
