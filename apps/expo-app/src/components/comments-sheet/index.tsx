import { useMutation, useQuery, useQueryClient } from "@/lib/react-query";
import { useEffect, useState } from "react";
import {
  Alert,
  Keyboard,
  Modal,
  Platform,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { _trpc } from "@/components/static-trpc";
import { useCommentsSheet } from "@/hooks/use-comments-sheet";
import { CommentsHeader } from "./comments-header";
import { CommentsAudioContext } from "./comments-audio-context";
import { CommentsList } from "./comments-list";
import { CommentInput } from "./comment-input";

// ── Shared state type ─────────────────────────────────────────────────────────

export interface CommentsSheetState {
  blogId: number;
  comments: any[];
  availableTags: { id: number; title: string }[];
  arrangementMode: string;
  isLoading: boolean;
  search: string;
  setSearch: (v: string) => void;
  searchVisible: boolean;
  setSearchVisible: (v: boolean) => void;
  activeTagId: number | null;
  setActiveTagId: (id: number | null) => void;
  reorderMode: boolean;
  setReorderMode: (v: boolean) => void;
  editComment: (commentId: number, content: string) => void;
  deleteComment: (commentId: number) => void;
  reorderComments: (order: { commentId: number; order: number }[]) => void;
  setArrangementMode: (mode: "default" | "indexed") => void;
  isEditPending: boolean;
  isDeletePending: boolean;
  isReorderPending: boolean;
  refetch: () => void;
}

// ── State hook shared by both CommentsSheet and CommentContent ────────────────

export function useCommentsState(blogId: number): CommentsSheetState {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [activeTagId, setActiveTagId] = useState<number | null>(null);
  const [searchVisible, setSearchVisible] = useState(false);
  const [reorderMode, setReorderMode] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    ..._trpc.blog.getComments.queryOptions({
      blogId,
      search: search || undefined,
      tagId: activeTagId ?? undefined,
    }),
    enabled: blogId > 0,
  });

  const invalidate = () =>
    qc.invalidateQueries({
      queryKey: _trpc.blog.getComments.queryKey({ blogId }),
    });

  const { mutate: editCommentMut, isPending: isEditPending } = useMutation(
    _trpc.blog.editComment.mutationOptions({
      onSuccess: invalidate,
      onError: (e) => Alert.alert("خطأ", e.message),
    }),
  );
  const { mutate: deleteCommentMut, isPending: isDeletePending } = useMutation(
    _trpc.blog.deleteComment.mutationOptions({
      onSuccess: invalidate,
      onError: (e) => Alert.alert("خطأ", e.message),
    }),
  );
  const { mutate: reorderMut, isPending: isReorderPending } = useMutation(
    _trpc.blog.reorderComments.mutationOptions({
      onSuccess: () => {
        invalidate();
        setReorderMode(false);
      },
      onError: (e) => Alert.alert("خطأ", e.message),
    }),
  );
  const { mutate: setModeMut } = useMutation(
    _trpc.blog.setBlogArrangementMode.mutationOptions({
      onSuccess: invalidate,
    }),
  );

  return {
    blogId,
    comments: data?.comments ?? [],
    availableTags: data?.availableTags ?? [],
    arrangementMode: data?.arrangementMode ?? "default",
    isLoading,
    search,
    setSearch,
    searchVisible,
    setSearchVisible,
    activeTagId,
    setActiveTagId,
    reorderMode,
    setReorderMode,
    editComment: (commentId, content) => editCommentMut({ commentId, content }),
    deleteComment: (commentId) => deleteCommentMut({ blogId, commentId }),
    reorderComments: (order) => reorderMut({ blogId, order }),
    setArrangementMode: (mode) => setModeMut({ blogId, mode }),
    isEditPending,
    isDeletePending,
    isReorderPending,
    refetch,
  };
}

interface CommentsSheetProps {
  blogId?: number;
}

// ── CommentsSheet modal ───────────────────────────────────────────────────────

export function CommentsSheet({ blogId = 0 }: CommentsSheetProps) {
  const { isOpen, onClose } = useCommentsSheet();
  const state = useCommentsState(blogId);
  const [kbHeight, setKbHeight] = useState(0);

  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const show = Keyboard.addListener(showEvent, (e) =>
      setKbHeight(e.endCoordinates.height),
    );
    const hide = Keyboard.addListener(hideEvent, () => setKbHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={isOpen}
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end bg-black/60">
        <TouchableWithoutFeedback onPress={onClose}>
          <View className="absolute inset-0" />
        </TouchableWithoutFeedback>

        <View
          className="h-[85vh] bg-background rounded-t-4xl shadow-2xl border-t border-border"
          style={{ paddingBottom: kbHeight }}
        >
          <View className="w-full flex items-center pt-3 pb-1 shrink-0">
            <View className="h-1.5 w-12 rounded-full bg-muted" />
          </View>

          <CommentsHeader state={state} onClose={onClose} />
          <CommentsAudioContext />

          <View className="flex-1 relative overflow-hidden">
            <CommentsList state={state} />
            <LinearGradient
              colors={["transparent", "rgba(18,18,18,0.9)"]}
              className="absolute bottom-0 left-0 w-full h-8 pointer-events-none"
            />
          </View>

          <CommentInput
            blogId={blogId}
            onCommentAdded={state.refetch}
            noKeyboardAvoid
          />
        </View>
      </View>
    </Modal>
  );
}

// ── Inline embed variant ──────────────────────────────────────────────────────

export function CommentContent({ blogId = 0 }: CommentsSheetProps) {
  const state = useCommentsState(blogId);

  return (
    <View className="w-full">
      {/* <CommentsHeader state={state} onClose={() => {}} /> */}
      {/* <CommentsAudioContext /> */}
      <View className="relative">
        <CommentsList state={state} />
        {/* <LinearGradient
          colors={["transparent", "rgba(18,18,18,1)"]}
          className="absolute bottom-0 left-0 w-full h-20 pointer-events-none" */}
        {/* /> */}
      </View>
      {/* <CommentInput blogId={blogId} onCommentAdded={state.refetch} /> */}
    </View>
  );
}
