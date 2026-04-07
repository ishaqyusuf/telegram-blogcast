import { _trpc } from "@/components/static-trpc";
import { useZodForm } from "@/components/use-zod-form";
import { invalidateQueries } from "@/lib/trpc";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useMemo } from "react";
import { useWatch } from "react-hook-form";
import { z } from "zod";

const attachmentTypeSchema = z.enum([
  "image",
  "audio",
  "file",
  "voice-note",
  "link",
]);

const blogFormSchema = z
  .object({
    title: z.string(),
    content: z.string(),
    tagInput: z.string(),
    tags: z.array(z.string()),
    includeTimestamp: z.boolean(),
    timestampSec: z.number().int().nonnegative(),
    selectedAttachments: z.array(attachmentTypeSchema),
  })
  .passthrough();

type BlogFormValues = z.infer<typeof blogFormSchema>;

export type BlogFormParams = {
  type?: string;
  audioBlogId?: string;
  mode?: string;
  blogId?: string;
  timestamp?: string;
};

export interface BlogFormContextProps {
  params?: BlogFormParams;
  onSaved?: () => void;
}

function normalizeTag(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.startsWith("#") ? trimmed.slice(1) : trimmed;
}

type BlogFormContextType = ReturnType<typeof useCreateBlogFormContext>;

export const BlogFormContext = createContext<BlogFormContextType>(
  undefined as never,
);
export const BlogFormProvider = BlogFormContext.Provider;

export const useCreateBlogFormContext = (props: BlogFormContextProps = {}) => {
  const trpc = _trpc;
  const params = props.params || {};

  const targetBlogId = Number(params.audioBlogId ?? params.blogId);
  const isValidBlogId = Number.isFinite(targetBlogId) && targetBlogId > 0;
  const isAudioComment = params.type === "audio-comment" && isValidBlogId;
  const isCommentMode = isAudioComment || params.mode === "comment";
  const isEditMode = !isCommentMode && isValidBlogId;

  const initialTimestampFromParams = Number(params.timestamp);
  const hasTimestampParam =
    Number.isFinite(initialTimestampFromParams) &&
    initialTimestampFromParams >= 0;

  // Fetch existing blog data when editing
  const { data: existingBlog } = useQuery({
    ...(trpc.blog.getBlog.queryOptions({ id: targetBlogId })),
    enabled: isEditMode,
  });

  const form = useZodForm(blogFormSchema, {
    defaultValues: {
      title: "",
      content: "",
      tagInput: "",
      tags: [],
      includeTimestamp: true,
      timestampSec: hasTimestampParam
        ? Math.floor(initialTimestampFromParams)
        : 0,
      selectedAttachments: [],
    },
  });
  const { setValue } = form;

  // Populate form when existing blog data loads (edit mode)
  useEffect(() => {
    if (isEditMode && existingBlog) {
      if (existingBlog.content) {
        setValue("content", existingBlog.content);
      }
      if (existingBlog.caption) {
        setValue("title", existingBlog.caption);
      }
      const tags = existingBlog.blogTags
        ?.map((bt: any) => bt.tags?.title)
        .filter(Boolean) ?? [];
      if (tags.length > 0) {
        setValue("tags", tags);
      }
    }
  }, [isEditMode, existingBlog, setValue]);

  const formData = useWatch({
    control: form.control,
  });

  const normalizedTitle = (formData?.title || "").trim();
  const normalizedContent = (formData?.content || "").trim();

  const canSubmit = useMemo(() => {
    if (isCommentMode) return normalizedContent.length > 0 && isValidBlogId;
    return normalizedTitle.length > 0 || normalizedContent.length > 0;
  }, [isCommentMode, isValidBlogId, normalizedContent, normalizedTitle]);

  const createBlogMutation = useMutation(
    trpc.blog.createBlog.mutationOptions({
      onSuccess: () => {
        invalidateQueries("infinite", ["blog.posts"]);
      },
    }),
  );

  const updateBlogMutation = useMutation(
    trpc.blog.updateBlog.mutationOptions({
      onSuccess: () => {
        invalidateQueries("infinite", ["blog.posts"]);
      },
    }),
  );

  const addCommentMutation = useMutation(
    trpc.blog.addComment.mutationOptions({
      onSuccess: () => {
        invalidateQueries("infinite", ["blog.posts"]);
      },
    }),
  );

  const isSubmitting =
    createBlogMutation.isPending || addCommentMutation.isPending || updateBlogMutation.isPending;

  const setTimestampSec = (value: number) => {
    form.setValue("timestampSec", Math.max(0, Math.floor(value)));
  };

  const updateTimestamp = (deltaSeconds: number) => {
    const next = Number(form.getValues("timestampSec") || 0) + deltaSeconds;
    setTimestampSec(next);
  };

  const addTag = () => {
    const value = normalizeTag(form.getValues("tagInput") || "");
    if (!value) return;

    const currentTags = form.getValues("tags") || [];
    if (currentTags.includes(value) || currentTags.length >= 10) return;

    form.setValue("tags", [...currentTags, value]);
    form.setValue("tagInput", "");
  };

  const removeTag = (value: string) => {
    const currentTags = form.getValues("tags") || [];
    form.setValue(
      "tags",
      currentTags.filter((tag) => tag !== value),
    );
  };

  const toggleAttachment = (value: z.infer<typeof attachmentTypeSchema>) => {
    const current = form.getValues("selectedAttachments") || [];
    const exists = current.includes(value);
    form.setValue(
      "selectedAttachments",
      exists ? current.filter((item) => item !== value) : [...current, value],
    );
  };

  const submit = async (published: boolean) => {
    if (!canSubmit || isSubmitting) return false;

    if (isCommentMode) {
      await addCommentMutation.mutateAsync({
        blogId: targetBlogId,
        content: normalizedContent,
        timestampSeconds:
          isAudioComment && formData?.includeTimestamp
            ? Math.max(0, Number(formData.timestampSec || 0))
            : undefined,
      });
    } else if (isEditMode) {
      await updateBlogMutation.mutateAsync({
        id: targetBlogId,
        content: normalizedContent,
        status: published ? "published" : "draft",
      });
    } else {
      await createBlogMutation.mutateAsync({
        title: normalizedTitle,
        content: normalizedContent,
        tags: formData?.tags || [],
        type: "text",
        published,
      });
    }

    props.onSaved?.();
    return true;
  };

  return {
    form,
    formData,
    isAudioComment,
    isCommentMode,
    isEditMode,
    targetBlogId,
    isValidBlogId,
    canSubmit,
    isSubmitting,
    addTag,
    removeTag,
    toggleAttachment,
    setTimestampSec,
    updateTimestamp,
    submit,
    createBlogMutation,
    updateBlogMutation,
    addCommentMutation,
  };
};

export const useBlogFormContext = () => {
  const context = useContext(BlogFormContext);
  if (context === undefined) {
    throw new Error(
      "useBlogFormContext must be used within a BlogFormProvider",
    );
  }
  return context;
};
