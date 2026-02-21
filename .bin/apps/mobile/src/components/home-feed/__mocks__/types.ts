
export type HomeFeedPostAuthor = {
  name: string;
  avatarUrl: string;
  isVerified?: boolean;
};

export type HomeFeedPost = {
  id: string;
  author: HomeFeedPostAuthor;
  createdAt: string;
  content: string;
  title: string;
  tags: string[];
  likes: number;
  isBookmarked: boolean;
};

export type HomeFeedAudioPost = HomeFeedPost & {
  type: "audio";
  audio: {
    duration: string;
  };
};

export type HomeFeedVideoPost = HomeFeedPost & {
  type: "video";
  coverImageUrl: string;
  video: {
    duration: string;
  };
};

export type HomeFeedTextPost = HomeFeedPost & {
  type: "text";
};

export type AnyHomeFeedPost =
  | HomeFeedAudioPost
  | HomeFeedVideoPost
  | HomeFeedTextPost;
