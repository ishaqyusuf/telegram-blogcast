
import { HomeFeedPostAuthor, AnyHomeFeedPost } from "./types";

const ahmed: HomeFeedPostAuthor = {
  name: "Ahmed's Thoughts",
  avatarUrl:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuCVP8L4A9Kn9Iguz770g1EaH0dpKBBWNqv55hMRLNUovFepTIOwlP1Zhayu-YFu0Ptv7RmQbvMzyr5NlrcTG9X0zd7F_ZIdFldNMWGaBesWMuiuoIxafpd5G7ed6j7JeghXNI9rudtfLJ96xbroZPOSSL7djGfpYqB9yQZN8HC9OO2fMx1XovPLRyH-dmtc8Lh7y3SIOdZHqx1S_hRmTvDNmfEj9CYpZcQuHKrSKwGLVNVMmQQRl16e2vcDVGG8fXsCbLWCP8Iz10U",
  isVerified: true,
};

const techTalk: HomeFeedPostAuthor = {
  name: "Tech Talk",
  avatarUrl:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuD7tyyGpk5aUcTpxvaRyXKEoiKFTaqFrEbdn26U1S-ldjKOgFqjWF7hRyoT4-4KjCAETdAbR3NQkO-_y_jDlX9Qbnk9TVXfkBTXm6nBX4cO0-YQm1MwOn6JiYEt7LC3yaS2cziyvfG0fdEpZE3vsIL2hCWZjxsNOnE9cDmCOnyZO2wlc17KVOGWgYoffQz6bRFLZnWdrv17uT8vq8zXeIGKuvIW0KjYbbB4av020oQyNSUAa7aTmXrx6FbvQr6GqyyV1Zw9a8Z1EZo",
};

const sarah: HomeFeedPostAuthor = {
  name: "Sarah Ali",
  avatarUrl:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuDVQDYsi012xnhpKKUIiMM75mQOBoOb3jUyAeNPP7NIfRs-iXU5WQJGMvOcmsEhA-fAtf9jaGX5PdvByiAUmbnWuSze_Lqx8foBQJAG0YK98Jv0dXTbUpkuFCTaiaJDDHP3wV2EvDbSTM6m6z2qJh7yY4ZmzX1xsMhtaWS8YQdR3bB-_ub-DPbPUKnutJecD9hjG4_MQg52RVcGZm-uUmg68AwxVwWtyReT2ujNDXJWDNLyyZlnSkxSm7NkHv9n-XWjrE4AhxBp8wM",
};

export const DUMMY_FEED_DATA: AnyHomeFeedPost[] = [
  {
    id: "1",
    type: "audio",
    author: ahmed,
    createdAt: "2h ago",
    title: "تأملات في الصباح الباكر",
    content:
      "الهدوء الذي يسبق شروق الشمس يحمل في طياته معاني كثيرة، إنه الوقت المثالي للتفكر في نعم الله وترتيب الأولويات لليوم الجديد.",
    tags: ["#Life", "#Reflection"],
    likes: 124,
    isBookmarked: false,
    audio: {
      duration: "05:32",
    },
  },
  {
    id: "2",
    type: "video",
    author: techTalk,
    createdAt: "5h ago",
    title: "مستقبل الذكاء الاصطناعي",
    content:
      "هل سيغير الذكاء الاصطناعي طريقة حياتنا بشكل جذري؟ في هذه الحلقة نناقش التحديات والفرص القادمة.",
    tags: ["#Tech"],
    likes: 89,
    isBookmarked: true,
    coverImageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAx_cttd-ahhvC_ho6pqRPNMlaOTc8gXuqKkPuQOzDOhXXCul_OjqR7gz4ukgmgDy0VVa20OzZAlPXoVfUFyWS-f15dH3v71Yzl_nQ_cJc9-ZfqcafP-Csd7K903j99vQfTPMgpsTBC1skmpgMayiAeUgELxdDq4Q3AgziktTfeq4KiEs2qEnY6647P3TNrT7DPReMcuUJqTf9ddk8WW9xtOmkzsvPCnaeKDd-8DiJfm8aosvjfyiOu8Lgt94CX1rrizX3HF1T4Tvg",
    video: {
      duration: "12:04",
    },
  },
  {
    id: "3",
    type: "text",
    author: sarah,
    createdAt: "1d ago",
    title: "",
    content:
      "أحياناً تكون الكلمات غير كافية للتعبير عما في الداخل. الموسيقى وحدها قادرة على ذلك.",
    tags: [],
    likes: 42,
    isBookmarked: false,
  },
];

export const DUMMY_FILTERS = [
  "All",
  "Following",
  "Popular",
  "History",
  "Religion",
  "Science",
  "Podcast",
];

export const DUMMY_NOW_PLAYING = {
  title: "Episode 4: The Journey Begins",
  artist: "Daily Reflections",
  artwork:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuB7kBGTRZMSZkxa_XZS_GJZvSfhJv4tCmNTMz4hrexW9Sfys_A6DS6H_V5048f5YFXfAYpDRjAFKNyREr0m5FhRc84VCX7VmroHCub2KzNPGQpSUBHA6mhOudG1onQupJEj6qL0gitVdIb_dxEpECv7bj9yALJBKtvc15exUns_qcNzUae7YM29t3OIiGpvKtwYGMa1Wv8_gKsULJwOJ9eW_5vCRXchn8CppNNUYX0B3i07mP4joW5-zRkABXExMnNi67E_Bar4isU",
  progress: 0.3,
};
