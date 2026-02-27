import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import { SafeArea } from "@/components/safe-area";
import { _trpc } from "@/components/static-trpc";
import { Icon } from "@/components/ui/icon";
import { invalidateQueries } from "@/lib/trpc";

function normalizeTag(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.startsWith("#") ? trimmed.slice(1) : trimmed;
}

export default function BlogFormScreen() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);

  const normalizedTitle = title.trim();
  const normalizedContent = content.trim();

  const canSubmit = useMemo(() => {
    return normalizedTitle.length > 0 || normalizedContent.length > 0;
  }, [normalizedTitle, normalizedContent]);

  const createBlogMutation = useMutation(
    _trpc.blog.createBlog.mutationOptions({
      onSuccess: () => {
        invalidateQueries("infinite", ["blog.posts"]);
      },
    }),
  );

  const addTag = () => {
    const value = normalizeTag(tagInput);
    if (!value) return;

    setTags((prev) => {
      if (prev.includes(value) || prev.length >= 10) return prev;
      return [...prev, value];
    });
    setTagInput("");
  };

  const removeTag = (value: string) => {
    setTags((prev) => prev.filter((tag) => tag !== value));
  };

  const submit = async (published: boolean) => {
    if (!canSubmit || createBlogMutation.isPending) {
      if (!canSubmit) {
        Alert.alert("Missing content", "Please add a title or story content.");
      }
      return;
    }

    try {
      await createBlogMutation.mutateAsync({
        title: normalizedTitle,
        content: normalizedContent,
        tags,
        type: "text",
        published,
      });

      Alert.alert(
        published ? "Published" : "Saved as draft",
        published
          ? "Your story is now in the feed."
          : "Your draft was saved successfully.",
      );
      router.replace("/home");
    } catch {
      Alert.alert(
        "Could not save",
        "Something went wrong while saving this story. Please try again.",
      );
    }
  };

  return (
    <View className="flex-1 bg-background">
      <SafeArea>
        <View className="border-b border-border px-4 py-3">
          <View className="flex-row items-center justify-between">
            <Pressable onPress={() => router.back()} className="py-2">
              <Text className="text-sm font-medium text-muted-foreground">
                Cancel
              </Text>
            </Pressable>
            <Text className="text-base font-bold text-foreground">New Story</Text>
            <View className="w-14" />
          </View>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1"
        >
          <ScrollView
            className="flex-1 px-5 py-5"
            contentContainerClassName="gap-6 pb-36"
            keyboardShouldPersistTaps="handled"
          >
            <View className="rounded-2xl border border-border bg-card p-4">
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="Title"
                placeholderTextColor="rgba(128,128,128,0.65)"
                className="mb-3 text-2xl font-bold text-foreground"
                maxLength={180}
              />
              <View className="h-px bg-border" />
              <TextInput
                value={content}
                onChangeText={setContent}
                placeholder="Write your story..."
                placeholderTextColor="rgba(128,128,128,0.65)"
                className="mt-3 min-h-52 text-base leading-7 text-foreground"
                multiline
                textAlignVertical="top"
              />
            </View>

            <View className="rounded-2xl border border-border bg-card p-4">
              <Text className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Tags
              </Text>
              <View className="mb-3 flex-row items-center gap-2">
                <TextInput
                  value={tagInput}
                  onChangeText={setTagInput}
                  onSubmitEditing={addTag}
                  placeholder="#topic"
                  placeholderTextColor="rgba(128,128,128,0.65)"
                  className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
                  returnKeyType="done"
                />
                <Pressable
                  onPress={addTag}
                  className="h-10 w-10 items-center justify-center rounded-xl border border-border bg-background"
                >
                  <Icon name="Plus" className="text-foreground" />
                </Pressable>
              </View>

              <View className="flex-row flex-wrap gap-2">
                {tags.length === 0 ? (
                  <Text className="text-sm text-muted-foreground">
                    No tags yet.
                  </Text>
                ) : (
                  tags.map((tag) => (
                    <View
                      key={tag}
                      className="flex-row items-center gap-1 rounded-full bg-accent/15 px-3 py-1.5"
                    >
                      <Text className="text-xs font-semibold text-accent">
                        #{tag}
                      </Text>
                      <Pressable onPress={() => removeTag(tag)}>
                        <Icon name="X" className="size-sm text-accent" />
                      </Pressable>
                    </View>
                  ))
                )}
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeArea>

      <View className="absolute bottom-0 left-0 w-full border-t border-border bg-background px-4 pb-8 pt-4">
        <View className="flex-row items-center gap-3">
          <Pressable
            disabled={createBlogMutation.isPending}
            onPress={() => submit(false)}
            className="h-12 flex-1 items-center justify-center rounded-2xl border border-border"
          >
            <Text className="text-sm font-bold text-muted-foreground">
              Save Draft
            </Text>
          </Pressable>

          <Pressable
            disabled={createBlogMutation.isPending}
            onPress={() => submit(true)}
            className="h-12 flex-[1.4] flex-row items-center justify-center gap-2 rounded-2xl bg-foreground"
          >
            <Text className="text-sm font-bold text-background">
              {createBlogMutation.isPending ? "Saving..." : "Publish"}
            </Text>
            {!createBlogMutation.isPending ? (
              <Icon name="Send" className="size-sm text-background" />
            ) : null}
          </Pressable>
        </View>
      </View>
    </View>
  );
}
