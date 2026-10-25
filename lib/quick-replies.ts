// The only things you can say in a room. No free-text chat.
export const QUICK_REPLIES = {
  here: "👋 I'm here",
  late: "⏰ 5 min late",
  cant: "🙏 Can't make it",
} as const;

export type QuickReply = keyof typeof QUICK_REPLIES;

export const isQuickReply = (v: unknown): v is QuickReply =>
  typeof v === "string" && Object.hasOwn(QUICK_REPLIES, v);
