import { NextResponse } from "next/server";
import { fail, isUuid } from "@/lib/server/api";
import { createClient } from "@/lib/supabase/server";
import { dayOfWeek, isDate } from "@/lib/time";

const TIME = /^([01]\d|2[0-3]):[0-5]\d$|^24:00$/;
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

// Replace one activity's times for one week.
// Body: { studentId, activity, weekStart: "YYYY-MM-DD" (a Sunday),
//         slots: [{ day: 0-6, start: "HH:MM", end: "HH:MM" }] }
// An empty slots list clears that week for the activity.
export async function PUT(req: Request) {
  const body = await req.json().catch(() => null);
  const studentId = body?.studentId;
  const weekStart = body?.weekStart;
  const activity = typeof body?.activity === "string" ? body.activity.trim().toLowerCase().replace(/\s+/g, " ") : "";
  const slots: unknown = body?.slots;

  if (!isUuid(studentId)) return fail(400, "BAD_REQUEST", "Valid studentId is required.");
  if (!isDate(weekStart) || dayOfWeek(weekStart) !== 0) return fail(400, "BAD_REQUEST", "weekStart must be a Sunday (YYYY-MM-DD).");
  if (!activity || activity.length > 40) return fail(400, "BAD_REQUEST", "Activity must be 1-40 characters.");
  if (!Array.isArray(slots) || slots.length > 7 * 24) return fail(400, "BAD_REQUEST", "slots must be a list.");
  for (const s of slots) {
    const ok =
      s && Number.isInteger(s.day) && s.day >= 0 && s.day <= 6 &&
      typeof s.start === "string" && TIME.test(s.start) &&
      typeof s.end === "string" && TIME.test(s.end) &&
      toMin(s.end) > toMin(s.start);
    if (!ok) return fail(400, "BAD_REQUEST", "Each slot needs day 0-6 and start < end (HH:MM).");
  }

  const sb = await createClient();
  const removed = await sb
    .from("activity_slots")
    .delete()
    .eq("student_id", studentId)
    .eq("activity", activity)
    .eq("week_start", weekStart);
  if (removed.error) return fail(500, "DB_ERROR", removed.error.message);

  if (slots.length) {
    const added = await sb.from("activity_slots").insert(
      slots.map((s: { day: number; start: string; end: string }) => ({
        student_id: studentId,
        activity,
        week_start: weekStart,
        day_of_week: s.day,
        start_time: s.start,
        end_time: s.end,
      })),
    );
    if (added.error) return fail(500, "DB_ERROR", added.error.message);
  }

  return NextResponse.json({ ok: true, activity, weekStart, slots: slots.length });
}
