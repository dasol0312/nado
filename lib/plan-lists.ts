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

// Past/dissolved groups have their own section and do not contribute to the badge.
export function activeGroups(plans: Plan[]) {
  return plans.filter((p) =>
    p.status !== "cancelled" && (p.myStatus === "joined" || p.myStatus === "confirmed"),
  );
}
