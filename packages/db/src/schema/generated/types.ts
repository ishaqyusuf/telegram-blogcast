import type { ColumnType } from "kysely";

export type Generated<T> =
  T extends ColumnType<infer S, infer I, infer U>
    ? ColumnType<S, I | undefined, U>
    : ColumnType<T, T | undefined, T>;
export type Timestamp = ColumnType<Date, Date | string, Date | string>;

export type Album = {
  id: Generated<number>;
  createdAt: Generated<Timestamp | null>;
  updatedAt: Timestamp | null;
  deletedAt: Timestamp | null;
  name: string;
  albumType: string | null;
  albumAuthorId: number | null;
  thumbnailId: number | null;
};
export type AlbumAudioIndex = {
  id: Generated<number>;
  createdAt: Generated<Timestamp | null>;
  updatedAt: Timestamp | null;
  deletedAt: Timestamp | null;
  albumId: number | null;
  blogAudioId: number;
};
export type Author = {
  id: Generated<number>;
  createdAt: Generated<Timestamp | null>;
  updatedAt: Timestamp | null;
  deletedAt: Timestamp | null;
  name: string | null;
  nameAr: string | null;
};
export type Blog = {
  id: Generated<number>;
  content: string | null;
  published: Generated<boolean | null>;
  publishedAt: Timestamp | null;
  status: string | null;
  meta: unknown | null;
  blogDate: Timestamp | null;
  createdAt: Generated<Timestamp | null>;
  updatedAt: Timestamp | null;
  deletedAt: Timestamp | null;
  type: Generated<string>;
  channelId: number | null;
  thumbnailId: number | null;
};
export type BlogComments = {
  id: Generated<number>;
  createdAt: Generated<Timestamp | null>;
  updatedAt: Timestamp | null;
  deletedAt: Timestamp | null;
  blogId: number;
  commentId: number;
};
export type BlogTags = {
  id: Generated<number>;
  createdAt: Generated<Timestamp | null>;
  updatedAt: Timestamp | null;
  deletedAt: Timestamp | null;
  tagId: number | null;
  blogId: number | null;
};
export type BlogViews = {
  id: Generated<number>;
  createdAt: Generated<Timestamp | null>;
  updatedAt: Timestamp | null;
  deletedAt: Timestamp | null;
  blogId: number;
  type: string;
};
export type Channel = {
  id: Generated<number>;
  createdAt: Generated<Timestamp | null>;
  updatedAt: Timestamp | null;
  deletedAt: Timestamp | null;
  title: string | null;
  username: string;
  meta: unknown | null;
};
export type File = {
  id: Generated<number>;
  createdAt: Generated<Timestamp | null>;
  updatedAt: Timestamp | null;
  deletedAt: Timestamp | null;
  fileType: string;
  fileId: string;
  fileUniqueId: string | null;
  fileSize: number | null;
  fileName: string | null;
  /**
   * @kyselyType('mime1')
   */
  mimeType: "mime1" | null;
  width: number | null;
  height: number | null;
  duration: number | null;
};
export type Media = {
  id: Generated<number>;
  fileId: number | null;
  mimeType: string;
  title: string | null;
  authorId: number | null;
  mediaIndexId: number | null;
  blogId: number | null;
};
export type MessageForward = {
  id: Generated<number>;
  createdAt: Generated<Timestamp | null>;
  updatedAt: Timestamp | null;
  forwardedAt: Timestamp | null;
  deletedAt: Timestamp | null;
  messageId: number;
  publishedDate: Timestamp;
  channelId: number;
  status: string;
};
export type Search = {
  id: Generated<number>;
  createdAt: Generated<Timestamp | null>;
  updatedAt: Timestamp | null;
  deletedAt: Timestamp | null;
  searchTerm: string;
};
export type Tags = {
  id: Generated<number>;
  title: string;
  createdAt: Generated<Timestamp | null>;
  updatedAt: Timestamp | null;
  deletedAt: Timestamp | null;
};
export type Thumbnail = {
  id: Generated<number>;
  createdAt: Generated<Timestamp | null>;
  updatedAt: Timestamp | null;
  deletedAt: Timestamp | null;
  fileId: number;
  blogId: number | null;
};
export type User = {
  id: Generated<number>;
  name: string;
  email: string;
  role: string;
  createdAt: Generated<Timestamp | null>;
  updatedAt: Timestamp | null;
  deletedAt: Timestamp | null;
};
export type DB = {
  Album: Album;
  AlbumAudioIndex: AlbumAudioIndex;
  Author: Author;
  Blog: Blog;
  BlogComments: BlogComments;
  BlogTags: BlogTags;
  BlogViews: BlogViews;
  Channel: Channel;
  File: File;
  Media: Media;
  MessageForward: MessageForward;
  Search: Search;
  Tags: Tags;
  Thumbnail: Thumbnail;
  User: User;
};
