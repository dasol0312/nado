// POST /api/open-rooms — the demo's "Let Claude open rooms" button.
//
// 1. Read today's activity_slots and places from Supabase
// 2. lib/nado: Claude cleans activity names → code computes overlaps → Claude writes invitations
// 3. Save each room to `rooms` and its members to `room_members` (status 'invited')
//    → invited students' phones get the invitation card through Supabase Realtime
//
// Optional body for rehearsing: { "now": { "day": 0, "time": "10:30" } }
// opens rooms as if it were that weekday/time (campus time, America/Los_Angeles).

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { openRoomsWithClaude } from "@/lib/nado/claude";
import type { Place as NadoPlace, Slot } from "@/lib/nado/matching";
import type { ActivitySlot, Place } from "@/types/database";

export const dynamic = "force-dynamic";

const TZ = "America/Los_Angeles";
const PRESETS = ["boba", "basketball", "hiking", "musicals", "baseball", "coffee", "board games", "soccer", "study"];

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is not set on the server." }, { status: 500 });
  }

  const body = (await req.json().catch(() => ({}))) as { now?: { day?: unknown; time?: unknown } };
  const campus = campusNow();
  const now = validNow(body.now) ?? { day: campus.day, time: campus.time };
  // Date of the target weekday: today, or the next time that weekday comes around
  const date = addDays(campus.date, (now.day - campus.day + 7) % 7);

  const supabase = await createClient();

  const [slotsRes, placesRes] = await Promise.all([
    supabase.from("activity_slots").select("*").eq("day_of_week", now.day),
    supabase.from("places").select("*"),
  ]);
  if (slotsRes.error || placesRes.error) {
    return NextResponse.json({ error: (slotsRes.error ?? placesRes.error)!.message }, { status: 500 });
  }
  const dbPlaces = (placesRes.data ?? []) as Place[];

  // Students already in a room that day aren't invited again (pressing the button twice is safe)
  const busy = await studentsWithRoomsOn(supabase, date);

  const slots: Slot[] = ((slotsRes.data ?? []) as ActivitySlot[])
    .filter((s) => !busy.has(s.student_id))
    .map((s) => ({
      studentId: s.student_id,
      activity: s.activity,
      day: s.day_of_week,
      start: s.start_time.slice(0, 5),
      end: s.end_time.slice(0, 5),
    }));
  const places: NadoPlace[] = dbPlaces.map((p) => ({ name: p.name, goodFor: p.good_for ?? [] }));

  const result = await openRoomsWithClaude({ slots, places, now, presets: PRESETS });

  const opened = [];
  for (const r of result.rooms) {
    const { data: room, error } = await supabase
      .from("rooms")
      .insert({
        activity: r.activity,
        starts_at: toTimestamp(date, r.start),
        place_id: dbPlaces.find((p) => p.name === r.place)?.id ?? null,
        invitation: r.invitation,
        icebreaker: r.icebreaker,
        color: r.color,
        status: "open",
      })
      .select("id")
      .single();
    if (error || !room) {
      console.error("[open-rooms] room insert failed:", error);
      continue;
    }
    const { error: mErr } = await supabase
      .from("room_members")
      .insert(r.members.map((student_id) => ({ room_id: room.id, student_id, status: "invited" })));
    if (mErr) console.error("[open-rooms] member insert failed:", mErr);
    opened.push({ id: room.id, ...r });
  }

  return NextResponse.json({ now, date, opened, skipped: result.skipped, filtered: result.filtered });
}

// ---------- helpers ----------

type Supa = Awaited<ReturnType<typeof createClient>>;

async function studentsWithRoomsOn(supabase: Supa, date: string): Promise<Set<string>> {
  const { data } = await supabase
    .from("rooms")
    .select("room_members(student_id)")
    .neq("status", "cancelled")
    .gte("starts_at", toTimestamp(date, "00:00"))
    .lt("starts_at", toTimestamp(addDays(date, 1), "00:00"));
  const ids = new Set<string>();
  for (const room of (data ?? []) as { room_members: { student_id: string }[] }[]) {
    for (const m of room.room_members ?? []) ids.add(m.student_id);
  }
  return ids;
}

function validNow(v: { day?: unknown; time?: unknown } | undefined) {
  if (!v) return null;
  const { day, time } = v;
  if (typeof day !== "number" || !Number.isInteger(day) || day < 0 || day > 6) return null;
  if (typeof time !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
  return { day, time };
}

// Current campus date ("YYYY-MM-DD"), weekday (0=Sun) and time ("HH:MM")
function campusNow() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", weekday: "short", hourCycle: "h23",
    }).formatToParts(new Date()).map((p) => [p.type, p.value]),
  );
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday);
  return { date: `${parts.year}-${parts.month}-${parts.day}`, day, time: `${parts.hour}:${parts.minute}` };
}

function addDays(date: string, n: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Campus-local date + "HH:MM" → ISO timestamp with the right PDT/PST offset
function toTimestamp(date: string, hhmm: string) {
  const guess = new Date(`${date}T${hhmm}:00Z`);
  const offset = tzOffsetMinutes(guess);
  return new Date(guess.getTime() - offset * 60_000).toISOString();
}

function tzOffsetMinutes(d: Date) {
  const name = new Intl.DateTimeFormat("en-US", { timeZone: TZ, timeZoneName: "longOffset" })
    .formatToParts(d).find((p) => p.type === "timeZoneName")?.value ?? "GMT-08:00";
  const m = name.match(/GMT([+-])(\d{2}):?(\d{2})?/);
  if (!m) return -480;
  return (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0));
}
