import { Pressable } from "@/components/ui/pressable";
import { formatDate } from "@acme/utils/dayjs";
import { useState } from "react";
import { ActivityIndicator, ScrollView, Text, TextInput, View } from "react-native";
import { LegendList } from "@legendapp/list";

import { Icon } from "@/components/ui/icon";
import type { CommentsSheetState } from "./index";

// ── Timestamp badge helper ─────────────────────────────────────────────────

const TIMESTAMP_RE = /\[(\d{2}:\d{2})\]/;

function parseTimestamp(content: string): string | null {
  return content.match(TIMESTAMP_RE)?.[1] ?? null;
}

function stripTimestamp(content: string): string {
  return content.replace(TIMESTAMP_RE, "").trim();
}

// ── Single comment item ───────────────────────────────────────────────────────

function CommentItem({
  item,
  isReorderMode,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onEdit,
  onDelete,
  isEditPending,
  isDeletePending,
}: {
  item: any; // { id, order, comment: { id, content, createdAt, blogTags } }
  isReorderMode: boolean;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onEdit: (commentId: number, content: string) => void;
  onDelete: (commentId: number) => void;
  isEditPending: boolean;
  isDeletePending: boolean;
}) {
  const comment = item.comment;
  if (!comment) return null;

  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(comment.content ?? "");

  const timestamp = parseTimestamp(comment.content ?? "");
  const displayContent = timestamp
    ? stripTimestamp(comment.content ?? "")
    : (comment.content ?? "");

  const tags: string[] =
    comment.blogTags?.map((bt: any) => bt.tags?.title).filter(Boolean) ?? [];

  function handleSave() {
    if (!editText.trim()) return;
    onEdit(comment.id, editText.trim());
    setEditing(false);
  }

  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
      {/* Reorder controls */}
      {isReorderMode && (
        <View style={{ alignItems: "center", gap: 2, paddingTop: 6 }}>
          <Pressable
            onPress={onMoveUp}
            disabled={isFirst}
            style={{ padding: 4, opacity: isFirst ? 0.2 : 1 }}
          >
            <Icon name="ChevronUp" size={16} className="text-muted-foreground" />
          </Pressable>
          <Pressable
            onPress={onMoveDown}
            disabled={isLast}
            style={{ padding: 4, opacity: isLast ? 0.2 : 1 }}
          >
            <Icon name="ChevronDown" size={16} className="text-muted-foreground" />
          </Pressable>
        </View>
      )}

      {/* Avatar */}
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: "#282828",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          marginTop: 2,
        }}
      >
        <Text style={{ fontSize: 12, fontWeight: "700", color: "#9ca3af" }}>U</Text>
      </View>

      {/* Body */}
      <View style={{ flex: 1 }}>
        {/* Header row */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
            <Text style={{ fontSize: 13, fontWeight: "700", color: "#e8e8e8" }}>User</Text>
            <Text style={{ fontSize: 10, color: "#6b7280" }}>·</Text>
            <Text style={{ fontSize: 11, color: "#6b7280" }}>
              {comment.createdAt
                ? formatDate(comment.createdAt, "MMM D, h:mm A")
                : "—"}
            </Text>
          </View>

          {/* Action buttons */}
          <View style={{ flexDirection: "row", gap: 2 }}>
            <Pressable
              onPress={() => {
                setEditText(comment.content ?? "");
                setEditing((v) => !v);
              }}
              style={{ padding: 6 }}
            >
              <Icon name="FilePenLine" size={15} className="text-muted-foreground" />
            </Pressable>
            <Pressable
              onPress={() => onDelete(comment.id)}
              disabled={isDeletePending}
              style={{ padding: 6 }}
            >
              <Icon name="Trash2" size={15} className="text-destructive" />
            </Pressable>
          </View>
        </View>

        {/* Content / edit input */}
        {editing ? (
          <View style={{ gap: 6 }}>
            <TextInput
              value={editText}
              onChangeText={setEditText}
              multiline
              autoFocus
              style={{
                fontSize: 14,
                color: "#e8e8e8",
                backgroundColor: "#1e1e1e",
                borderRadius: 10,
                padding: 10,
                minHeight: 60,
                textAlign: "right",
                writingDirection: "rtl",
                borderWidth: 1,
                borderColor: "#1DB954",
                textAlignVertical: "top",
              }}
            />
            <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 8 }}>
              <Pressable
                onPress={() => setEditing(false)}
                style={{ paddingHorizontal: 12, paddingVertical: 6, backgroundColor: "#282828", borderRadius: 8 }}
              >
                <Text style={{ fontSize: 12, color: "#9ca3af" }}>إلغاء</Text>
              </Pressable>
              <Pressable
                onPress={handleSave}
                disabled={isEditPending || !editText.trim()}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 6,
                  backgroundColor: "#1DB954",
                  borderRadius: 8,
                  opacity: isEditPending || !editText.trim() ? 0.6 : 1,
                }}
              >
                {isEditPending ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <Text style={{ fontSize: 12, fontWeight: "700", color: "#000" }}>حفظ</Text>
                )}
              </Pressable>
            </View>
          </View>
        ) : (
          <>
            {/* Timestamp badge */}
            {timestamp && (
              <View style={{ marginBottom: 6 }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                    alignSelf: "flex-start",
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    backgroundColor: "rgba(29,185,84,0.12)",
                    borderRadius: 99,
                    borderWidth: 1,
                    borderColor: "rgba(29,185,84,0.2)",
                  }}
                >
                  <Icon name="Play" size={12} className="text-primary" />
                  <Text style={{ fontSize: 11, fontWeight: "700", color: "#1DB954" }}>
                    {timestamp}
                  </Text>
                </View>
              </View>
            )}

            <Text
              style={{
                fontSize: 14,
                color: "#e8e8e8",
                lineHeight: 22,
                textAlign: "right",
                writingDirection: "rtl",
              }}
            >
              {displayContent}
            </Text>

            {/* Tags */}
            {tags.length > 0 && (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                {tags.map((tag) => (
                  <View
                    key={tag}
                    style={{
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                      backgroundColor: "#1e1e1e",
                      borderRadius: 99,
                    }}
                  >
                    <Text style={{ fontSize: 11, color: "#1DB954" }}>#{tag}</Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </View>
    </View>
  );
}

// ── Main list ─────────────────────────────────────────────────────────────────

export function CommentsList({ state }: { state: CommentsSheetState }) {
  const {
    comments,
    availableTags,
    isLoading,
    search,
    setSearch,
    searchVisible,
    activeTagId,
    setActiveTagId,
    reorderMode,
    setReorderMode,
    reorderComments,
    isReorderPending,
    editComment,
    deleteComment,
    isEditPending,
    isDeletePending,
    arrangementMode,
  } = state;

  // Local order state for reorder mode
  const [localOrder, setLocalOrder] = useState<any[] | null>(null);
  const displayComments = localOrder ?? comments;

  // Reset local order when comments change (new data loaded)
  // This uses the comment count as a proxy — good enough for this use case

  function enterReorder() {
    setLocalOrder([...comments]);
    setReorderMode(true);
  }

  function cancelReorder() {
    setLocalOrder(null);
    setReorderMode(false);
  }

  function commitReorder() {
    reorderComments(
      displayComments.map((item, i) => ({
        commentId: item.comment?.id,
        order: i + 1,
      }))
    );
    setLocalOrder(null);
  }

  function moveItem(fromIdx: number, toIdx: number) {
    setLocalOrder((prev) => {
      const arr = [...(prev ?? comments)];
      const [item] = arr.splice(fromIdx, 1);
      arr.splice(toIdx, 0, item);
      return arr;
    });
  }

  return (
    <View style={{ flex: 1 }}>
      {/* Search bar */}
      {searchVisible && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            paddingHorizontal: 16,
            paddingVertical: 8,
            backgroundColor: "#1a1a1a",
            borderBottomWidth: 1,
            borderBottomColor: "#1e1e1e",
          }}
        >
          <Icon name="Search" size={16} className="text-muted-foreground" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="بحث في التعليقات..."
            placeholderTextColor="#4a4a4a"
            autoFocus
            style={{
              flex: 1,
              fontSize: 14,
              color: "#e8e8e8",
              textAlign: "right",
              writingDirection: "rtl",
            }}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch("")}>
              <Icon name="X" size={14} className="text-muted-foreground" />
            </Pressable>
          )}
        </View>
      )}

      {/* Tag filter chips */}
      {availableTags.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingVertical: 8,
            gap: 8,
            flexDirection: "row",
          }}
          style={{ flexShrink: 0, borderBottomWidth: 1, borderBottomColor: "#1e1e1e" }}
        >
          {availableTags.map((tag) => {
            const active = activeTagId === tag.id;
            return (
              <Pressable
                key={tag.id}
                onPress={() => setActiveTagId(active ? null : tag.id)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 5,
                  borderRadius: 99,
                  backgroundColor: active ? "#1DB954" : "#1e1e1e",
                  borderWidth: 1,
                  borderColor: active ? "#1DB954" : "#2a2a2a",
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: active ? "700" : "500",
                    color: active ? "#000" : "#9ca3af",
                  }}
                >
                  #{tag.title}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {/* Reorder save/cancel bar */}
      {reorderMode && (
        <View
          style={{
            flexDirection: "row",
            gap: 8,
            paddingHorizontal: 16,
            paddingVertical: 10,
            backgroundColor: "#1a2e1a",
            borderBottomWidth: 1,
            borderBottomColor: "#1DB954",
          }}
        >
          <Pressable
            onPress={cancelReorder}
            style={{ paddingHorizontal: 12, paddingVertical: 6, backgroundColor: "#282828", borderRadius: 8 }}
          >
            <Text style={{ fontSize: 12, color: "#9ca3af" }}>إلغاء</Text>
          </Pressable>
          <Pressable
            onPress={commitReorder}
            disabled={isReorderPending}
            style={{
              flex: 1,
              paddingVertical: 6,
              backgroundColor: "#1DB954",
              borderRadius: 8,
              alignItems: "center",
              opacity: isReorderPending ? 0.6 : 1,
            }}
          >
            {isReorderPending ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <Text style={{ fontSize: 12, fontWeight: "700", color: "#000" }}>حفظ الترتيب</Text>
            )}
          </Pressable>
        </View>
      )}

      {/* Comment list */}
      {isLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color="#1DB954" />
        </View>
      ) : displayComments.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 8 }}>
          <Icon name="MessageCircle" size={36} className="text-muted-foreground" />
          <Text style={{ color: "#6b7280", fontSize: 14 }}>
            {search || activeTagId ? "لا توجد نتائج" : "لا توجد تعليقات بعد"}
          </Text>
        </View>
      ) : (
        <LegendList
          data={displayComments}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item, index }) => (
            <CommentItem
              item={item}
              isReorderMode={reorderMode}
              isFirst={index === 0}
              isLast={index === displayComments.length - 1}
              onMoveUp={() => moveItem(index, index - 1)}
              onMoveDown={() => moveItem(index, index + 1)}
              onEdit={editComment}
              onDelete={deleteComment}
              isEditPending={isEditPending}
              isDeletePending={isDeletePending}
            />
          )}
          contentContainerStyle={{ padding: 20, paddingBottom: 80 }}
          ItemSeparatorComponent={() => <View style={{ height: 20 }} />}
          className="flex-1"
        />
      )}
    </View>
  );
}
