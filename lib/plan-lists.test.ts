import assert from "node:assert/strict";
import { test } from "node:test";
import type { Plan } from "@/components/shell/AppProvider";
import { activeGroups, pastGroups, upcomingMatches } from "./plan-lists";

const now = new Date("2026-10-25T13:00:00Z");
function plan(id: string, minutes: number, status: Plan["status"] = "open", myStatus: Plan["myStatus"] = "invited"): Plan {
  return {
    id, startsAt: now.getTime() + minutes * 60_000, endsAt: now.getTime() + (minutes + 60) * 60_000,
    status, myStatus, activity: "boba", minSize: 2, maxSize: 4,
    confirmBy: null, invitation: null, icebreaker: null, placeReason: null,
    meet: null, dest: null, members: [],
  };
}

test("matches count only unanswered invitations within the displayed four-hour window", () => {
  const plans = [
    plan("expired", -1), plan("starting-now", 0), plan("soon", 5),
    plan("boundary", 240), plan("later", 241),
    plan("cancelled", 30, "cancelled"), plan("joined", 30, "open", "joined"),
  ];
  assert.deepEqual(upcomingMatches(plans, now).map((p) => p.id), ["soon", "boundary"]);
  assert.deepEqual(upcomingMatches(plans, new Date(now.getTime() + 5 * 60_000)).map((p) => p.id), ["boundary", "later"]);
});

test("groups include waiting and confirmed groups, excluding past/dissolved and left groups", () => {
  const plans = [
    plan("waiting", 30, "open", "joined"),
    plan("waiting-for-others", 30, "open", "confirmed"),
    plan("room-open", 30, "confirmed", "confirmed"),
    plan("dissolved", 30, "cancelled", "confirmed"),
    plan("left", 30, "confirmed", "cancelled"),
    plan("invited", 30), plan("declined", 30, "open", "declined"),
  ];
  assert.deepEqual(activeGroups(plans, now).map((p) => p.id), ["waiting", "waiting-for-others", "room-open"]);
});

test("groups drop out once they start (still waiting) or end (room open), and ended rooms become past", () => {
  const plans = [
    plan("waiting-started", -5, "open", "joined"),
    plan("room-running", -30, "confirmed", "confirmed"),
    plan("room-ended", -90, "confirmed", "confirmed"),
    plan("dissolved", -10, "cancelled", "joined"),
    plan("left", -90, "confirmed", "cancelled"),
  ];
  assert.deepEqual(activeGroups(plans, now).map((p) => p.id), ["room-running"]);
  assert.deepEqual(pastGroups(plans, now).map((p) => p.id), ["dissolved", "room-ended"]);
});

test("past groups keep the last 30 days only", () => {
  const day = 24 * 60;
  const plans = [
    plan("yesterday", -day, "confirmed", "confirmed"),
    plan("four-weeks", -28 * day, "confirmed", "confirmed"),
    plan("five-weeks", -35 * day, "confirmed", "confirmed"),
  ];
  assert.deepEqual(pastGroups(plans, now).map((p) => p.id), ["yesterday", "four-weeks"]);
});
