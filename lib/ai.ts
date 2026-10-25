import "server-only";
// The four new Claude features. They belong in lib/nado/ (Yerin's code); until those
// functions exist, each one here returns null and the caller uses the fallback.
// To connect one: call the lib/nado function inside the stub and return its result.
// Everything the functions return is checked by the caller, so a bad answer can't break a screen.
// Guide for Yerin: docs/HANDOFF-yerin.md
//
//   readAlbertSchedule(image)  → app/api/schedule/read
//   thinkAboutInterest(input)  → app/api/activities (adding a custom interest, "Ask Claude to rethink")
//   explainPlace(input)        → lib/match/run.ts settleRoom (when a room opens)
//   nextIcebreaker(input)      → app/api/rooms/[roomId]/icebreaker ("Another question")
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

// What the "new interest" prompt asks Claude for (Nado 개발 명세서 · 새 키워드 고민)
export type InterestAnswer = {
  label: string;
  cat: Category;
  max: number;
  min: number;
  meet: string; // campus place key: kimmel | bobst | silver | paulson
  place: string | null; // a known place key, or null when suggesting a venue
  venue?: { name: string; address: string; ns: string; ew: string; far: "" | "N" | "S" | "E" | "W"; confident: boolean } | null;
  reason: string;
};
export type InterestQuestion = {
  name: string; // what the student typed
  categories: readonly string[];
  campus: { key: string; name: string }[];
  places: { key: string; name: string; address: string }[];
  nsStreets: string[];
  ewStreets: string[];
};

export async function thinkAboutInterest(q: InterestQuestion): Promise<InterestAnswer | null> {
  void q;
  return null;
}

export type PlaceQuestion = {
  people: number;
  label: string; // "Ramen"
  range: string; // "12–1pm"
  meet: { name: string; address: string };
  dest: { name: string; address: string };
  same: boolean; // the activity happens where they meet
  walkMinutes: number;
};

export async function explainPlace(q: PlaceQuestion): Promise<string | null> {
  void q;
  return null;
}

export async function nextIcebreaker(q: { people: number; label: string; previous: string }): Promise<string | null> {
  void q;
  return null;
}

// Rule-based explanation when Claude has nothing to say
export function fallbackPlaceReason(q: PlaceQuestion) {
  return q.same
    ? `${q.meet.name} is indoors, easy to find, and has room for ${q.people} people, so you can meet and start in the same place.`
    : `${q.meet.name} is an indoor spot all ${q.people} of you can find easily, and ${q.dest.name} is about a ${q.walkMinutes}-minute walk from there.`;
}
