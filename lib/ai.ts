import "server-only";
// The Claude features still to build. They belong in lib/nado/ (Yerin's code); until those
// functions exist, each one here returns null and the caller uses the fallback.
// To connect one: call the lib/nado function inside the stub and return its result.
// Everything the functions return is checked by the caller, so a bad answer can't break a screen.
// Guide: docs/HANDOFF-yerin.md
//
//   readAlbertSchedule(image)  → app/api/schedule/read
//   thinkAboutInterest(q)      → app/api/activities (adding a custom interest, "Ask Claude to rethink")
//   nextIcebreaker(q)          → app/api/rooms/[roomId]/icebreaker ("Another question")
//
// Already done in main: meeting spots, place reasons, invitations and the first icebreaker
// are written by lib/nado/plan.ts when /api/match opens a plan.
import type { Category } from "@/lib/catalog";

// Throw this to pick the error message the student sees (see app/api/schedule/read)
export class AiError extends Error {
  constructor(public code: "images_unavailable" | "rejected" | "rate_limited" | "failed", message?: string) {
    super(message ?? code);
  }
}

// What the Albert prompt asks Claude for: one entry per class meeting
export type AlbertClass = { course: string; day: string; start: string; end: string }; // day "Mon"…"Sun", 24-hour "HH:MM"

// null = Claude isn't connected. [] = not a schedule / nothing found.
export async function readAlbertSchedule(image: { data: string; mediaType: string }): Promise<AlbertClass[] | null> {
  void image;
  return null;
}

// A custom interest: what it is and how many strangers it works for.
// Places aren't decided here; lib/nado/plan.ts picks them when the first plan opens.
export type InterestAnswer = { label: string; cat: Category; max: number; min: number; reason: string };

export async function thinkAboutInterest(q: { name: string; categories: readonly string[] }): Promise<InterestAnswer | null> {
  void q;
  return null;
}

export async function nextIcebreaker(q: { people: number; label: string; previous: string }): Promise<string | null> {
  void q;
  return null;
}
