// Busy hours + interests -> the Slot list lib/nado's openRooms expects.
// A student's slot is "free time between now and the horizon" for each interest,
// so lib/nado and app/api/open-rooms run unchanged on the new flow.
import type { Slot } from "@/lib/nado/matching";
import { DAY_END, DAY_START, HORIZON_MINUTES, minutesToHHMM } from "@/lib/time";

export type Busy = { start: number; end: number }; // minutes since midnight, that day
export type StudentInput = { id: string; busy: Busy[]; interests: string[] };

const MIN_FREE = 60; // openRooms needs a 60-minute overlap

// Free intervals inside [from, to] after removing busy ones
export function freeIntervals(busy: Busy[], from: number, to: number): Busy[] {
  const sorted = [...busy].sort((a, b) => a.start - b.start);
  const out: Busy[] = [];
  let cur = from;
  for (const b of sorted) {
    if (b.end <= cur) continue;
    if (b.start >= to) break;
    if (b.start > cur) out.push({ start: cur, end: Math.min(b.start, to) });
    cur = Math.max(cur, b.end);
    if (cur >= to) break;
  }
  if (cur < to) out.push({ start: cur, end: to });
  return out;
}

// The window plans can use: starting within the next 4 hours, inside 9 AM-11 PM.
// A plan that starts at the horizon still needs its hour, so the window ends 60 min later.
export function matchWindow(nowMinutes: number) {
  return { from: Math.max(nowMinutes, DAY_START), to: Math.min(nowMinutes + HORIZON_MINUTES + 60, DAY_END) };
}

export function buildSlots(students: StudentInput[], day: number, nowMinutes: number): Slot[] {
  const { from, to } = matchWindow(nowMinutes);
  if (to - from < MIN_FREE) return [];
  const slots: Slot[] = [];
  for (const s of students) {
    if (!s.interests.length) continue;
    for (const iv of freeIntervals(s.busy, from, to)) {
      if (iv.end - iv.start < MIN_FREE) continue;
      for (const activity of s.interests) {
        slots.push({ studentId: s.id, activity, day, start: minutesToHHMM(iv.start), end: minutesToHHMM(iv.end) });
      }
    }
  }
  return slots;
}

// Plans only open around real students: a sample student's slot stays only if some real
// student wants the same activity for at least an hour of the same time. Saves Claude calls
// for rooms nobody real would see, and keeps sample students free for real ones.
export function keepAroundRealStudents(slots: Slot[], isSample: (id: string) => boolean): Slot[] {
  const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  const real = slots.filter((s) => !isSample(s.studentId));
  return slots.filter((s) => !isSample(s.studentId) || real.some((r) =>
    r.activity === s.activity && Math.min(toMin(r.end), toMin(s.end)) - Math.max(toMin(r.start), toMin(s.start)) >= MIN_FREE));
}
