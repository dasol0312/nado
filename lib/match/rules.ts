// The room life cycle after matching (lib/server/match.ts) opens a plan.
// A pure function so lib/match/rules.test.ts can check it without a database.
import type { MemberStatus, RoomStatus } from "@/types/database";

export type SettleResult =
  | { action: "wait" }
  | { action: "open"; decline: string[] }
  | { action: "dissolve"; decline: string[] };

// What should happen to a room right now.
// open room: opens once everybody answered (or the confirm deadline passed) with enough confirmed;
//            dissolves when it can no longer reach its minimum.
// confirmed room: dissolves when cancellations drop it below the minimum.
export function settle(input: {
  status: RoomStatus;
  minSize: number;
  confirmBy: number | null;
  now: number;
  members: { id: string; status: MemberStatus }[];
}): SettleResult {
  const { status, minSize, confirmBy, now, members } = input;
  const confirmed = members.filter((m) => m.status === "confirmed").length;
  const pending = members.filter((m) => m.status === "invited" || m.status === "joined").map((m) => m.id);

  if (status === "cancelled") return { action: "wait" };
  if (status === "confirmed") return confirmed < minSize ? { action: "dissolve", decline: [] } : { action: "wait" };

  if (confirmed + pending.length < minSize) return { action: "dissolve", decline: pending };
  const expired = confirmBy !== null && now >= confirmBy;
  if (!pending.length || expired) {
    return confirmed >= minSize ? { action: "open", decline: pending } : { action: "dissolve", decline: pending };
  }
  return { action: "wait" };
}

// A free window minus busy ranges (minutes since midnight), keeping pieces of at least `min` minutes.
// Used to keep a student who left a plan ("Can't make it") out of that hour when rematching.
export function subtractBusy(from: number, to: number, busy: { from: number; to: number }[], min = 60) {
  let pieces = [{ from, to }];
  for (const b of busy) {
    pieces = pieces.flatMap((p) => (b.to <= p.from || b.from >= p.to ? [p] : [
      ...(b.from > p.from ? [{ from: p.from, to: b.from }] : []),
      ...(b.to < p.to ? [{ from: b.to, to: p.to }] : []),
    ]));
  }
  return pieces.filter((p) => p.to - p.from >= min);
}
