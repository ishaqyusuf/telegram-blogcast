import { useEffect, useRef, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
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
import { Audio, AVPlaybackStatus } from "expo-av";

import {
  type BlogFormParams,
  useCreateBlogFormContext,
} from "@/context/blog-form-context";
import { SafeArea } from "@/components/safe-area";
import { Icon } from "@/components/ui/icon";
import { getTelegramFileUrl } from "@/lib/get-telegram-file";
import { useAudioStore } from "@/store/audio-store";

function formatSeconds(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const s = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

export default function BlogFormScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<BlogFormParams>();
  const audioStore = useAudioStore();

  const {
    form,
    formData,
    isAudioComment,
    isCommentMode,
    targetBlogId,
    canSubmit,
    isSubmitting,
    addTag,
    removeTag,
    toggleAttachment,
    setTimestampSec,
    updateTimestamp,
    submit,
  } = useCreateBlogFormContext({
    params: params as BlogFormParams,
  });

  const includeTimestamp = formData?.includeTimestamp ?? true;
  const timestampSec = Number(formData?.timestampSec || 0);
  const selectedAttachments = formData?.selectedAttachments || [];

  const initialTimestampFromParams = Number(params.timestamp);
  const hasTimestampParam =
    Number.isFinite(initialTimestampFromParams) &&
    initialTimestampFromParams >= 0;

  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const previewSoundRef = useRef<Audio.Sound | null>(null);
  const mainWasPlayingRef = useRef(false);
  const contentInputRef = useRef<TextInput | null>(null);

  const currentAudioSec = Math.max(
    0,
    Math.floor((audioStore.position || 0) / 1000),
  );

  useEffect(() => {
    if (isAudioComment && !hasTimestampParam) {
      setTimestampSec(currentAudioSec);
    }
  }, [currentAudioSec, hasTimestampParam, isAudioComment, setTimestampSec]);

  useEffect(() => {
    return () => {
      const previewSound = previewSoundRef.current;
      if (previewSound) {
        previewSound.unloadAsync().catch(() => undefined);
        previewSoundRef.current = null;
      }
      if (mainWasPlayingRef.current) {
        audioStore.play().catch(() => undefined);
        mainWasPlayingRef.current = false;
      }
    };
  }, [audioStore]);

  const resumeMainPlayerIfNeeded = async () => {
    if (mainWasPlayingRef.current) {
      await audioStore.play();
    }
    mainWasPlayingRef.current = false;
  };

  const stopPreview = async () => {
    const previewSound = previewSoundRef.current;
    if (!previewSound) return;

    try {
      await previewSound.stopAsync();
      await previewSound.unloadAsync();
    } catch {
      // ignore cleanup failures
    }

    previewSoundRef.current = null;
    setIsPreviewPlaying(false);
    await resumeMainPlayerIfNeeded();
  };

  const startPreview = async () => {
    if (!isAudioComment || !includeTimestamp) return;

    if (isPreviewPlaying) {
      await stopPreview();
      return;
    }

    const previewStartMillis = timestampSec * 1000;
    const mainSoundAvailable =
      !!audioStore.sound &&
      (audioStore.blog?.id === targetBlogId || !targetBlogId);

    let previewUri = audioStore.localPath || audioStore.uri;

    if (
      !previewUri &&
      mainSoundAvailable &&
      audioStore.blog?.audio?.telegramFileId
    ) {
      const source = await getTelegramFileUrl(
        audioStore.blog.audio.telegramFileId,
      );
      previewUri = source?.url || null;
    }

    if (!previewUri) {
      Alert.alert(
        "Audio unavailable",
        "Play the main audio first to enable timestamp preview.",
      );
      return;
    }

    try {
      mainWasPlayingRef.current = !!audioStore.isPlaying;
      if (audioStore.isPlaying) {
        await audioStore.pause();
      }

      const previewSound = previewSoundRef.current;
      if (previewSound) {
        await previewSound.unloadAsync();
        previewSoundRef.current = null;
      }

      const { sound } = await Audio.Sound.createAsync(
        { uri: previewUri },
        {
          shouldPlay: true,
          positionMillis: previewStartMillis,
          volume: audioStore.volume ?? 1,
        },
        async (status: AVPlaybackStatus) => {
          if (!status.isLoaded) return;
          if (status.didJustFinish) {
            await stopPreview();
          }
        },
      );

      previewSoundRef.current = sound;
      setIsPreviewPlaying(true);
    } catch {
      Alert.alert("Preview failed", "Could not play the selected timestamp.");
      setIsPreviewPlaying(false);
      await resumeMainPlayerIfNeeded();
    }
  };

  useEffect(() => {
    if (!includeTimestamp && isPreviewPlaying) {
      stopPreview().catch(() => undefined);
    }
  }, [includeTimestamp, isPreviewPlaying]);

  const attachmentOptions = [
    { key: "image", label: "Image", icon: "Image" },
    { key: "audio", label: "Audio", icon: "Mic" },
    { key: "file", label: "File", icon: "FileText" },
    { key: "voice-note", label: "Voice Note", icon: "AudioWaveform" },
    { key: "link", label: "Link", icon: "Share" },
  ] as const;

  const onSubmit = async (published: boolean) => {
    if (!canSubmit || isSubmitting) {
      if (!canSubmit) {
        Alert.alert(
          "Missing content",
          isCommentMode
            ? "Please write your comment first."
            : "Please add a title or story content.",
        );
      }
      return;
    }

    try {
      await submit(published);

      if (isCommentMode) {
        Alert.alert("Comment added", "Your comment has been posted.");
      } else {
        Alert.alert(
          published ? "Published" : "Saved as draft",
          published
            ? "Your story is now in the feed."
            : "Your draft was saved successfully.",
        );
      }

      router.back();
    } catch {
      Alert.alert(
        "Could not save",
        "Something went wrong while saving. Please try again.",
      );
    }
  };

  return (
    <View className="flex-1 bg-background">
      <SafeArea>
        <View className="flex-row items-center justify-between border-b border-border bg-background/80 px-4 py-3">
          <Pressable onPress={() => router.back()} className="py-2">
            <Text className="text-sm font-medium text-muted-foreground">
              Cancel
            </Text>
          </Pressable>
          <Text className="text-base font-bold tracking-tight text-foreground">
            {isCommentMode ? "Add Comment" : "New Story"}
          </Text>
          {isCommentMode ? (
            <View className="w-14" />
          ) : (
            <Pressable className="flex-row items-center gap-1.5 py-2">
              <Icon name="FolderOpen" className="size-sm text-accent" />
              <Text className="text-sm font-semibold text-accent">Drafts</Text>
            </Pressable>
          )}
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1"
        >
          <ScrollView
            className="flex-1 px-5 py-6"
            contentContainerClassName={
              isCommentMode ? "gap-6 pb-36" : "gap-10 pb-40"
            }
            keyboardShouldPersistTaps="handled"
          >
            {isAudioComment ? (
              <View className="flex-col gap-3 rounded-2xl border border-border bg-card p-6">
                <View className="flex-row items-center justify-between">
                  <Text className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    Audio Timestamp
                  </Text>
                  <Pressable
                    onPress={() =>
                      form.setValue("includeTimestamp", !includeTimestamp)
                    }
                  >
                    <Text className="text-xs font-semibold text-accent">
                      {includeTimestamp ? "Timestamp On" : "Timestamp Off"}
                    </Text>
                  </Pressable>
                </View>

                <View className="rounded-xl border border-border bg-background px-3 py-3">
                  <Text className="text-lg font-bold text-foreground">
                    {formatSeconds(timestampSec)}
                  </Text>
                  <Text className="text-xs text-muted-foreground">
                    Selected timestamp
                  </Text>
                  <Text className="mt-1 text-xs text-muted-foreground">
                    Current: {formatSeconds(currentAudioSec)}
                  </Text>
                </View>

                {includeTimestamp ? (
                  <View className="flex-row items-center gap-2">
                    <Pressable
                      onPress={() => updateTimestamp(-5)}
                      className="h-10 flex-1 flex-row items-center justify-center gap-1 rounded-xl border border-border"
                    >
                      <Icon name="RotateCcw" className="text-foreground" />
                      <Text className="text-xs font-semibold text-foreground">
                        5s
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={startPreview}
                      className="h-10 flex-[1.2] flex-row items-center justify-center gap-1 rounded-xl bg-foreground"
                    >
                      <Icon
                        name={isPreviewPlaying ? "X" : "Play"}
                        className="text-background"
                      />
                      <Text className="text-xs font-semibold text-background">
                        {isPreviewPlaying ? "Stop" : "Play Time"}
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={() => updateTimestamp(5)}
                      className="h-10 flex-1 flex-row items-center justify-center gap-1 rounded-xl border border-border"
                    >
                      <Icon name="RotateCw" className="text-foreground" />
                      <Text className="text-xs font-semibold text-foreground">
                        5s
                      </Text>
                    </Pressable>
                  </View>
                ) : null}

                {includeTimestamp ? (
                  <Pressable
                    onPress={() => setTimestampSec(currentAudioSec)}
                    className="h-10 flex-row items-center justify-center gap-2 rounded-xl border border-border bg-background"
                  >
                    <Icon name="Clock" className="text-foreground" />
                    <Text className="text-xs font-semibold text-foreground">
                      Use Current Time
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            {!isCommentMode ? (
              <View className="flex-col gap-4">
                <TextInput
                  value={formData?.title || ""}
                  onChangeText={(value) => form.setValue("title", value)}
                  placeholder="Title"
                  placeholderTextColor="rgba(128,128,128,0.5)"
                  className="w-full text-4xl font-extrabold tracking-tight text-foreground"
                  multiline
                  maxLength={180}
                />
                <View className="relative flex-row">
                  <View className="mr-4 w-0.5 rounded-full bg-border" />
                  <TextInput
                    ref={contentInputRef}
                    value={formData?.content || ""}
                    onChangeText={(value) => form.setValue("content", value)}
                    placeholder="Write your story..."
                    placeholderTextColor="rgba(128,128,128,0.5)"
                    className="min-h-37.5 flex-1 text-xl leading-8 text-foreground"
                    multiline
                    textAlignVertical="top"
                  />
                </View>
              </View>
            ) : (
              <View className="rounded-2xl border border-border bg-card p-6">
                <Text className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Comment
                </Text>
                <TextInput
                  ref={contentInputRef}
                  value={formData?.content || ""}
                  onChangeText={(value) => form.setValue("content", value)}
                  placeholder="Write your comment..."
                  placeholderTextColor="rgba(128,128,128,0.65)"
                  className="min-h-52 text-base leading-7 text-foreground"
                  multiline
                  textAlignVertical="top"
                />
              </View>
            )}

            <View className="flex-col gap-3">
              <Text className="px-1 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                {isCommentMode ? "Attachments & Input" : "Media"}
              </Text>
              <View className="rounded-2xl border-2 border-dashed border-border bg-card p-5">
                <View className="flex-row flex-wrap gap-2">
                  {attachmentOptions.map(({ key, label, icon }) => (
                    <Pressable
                      key={key}
                      onPress={() => toggleAttachment(key)}
                      className={`h-10 flex-row items-center gap-2 rounded-xl border px-3 ${
                        selectedAttachments.includes(key)
                          ? "border-accent bg-accent/10"
                          : "border-border bg-background"
                      }`}
                    >
                      <Icon
                        name={icon}
                        className={
                          selectedAttachments.includes(key)
                            ? "text-accent"
                            : "text-foreground"
                        }
                      />
                      <Text className="text-xs font-semibold text-foreground">
                        {label}
                      </Text>
                    </Pressable>
                  ))}

                  <Pressable
                    onPress={() => contentInputRef.current?.focus()}
                    className="h-10 flex-row items-center gap-2 rounded-xl border border-border bg-background px-3"
                  >
                    <Icon name="PenLine" className="text-foreground" />
                    <Text className="text-xs font-semibold text-foreground">
                      Text Area
                    </Text>
                  </Pressable>
                </View>

                {!!selectedAttachments.length ? (
                  <Text className="mt-3 text-xs text-muted-foreground">
                    Selected: {selectedAttachments.join(", ")}
                  </Text>
                ) : (
                  <Text className="mt-3 text-xs text-muted-foreground">
                    {isCommentMode
                      ? "Add optional media or jump straight to text."
                      : "Maximum file size: 25MB"}
                  </Text>
                )}
              </View>
            </View>

            {!isCommentMode ? (
              <View className="flex-col gap-6 rounded-2xl border border-border bg-card p-6">
                <Text className="text-sm font-bold text-foreground">
                  Post Details
                </Text>

                <View className="flex-col gap-2">
                  <Text className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Author
                  </Text>
                  <View className="flex-row items-center gap-3 rounded-xl bg-muted/50 p-3">
                    <View className="h-8 w-8 items-center justify-center rounded-full bg-accent/20">
                      <Icon name="User" className="size-md text-accent" />
                    </View>
                    <Text className="flex-1 text-sm font-medium text-foreground">
                      Ahmed Al-Farsi
                    </Text>
                  </View>
                </View>

                <View className="flex-col gap-2">
                  <Text className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Tags
                  </Text>
                  <View className="min-h-11 flex-row flex-wrap items-center gap-2 rounded-xl bg-muted/50 p-2">
                    {(formData?.tags || []).map((tag) => (
                      <View
                        key={tag}
                        className="flex-row items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1"
                      >
                        <Text className="text-xs font-semibold text-accent-foreground">
                          #{tag}
                        </Text>
                        <Pressable onPress={() => removeTag(tag)}>
                          <Icon
                            name="X"
                            className="size-sm text-accent-foreground opacity-70"
                          />
                        </Pressable>
                      </View>
                    ))}
                    <TextInput
                      value={formData?.tagInput || ""}
                      onChangeText={(value) => form.setValue("tagInput", value)}
                      onSubmitEditing={addTag}
                      placeholder="Add a tag..."
                      placeholderTextColor="rgba(128,128,128,0.65)"
                      className="min-w-25 flex-1 p-1 text-sm text-foreground"
                      returnKeyType="done"
                    />
                    <Pressable
                      onPress={addTag}
                      className="h-8 w-8 items-center justify-center rounded-lg bg-background"
                    >
                      <Icon name="Plus" className="size-sm text-foreground" />
                    </Pressable>
                  </View>
                </View>
              </View>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeArea>

      <View className="absolute bottom-0 left-0 w-full border-t border-border bg-background/95 px-4 pb-8 pt-4">
        {isCommentMode ? (
          <Pressable
            disabled={isSubmitting}
            onPress={() => onSubmit(true)}
            className="h-12 flex-row items-center justify-center gap-2 rounded-2xl bg-foreground shadow-sm"
          >
            <Text className="text-sm font-bold text-background">
              {isSubmitting ? "Saving..." : "Post Comment"}
            </Text>
            {!isSubmitting ? (
              <Icon name="Send" className="size-sm text-background" />
            ) : null}
          </Pressable>
        ) : (
          <View className="flex-row items-center gap-3">
            <Pressable
              disabled={isSubmitting}
              onPress={() => onSubmit(false)}
              className="h-12 flex-1 items-center justify-center rounded-2xl border border-border"
            >
              <Text className="text-sm font-bold text-muted-foreground">
                Save Draft
              </Text>
            </Pressable>

            <Pressable
              disabled={isSubmitting}
              onPress={() => onSubmit(true)}
              className="h-12 flex-[1.4] flex-row items-center justify-center gap-2 rounded-2xl bg-foreground shadow-sm"
            >
              <Text className="text-sm font-bold text-background">
                {isSubmitting ? "Saving..." : "Publish"}
              </Text>
              {!isSubmitting ? (
                <Icon name="Send" className="size-sm text-background" />
              ) : null}
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}
