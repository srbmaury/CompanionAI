export const MIN_END_DISCUSSION_WORDS = 30;

export const countDiscussionWords = (value = "") => value.trim().split(/\s+/).filter(Boolean).length;
