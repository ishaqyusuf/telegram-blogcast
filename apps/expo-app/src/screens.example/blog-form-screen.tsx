import { SafeArea } from "@/components/safe-area";
import { Icon } from "@/components/ui/icon";
import React from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from "react-native";

// --- Sub-Components ---

const Header = () => (
  <View className="flex-row items-center justify-between px-4 py-3 bg-background/80 border-b border-border sticky top-0 z-50">
    <Pressable className="py-2 active:opacity-60">
      <Text className="text-sm font-medium text-muted-foreground">Cancel</Text>
    </Pressable>
    <Text className="text-base font-bold text-foreground tracking-tight">
      New Story
    </Text>
    <Pressable className="flex-row items-center gap-1.5 py-2 active:opacity-60">
      <Icon name="FolderOpen" className="size-sm text-accent" />
      <Text className="text-sm font-semibold text-accent">Drafts</Text>
    </Pressable>
  </View>
);

const MediaUpload = () => (
  <View className="flex-col gap-3">
    <Text className="text-xs font-bold uppercase tracking-widest text-muted-foreground px-1">
      Media
    </Text>
    <Pressable className="group border-2 border-dashed border-border rounded-2xl p-8 items-center justify-center gap-4 bg-card active:border-accent active:bg-accent/5">
      <View className="flex-row items-center gap-6">
        <View className="w-12 h-12 rounded-full bg-muted items-center justify-center">
          <Icon name="Image" className="size-lg text-muted-foreground" />
        </View>
        <View className="w-12 h-12 rounded-full bg-muted items-center justify-center">
          <Icon name="Mic" className="size-lg text-muted-foreground" />
        </View>
      </View>
      <View className="items-center">
        <Text className="text-sm font-semibold text-foreground">
          Add Image or Audio
        </Text>
        <Text className="text-xs text-muted-foreground mt-1">
          Maximum file size: 25MB
        </Text>
      </View>
    </Pressable>
  </View>
);

const DetailField = ({
  label,
  icon,
  value,
  placeholder,
  isDropdown = false,
}: {
  label: string;
  icon: string;
  value?: string;
  placeholder?: string;
  isDropdown?: boolean;
}) => (
  <View className="flex-col gap-2">
    <Text className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
      {label}
    </Text>
    <View className="flex-row items-center gap-3 p-3 bg-muted/50 rounded-xl border border-transparent active:border-accent/30">
      <View
        className={`w-8 h-8 rounded-full items-center justify-center overflow-hidden ${label === "Author" ? "bg-accent/20" : ""}`}
      >
        {/* {label === "Author" ? (
          <Icon name="User" className="size-md text-accent" />
        ) : (
          <Icon name={icon} className="size-md text-muted-foreground" />
        )} */}
      </View>

      {isDropdown ? (
        <View className="flex-1 flex-row items-center justify-between">
          <Text
            className={`text-sm font-medium ${value ? "text-foreground" : "text-muted-foreground"}`}
          >
            {value || placeholder}
          </Text>
          <Icon
            name="ChevronsUpDown"
            className="size-sm text-muted-foreground"
          />
        </View>
      ) : (
        <Text className="flex-1 text-sm font-medium text-foreground">
          {value}
        </Text>
      )}
    </View>
  </View>
);

const TagChip = ({ label }: { label: string }) => (
  <View className="flex-row items-center gap-1.5 bg-accent/10 px-3 py-1 rounded-full">
    <Text className="text-xs font-semibold text-accent-foreground">
      {label}
    </Text>
    <Pressable>
      <Icon name="X" className="size-sm text-accent-foreground opacity-70" />
    </Pressable>
  </View>
);

const PostDetails = () => (
  <View className="bg-card rounded-2xl p-6 border border-border flex-col gap-6 shadow-sm">
    <Text className="text-sm font-bold text-foreground">Post Details</Text>

    <DetailField label="Author" icon="User" value="Ahmed Al-Farsi" />
    <View className="flex-row gap-4">
      <View className="flex-1">
        <DetailField
          label="Channel"
          icon="ChevronsUpDown"
          placeholder="Choose a Channel"
          isDropdown
        />
      </View>
    </View>
    <DetailField
      label="Book Series (Audio only)"
      icon="Library"
      value="None"
      isDropdown
    />
    <DetailField
      label="Book Series (Audio only)"
      icon="Library"
      value="None"
      isDropdown
    />
    <View className="flex-col gap-2">
      <Text className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        Tags
      </Text>
      <View className="flex-row flex-wrap items-center gap-2 p-2 rounded-xl bg-muted/50 min-h-11">
        <TagChip label="#spirituality" />
        <TagChip label="#arabic_lit" />
        <TextInput
          className="flex-1 min-w-25 text-sm text-foreground p-1"
          placeholder="Add a tag..."
          placeholderClassName="text-muted-foreground"
        />
      </View>
    </View>
  </View>
);

const Footer = () => (
  <View className="absolute bottom-0 left-0 w-full bg-background/95 border-t border-border px-4 pt-4 pb-8 z-50">
    <View className="flex-row items-center gap-4">
      <Pressable className="flex-1 h-12 rounded-2xl border border-border items-center justify-center active:bg-muted">
        <Text className="text-sm font-bold text-muted-foreground">
          Save as Draft
        </Text>
      </Pressable>
      <Pressable className="flex-[1.5] h-12 rounded-2xl bg-foreground items-center justify-center flex-row gap-2 shadow-sm active:opacity-90">
        <Text className="text-sm font-bold text-background">Publish Story</Text>
        <Icon name="Send" className="size-sm text-background" />
      </Pressable>
    </View>
  </View>
);
export default function BlogFormScreen() {
  return (
    <View className="flex-1 bg-background">
      <SafeArea>
        <Header />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1"
        >
          <ScrollView
            className="flex-1 px-5 py-6"
            contentContainerClassName="pb-40 gap-10"
            showsVerticalScrollIndicator={false}
          >
            <View className="flex-col gap-4">
              <TextInput
                className="w-full text-4xl font-extrabold text-foreground tracking-tight"
                placeholder="Title"
                placeholderTextColor="rgba(128,128,128,0.5)"
                multiline
                value=""
              />

              <View className="relative flex-row">
                <View className="w-0.5 bg-border mr-4 rounded-full" />

                <TextInput
                  className="flex-1 text-xl leading-8 text-foreground min-h-37.5"
                  placeholderTextColor="rgba(128,128,128,0.5)"
                  placeholder="ابدأ الكتابة هنا..."
                  multiline
                  textAlignVertical="top"
                  value=""
                />
              </View>
            </View>
            <MediaUpload />
            <PostDetails />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeArea>
      <Footer />
    </View>
  );
}
