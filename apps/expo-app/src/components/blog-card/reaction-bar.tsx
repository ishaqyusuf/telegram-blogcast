import { useMutation, useQuery, useQueryClient } from "@/lib/react-query";
import { Pressable, Text, View } from "react-native";

import { _trpc } from "@/components/static-trpc";

const EMOJIS = ["❤️", "👍", "😂", "😮", "🔥"] as const;

export function ReactionBar({ blogId }: { blogId: number }) {
  const queryClient = useQueryClient();
  const { data: reactions = [] } = useQuery(
    _trpc.blog.getReactions.queryOptions({ blogId })
  );

  const addReaction = useMutation(
    _trpc.blog.addReaction.mutationOptions({
      onSettled: () => {
        queryClient.invalidateQueries(
          _trpc.blog.getReactions.queryOptions({ blogId })
        );
      },
    })
  );

  return (
    <View className="flex-row gap-1.5 mt-2">
      {EMOJIS.map((emoji) => {
        const entry = reactions.find((r: any) => r.emoji === emoji);
        const count = entry?.count ?? 0;
        const active = entry?.reacted ?? false;
        return (
          <Pressable
            key={emoji}
            onPress={() => addReaction.mutate({ blogId, emoji })}
            className="flex-row items-center gap-0.5 px-2 py-0.5 rounded-full active:opacity-70"
            style={{
              backgroundColor: active
                ? "rgba(29,185,84,0.18)"
                : "rgba(255,255,255,0.06)",
            }}
          >
            <Text style={{ fontSize: 13 }}>{emoji}</Text>
            {count > 0 && (
              <Text
                className={`text-[11px] font-semibold ${active ? "text-primary" : "text-muted-foreground"}`}
              >
                {count}
              </Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}
