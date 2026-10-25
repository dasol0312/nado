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

// Rooms that happened (ended) or dissolved, newest first
export function pastGroups(plans: Plan[], now: Date, limit = 3) {
  const t = now.getTime();
  return plans
    .filter((p) => mine(p) || p.myStatus === "cancelled")
    .filter((p) => (p.status === "cancelled" && p.myStatus !== "cancelled") || (p.status === "confirmed" && p.endsAt <= t && mine(p)))
    .sort((a, b) => b.startsAt - a.startsAt)
    .slice(0, limit);
}
