// Request/AI answer checks shared by API routes. Pure functions, tested in lib/validate.test.ts.

export type Fail = { ok: false; message: string };

// PUT /api/profile/interests body.interests → unique activities with an integer min.
// The activity's own max is checked by the route against the DB.
export function parseInterestList(list: unknown, max: number): { ok: true; rows: { activity: string; min: number }[] } | Fail {
  if (!Array.isArray(list)) return { ok: false, message: "interests must be a list." };
  const byName = new Map<string, number>();
  for (const item of list) {
    if (!item || typeof item !== "object") return { ok: false, message: "Each interest needs an activity and a minimum." };
    const { activity, min } = item as { activity?: unknown; min?: unknown };
    if (typeof activity !== "string" || !activity.trim() || activity.length > 40 || !Number.isInteger(min)) {
      return { ok: false, message: "Each interest needs an activity and a minimum." };
    }
    byName.set(activity, min as number); // a repeated activity keeps the last minimum
  }
  if (byName.size > max) return { ok: false, message: `Pick up to ${max} interests.` };
  return { ok: true, rows: [...byName].map(([activity, min]) => ({ activity, min })) };
}

const DAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const TIME = /^([01]?\d|2[0-3]):[0-5]\d$/;
const pad = (t: string) => t.padStart(5, "0");

// Claude's Albert answer → class meetings the schedule can use. Anything malformed is dropped.
export function cleanAlbertClasses(classes: unknown, limit = 60) {
  if (!Array.isArray(classes)) return [];
  const seen = new Set<string>();
  const out: { label: string; day: number; start: string; end: string }[] = [];
  for (const c of classes) {
    if (!c || typeof c !== "object") continue;
    const { course, day, start, end } = c as Record<string, unknown>;
    if (typeof day !== "string" || DAYS[day] === undefined) continue;
    if (typeof start !== "string" || typeof end !== "string" || !TIME.test(start) || !TIME.test(end)) continue;
    if (pad(end) <= pad(start)) continue;
    const row = { label: (typeof course === "string" && course.trim() ? course.trim() : "Class").slice(0, 60), day: DAYS[day], start: pad(start), end: pad(end) };
    const key = `${row.day}|${row.start}|${row.end}|${row.label}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
    if (out.length >= limit) break;
  }
  return out;
}
