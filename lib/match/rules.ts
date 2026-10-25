// Group-size rules applied after lib/nado opens rooms, plus the room life cycle.
// Pure functions so lib/match/rules.test.ts can check them without a database.
import type { MemberStatus, RoomStatus } from "@/types/database";

export const ABSOLUTE_MIN = 2;

// Each member has their own minimum group size; the activity has a maximum (set by the AI).
// Keep the members with the smallest minimums up to the maximum, then drop anyone whose
// minimum is bigger than the group, until nobody is left out. Below 2 people, dissolve.
export function applyGroupRules(input: { members: string[]; minOf: (id: string) => number; max: number }) {
  const { members, minOf, max } = input;
  let keep = [...members].sort((a, b) => minOf(a) - minOf(b) || a.localeCompare(b)).slice(0, Math.max(ABSOLUTE_MIN, max));
  for (;;) {
    const next = keep.filter((id) => minOf(id) <= keep.length);
    if (next.length === keep.length) break;
    keep = next;
  }
  const kept = new Set(keep);
  const minSize = Math.max(ABSOLUTE_MIN, ...keep.map(minOf));
  return {
    keep: keep.sort(),
    drop: members.filter((id) => !kept.has(id)).sort(),
    minSize,
    dissolve: keep.length < ABSOLUTE_MIN,
  };
}

// Everyone confirms by 30 minutes before the start, but gets at least 15 minutes,
// and never later than 5 minutes before the start.
export function confirmDeadline(startsAt: number, now: number) {
  const MIN = 60_000;
  return Math.min(Math.max(startsAt - 30 * MIN, now + 15 * MIN), startsAt - 5 * MIN);
}

export type SettleResult =
  | { action: "wait" }
  | { action: "open"; decline: string[] }
  | { action: "dissolve"; decline: string[] };

// What should happen to a room right now.
// open room: opens once everybody answered (or the deadline passed) with enough confirmed;
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
