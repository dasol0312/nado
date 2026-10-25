// POST /api/open-rooms — the old "Let Claude open rooms" button. Retired (see POST below).
//
// 1. Read that date's activity_slots (the week's saved times, else every-week times) and places
// 2. lib/nado: Claude cleans activity names → code computes overlaps → Claude writes invitations
// 3. Save each room to `rooms` and its members to `room_members` (status 'invited')
//    → invited students' phones get the invitation card through Supabase Realtime
//
// Body (all optional):
//   now: { date: "YYYY-MM-DD", time: "HH:MM" }  open rooms as if it were that campus date/time
//   now: { day: 0-6, time: "HH:MM" }            same, for the next time that weekday comes around
//   replace: true                               delete that date's rooms first and start over
// Without `replace`, students already in a room that date aren't invited again,
// so pressing the button twice is safe.

import { NextResponse } from "next/server";
import { PRESET_ACTIVITIES } from "@/lib/activities";
import { openRoomsWithClaude } from "@/lib/nado/claude";
import type { Slot } from "@/lib/nado/matching";
import { fail, selectAll, type Db } from "@/lib/server/api";
import { createClient } from "@/lib/supabase/server";
import { addDays, campusInstant, campusToday, dayOfWeek, isDate, weekStartOf } from "@/lib/time";

export const dynamic = "force-dynamic";
// Claude makes two calls; give them time.
export const maxDuration = 60;

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

// Resolve the body to a campus date and time, or null if it's invalid
function resolveNow(raw: unknown): { date: string; time: string; replace: boolean } | null {
  const body = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const replace = body.replace ?? false;
  if (typeof replace !== "boolean") return null;

  const today = campusToday();
  if (body.now === undefined) return { ...today, replace };
  if (!body.now || typeof body.now !== "object") return null;
  const { date, day, time } = body.now as Record<string, unknown>;
  if (typeof time !== "string" || !TIME.test(time)) return null;
  if (isDate(date)) return { date, time, replace };
  if (typeof day === "number" && Number.isInteger(day) && day >= 0 && day <= 6) {
    return { date: addDays(today.date, (day - dayOfWeek(today.date) + 7) % 7), time, replace };
  }
  return null;
}

export async function POST(req: Request) {
  // Retired: the app matches through /api/match now. This older path could delete a day's
  // rooms without signing in, so it's off unless NADO_LEGACY_OPEN_ROOMS=1 (local testing).
  if (process.env.NADO_LEGACY_OPEN_ROOMS !== "1") {
    return fail(410, "RETIRED", "Matching moved to /api/match. Set NADO_LEGACY_OPEN_ROOMS=1 to use this route locally.");
  }
  if (!process.env.ANTHROPIC_API_KEY) return fail(500, "NO_API_KEY", "ANTHROPIC_API_KEY is not set on the server.");

  const target = resolveNow(await req.json().catch(() => null));
  if (!target) {
    return fail(400, "BAD_REQUEST", 'now must be { date: "YYYY-MM-DD" } or { day: 0-6 }, plus time: "HH:MM".');
  }
  const { date, time, replace } = target;
  const day = dayOfWeek(date);
  const week = weekStartOf(date);
  const sb = await createClient();

  try {
    if (replace) {
      const removed = await sb
        .from("rooms")
        .delete()
        .gte("starts_at", campusInstant(date, "00:00"))
        .lt("starts_at", campusInstant(addDays(date, 1), "00:00"));
      if (removed.error) throw new Error(removed.error.message);
    }

    const [slotRows, placesRes, busy] = await Promise.all([
      // This week's saved rows (any day) plus every-week rows for this weekday.
      // 800 students easily pass Supabase's 1,000-row limit, so read every page.
      selectAll((from, to) =>
        sb
          .from("activity_slots")
          .select("id, student_id, activity, day_of_week, start_time, end_time, week_start")
          .or(`week_start.eq.${week},and(week_start.is.null,day_of_week.eq.${day})`)
          .order("id")
          .range(from, to),
      ),
      sb.from("places").select("id, name, good_for"),
      studentsWithRoomsOn(sb, date),
    ]);
    if (placesRes.error) throw new Error(placesRes.error.message);
    if (!placesRes.data.length) return fail(500, "NO_PLACES", "Add meeting places first.");

    // A week saved for (student, activity) replaces that pair's every-week times.
    const savedThisWeek = new Set(slotRows.filter((s) => s.week_start).map((s) => `${s.student_id}|${s.activity}`));
    const slots: Slot[] = slotRows
      .filter((s) => s.day_of_week === day && !busy.has(s.student_id))
      .filter((s) => s.week_start || !savedThisWeek.has(`${s.student_id}|${s.activity}`))
      .map((s) => ({
        studentId: s.student_id,
        activity: s.activity,
        day: s.day_of_week,
        start: String(s.start_time).slice(0, 5),
        end: String(s.end_time).slice(0, 5),
      }));
    const places = placesRes.data;

    const result = await openRoomsWithClaude({
      slots,
      places: places.map((p) => ({ name: p.name, goodFor: p.good_for ?? [] })),
      now: { day, time },
      presets: PRESET_ACTIVITIES,
    });

    const placeIds = new Map(places.map((p) => [p.name, p.id]));
    const opened = [];
    for (const r of result.rooms) {
      const room = await sb
        .from("rooms")
        .insert({
          activity: r.activity,
          starts_at: campusInstant(date, r.start),
          place_id: placeIds.get(r.place) ?? null,
          invitation: r.invitation,
          icebreaker: r.icebreaker,
          color: r.color,
          status: "open",
        })
        .select("id")
        .single();
      if (room.error) {
        console.error("[open-rooms] room insert failed:", room.error);
        continue;
      }
      const members = await sb
        .from("room_members")
        .insert(r.members.map((student_id) => ({ room_id: room.data.id, student_id, status: "invited" })));
      if (members.error) console.error("[open-rooms] member insert failed:", members.error);
      opened.push({ id: room.data.id, ...r });
    }

    return NextResponse.json({ now: { date, day, time }, opened, skipped: result.skipped, filtered: result.filtered });
  } catch (e) {
    return fail(500, "DB_ERROR", (e as Error).message);
  }
}

// Students already invited to (or in) a room that campus date
async function studentsWithRoomsOn(sb: Db, date: string): Promise<Set<string>> {
  const { data, error } = await sb
    .from("rooms")
    .select("room_members(student_id)")
    .neq("status", "cancelled")
    .gte("starts_at", campusInstant(date, "00:00"))
    .lt("starts_at", campusInstant(addDays(date, 1), "00:00"));
  if (error) throw new Error(error.message);
  const ids = new Set<string>();
  for (const room of (data ?? []) as { room_members: { student_id: string }[] }[]) {
    for (const m of room.room_members ?? []) ids.add(m.student_id);
  }
  return ids;
}
