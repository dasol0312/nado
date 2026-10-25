import "server-only";
// The Claude features students use directly (built in lib/nado/features.ts).
// Each returns null when no API key is set, so the caller falls back to its default.
// Everything the functions return is checked by the caller, so a bad answer can't break a screen.
//
//   readAlbertSchedule(image)  → app/api/schedule/read
//   thinkAboutInterest(q)      → app/api/activities (adding a custom interest, "Ask Claude to rethink")
//   nextIcebreaker(q)          → app/api/rooms/[roomId]/icebreaker ("Another question")
//
// Meeting spots, place reasons, invitations and the first icebreaker are written
// by lib/nado/plan.ts when /api/match opens a plan.
import type { Category } from "@/lib/catalog";
import { ClaudeCallError, icebreaker, readAlbert, thinkInterest } from "@/lib/nado/features";

const connected = () => !!process.env.ANTHROPIC_API_KEY;

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
  if (!connected()) return null;
  try {
    return await readAlbert(image);
  } catch (e) {
    throw new AiError(e instanceof ClaudeCallError ? e.kind : "failed", (e as Error).message);
  }
}

// A custom interest: what it is and how many strangers it works for.
// Places aren't decided here; lib/nado/plan.ts picks them when the first plan opens.
export type InterestAnswer = { label: string; cat: Category; max: number; min: number; reason: string };

export async function thinkAboutInterest(q: { name: string; categories: readonly string[] }): Promise<InterestAnswer | null> {
  if (!connected()) return null;
  const a = await thinkInterest(q.name, q.categories);
  return a ? { label: a.label, cat: a.cat as Category, max: a.max, min: a.min, reason: a.reason } : null;
}

export async function nextIcebreaker(q: { people: number; label: string; previous: string }): Promise<string | null> {
  if (!connected()) return null;
  return icebreaker(q);
}
