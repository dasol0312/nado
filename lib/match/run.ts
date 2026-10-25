import "server-only";
// Matching with the database: snapshot → Yerin's /api/open-rooms → group-size rules,
// and settling rooms (open / dissolve) as people answer.
import { POST as openRoomsRoute } from "@/app/api/open-rooms/route";
import { explainPlace, fallbackPlaceReason } from "@/lib/ai";
import type { OpenedRoom, Filtered } from "@/lib/nado/claude";
import type { Skipped } from "@/lib/nado/matching";
import { mapPlace, walkMinutes, type PlaceRowLike } from "@/lib/places";
import type { Db } from "@/lib/server/api";
import { addDays, campusClock, campusInstant, formatRange, toMinutes, weekStartOf } from "@/lib/time";
import type { MemberStatus, RoomStatus } from "@/types/database";
import { applyGroupRules, confirmDeadline, settle } from "./rules";
import { buildSlots, keepAroundRealStudents, type Busy, type StudentInput } from "./snapshot";

const check = <T,>(res: { data: T; error: { message: string } | null }) => {
  if (res.error) throw new Error(res.error.message);
  return res.data;
};
const rows = <T,>(res: { data: T[] | null; error: { message: string } | null }) => check(res) ?? [];

const dayRange = (date: string) => [campusInstant(date, "00:00"), campusInstant(addDays(date, 1), "00:00")] as const;
const ACTIVE: MemberStatus[] = ["invited", "joined", "confirmed"];

// 1. Everyone's free time in the next 4 hours × their interests → activity_slots for this week
export async function writeSnapshot(sb: Db, now: Date) {
  const { date, day, minutes } = campusClock(now);
  const [from, to] = dayRange(date);
  const [interests, blocks, rooms, samples] = await Promise.all([
    sb.from("interests").select("student_id, activity").then(rows),
    sb.from("busy_blocks").select("student_id, start_time, end_time").eq("day_of_week", day).then(rows),
    sb.from("rooms").select("starts_at, ends_at, status, room_members(student_id, status)").gte("starts_at", from).lt("starts_at", to).then(rows),
    sb.from("students").select("id").eq("is_sample", true).then(rows),
  ]);
  const sample = new Set(samples.map((s) => s.id));

  const students = new Map<string, StudentInput>();
  for (const i of interests) {
    if (!students.has(i.student_id)) students.set(i.student_id, { id: i.student_id, busy: [], interests: [] });
    students.get(i.student_id)!.interests.push(i.activity);
  }
  const addBusy = (id: string, b: Busy) => students.get(id)?.busy.push(b);
  for (const b of blocks) addBusy(b.student_id, { start: toMinutes(b.start_time), end: toMinutes(b.end_time) });
  // Plans already on someone's schedule, and hours they backed out of, aren't free
  for (const r of rooms as { starts_at: string; ends_at: string | null; status: RoomStatus; room_members: { student_id: string; status: MemberStatus }[] }[]) {
    const start = campusClock(new Date(r.starts_at)).minutes;
    const end = r.ends_at ? campusClock(new Date(r.ends_at)).minutes : start + 60;
    for (const m of r.room_members) {
      if ((r.status !== "cancelled" && ACTIVE.includes(m.status)) || m.status === "cancelled") addBusy(m.student_id, { start, end });
    }
  }

  const slots = keepAroundRealStudents(buildSlots([...students.values()], day, minutes), (id) => sample.has(id));
  const week = weekStartOf(date);
  check(await sb.from("activity_slots").delete().eq("week_start", week));
  for (let i = 0; i < slots.length; i += 500) {
    check(await sb.from("activity_slots").insert(slots.slice(i, i + 500).map((s) => ({
      student_id: s.studentId, activity: s.activity, day_of_week: s.day, start_time: s.start, end_time: s.end, week_start: week,
    }))));
  }
  return slots.length;
}

// 3. Each new room: drop members whose minimum is bigger than the group, cap at the
//    activity's max, set the campus meeting spot, the activity spot and the confirm deadline.
async function shapeRooms(sb: Db, rooms: (OpenedRoom & { id: string })[], date: string, now: Date) {
  if (!rooms.length) return [];
  const ids = [...new Set(rooms.flatMap((r) => r.members))];
  const [mins, activities, places] = await Promise.all([
    sb.from("interests").select("student_id, activity, min_size").in("student_id", ids).then(rows),
    sb.from("activities").select("name, max_size, meet_place_id, dest_place_id").then(rows),
    sb.from("places").select("id, key, name").then(rows),
  ]);
  const samples = new Set(rows(await sb.from("students").select("id").eq("is_sample", true).in("id", ids)).map((s) => s.id));
  const kept = [];
  for (const r of rooms) {
    const names = new Set([r.activity, ...r.mergedFrom]);
    const minOf = (id: string) => Math.max(2, ...mins.filter((m) => m.student_id === id && names.has(m.activity)).map((m) => m.min_size));
    const info = activities.find((a) => a.name === r.activity);
    const rule = applyGroupRules({ members: r.members, minOf, max: info?.max_size ?? 6 });
    // Only sample students left: nobody real would see it, so don't keep the room
    if (rule.dissolve || rule.keep.every((id) => samples.has(id))) {
      check(await sb.from("rooms").delete().eq("id", r.id));
      continue;
    }
    if (rule.drop.length) check(await sb.from("room_members").delete().eq("room_id", r.id).in("student_id", rule.drop));
    const startsAt = campusInstant(date, r.start);
    const meet = info?.meet_place_id ?? places.find((p) => p.name === r.place)?.id ?? null;
    check(await sb.from("rooms").update({
      ends_at: campusInstant(date, r.end),
      min_size: rule.minSize,
      max_size: info?.max_size ?? 6,
      place_id: meet,
      dest_place_id: info?.dest_place_id ?? meet,
      confirm_by: new Date(confirmDeadline(new Date(startsAt).getTime(), now.getTime())).toISOString(),
    }).eq("id", r.id));
    kept.push({ id: r.id, activity: r.activity, start: r.start, end: r.end, members: rule.keep, invitation: r.invitation });
  }
  return kept;
}

// Settle, snapshot, open rooms, shape them
export async function runMatch(sb: Db, now: Date, origin: string) {
  const { date, time } = campusClock(now);
  await settleRoomsOn(sb, date, now);
  const slots = await writeSnapshot(sb, now);

  const res = await openRoomsRoute(new Request(new URL("/api/open-rooms", origin), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ now: { date, time } }),
  }));
  const body = await res.json();
  if (!res.ok) throw new Error(body?.message ?? "Opening rooms failed.");
  const { opened, skipped, filtered } = body as { opened: (OpenedRoom & { id: string })[]; skipped: Skipped[]; filtered: Filtered[] };

  const rooms = await shapeRooms(sb, opened, date, now);
  return { now: { date, time }, slots, opened: rooms, skipped, filtered };
}

// Open or dissolve a room depending on who answered (lib/match/rules.ts settle)
export async function settleRoom(sb: Db, roomId: string, now: Date) {
  const room = check(await sb
    .from("rooms")
    .select("id, activity, status, min_size, confirm_by, starts_at, ends_at, place_reason, meet:places!rooms_place_id_fkey(key, name, address, ns_street, ew_street, far, confident), dest:places!rooms_dest_place_id_fkey(key, name, address, ns_street, ew_street, far, confident), room_members(student_id, status)")
    .eq("id", roomId)
    .maybeSingle());
  if (!room) return null;
  const r = room as unknown as {
    id: string; activity: string; status: RoomStatus; min_size: number; confirm_by: string | null; starts_at: string; ends_at: string | null;
    place_reason: string | null; meet: PlaceRowLike | null; dest: PlaceRowLike | null;
    room_members: { student_id: string; status: MemberStatus }[];
  };
  const result = settle({
    status: r.status,
    minSize: r.min_size,
    confirmBy: r.confirm_by ? new Date(r.confirm_by).getTime() : null,
    now: now.getTime(),
    members: r.room_members.map((m) => ({ id: m.student_id, status: m.status })),
  });
  if (result.action === "wait") return r.status;

  if (result.decline.length) {
    check(await sb.from("room_members").update({ status: "declined", responded_at: now.toISOString() }).eq("room_id", roomId).in("student_id", result.decline));
  }
  if (result.action === "dissolve") {
    check(await sb.from("rooms").update({ status: "cancelled" }).eq("id", roomId));
    return "cancelled";
  }

  const people = r.room_members.filter((m) => m.status === "confirmed").length;
  let reason = r.place_reason;
  if (!reason && r.meet) {
    const meet = mapPlace(r.meet)!, dest = mapPlace(r.dest) ?? meet;
    const start = campusClock(new Date(r.starts_at)).minutes;
    const end = r.ends_at ? campusClock(new Date(r.ends_at)).minutes : start + 60;
    const label = check(await sb.from("activities").select("label").eq("name", r.activity).maybeSingle())?.label ?? r.activity;
    const q = {
      people, label, range: formatRange(start, end),
      meet: { name: meet.name, address: meet.address }, dest: { name: dest.name, address: dest.address },
      same: meet.key === dest.key, walkMinutes: walkMinutes(meet, dest),
    };
    reason = (await explainPlace(q).catch(() => null)) ?? fallbackPlaceReason(q);
  }
  check(await sb.from("rooms").update({ status: "confirmed", place_reason: reason }).eq("id", roomId));
  return "confirmed";
}

export async function settleRoomsOn(sb: Db, date: string, now: Date) {
  const [from, to] = dayRange(date);
  const rooms = rows(await sb.from("rooms").select("id").neq("status", "cancelled").gte("starts_at", from).lt("starts_at", to));
  for (const r of rooms) await settleRoom(sb, r.id, now);
}
