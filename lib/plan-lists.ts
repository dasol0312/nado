import type { Plan } from "@/components/shell/AppProvider";
import { HORIZON_MINUTES } from "./time";

// Shared by the list and tab badge so expired/far-future invites cannot inflate it.
export function upcomingMatches(plans: Plan[], now: Date) {
  const start = now.getTime();
  const horizon = start + HORIZON_MINUTES * 60_000;
  return plans.filter((p) =>
    p.status === "open" && p.myStatus === "invited" &&
    p.startsAt > start && p.startsAt <= horizon,
  );
}

const mine = (p: Plan) => p.myStatus === "joined" || p.myStatus === "confirmed";

// Groups still ahead: waiting ones before they start, open rooms until they end.
// Past/dissolved groups have their own section and do not contribute to the badge.
export function activeGroups(plans: Plan[], now: Date) {
  const t = now.getTime();
  return plans.filter((p) =>
    mine(p) && (p.status === "open" ? p.startsAt > t : p.status === "confirmed" && p.endsAt > t),
  );
}

// How long finished plans stay visible. Older ones are deleted by the matcher (lib/server/match.ts).
export const KEEP_DAYS = 30;

// Rooms that happened (ended) or dissolved in the past month, newest first
export function pastGroups(plans: Plan[], now: Date) {
  const t = now.getTime();
  const since = t - KEEP_DAYS * 24 * 3_600_000;
  return plans
    .filter((p) => (p.status === "cancelled" && mine(p)) || (p.status === "confirmed" && p.endsAt <= t && mine(p)))
    .filter((p) => p.startsAt >= since)
    .sort((a, b) => b.startsAt - a.startsAt);
}
