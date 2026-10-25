import "server-only";
// nado v4.1 매칭 한 번 돌리기 (1분 타이머, 열려 있는 앱, 데모 버튼이 호출)
// 한 분에 한 번만 돈다: claim_match_minute() 가 그 분의 첫 호출만 통과시킴 (force 면 건너뜀)
//
//   1. DB: build_activity_slots(지금)  → 지금부터 4시간 안 빈 시간 × 관심사
//   2. DB에서 읽기: activity_slots, 최소 인원, 실제 학생, 활동, 장소, 오늘 이미 잡힌 방
//   3. Claude: 장소가 아직 없는 활동은 만날 곳 + 활동 장소를 골라서 places 에 저장
//   4. 코드: matching.ts 로 누구끼리 몇 시에 (실제 학생이 들어간 방만)
//   5. Claude: 초대 문구, 장소 이유, 아이스브레이커
//   6. DB에 쓰기: rooms, room_members(invited) → Realtime 으로 폰에 초대 카드
//
// 샘플 학생끼리만 있는 방은 열지 않는다. 800명은 심사위원과 묶일 "캠퍼스"라서,
// 미리 자기들끼리 방에 들어가 버리면 나중에 가입한 심사위원과 묶일 사람이 없어진다.

import { openRooms, type Place, type Slot } from "@/lib/nado/matching";
import { choosePlaces, writePlans, type PlacePair } from "@/lib/nado/plan";
import { selectAll, type Db } from "@/lib/server/api";
import { addDays, campusInstant, campusToday, dayOfWeek } from "@/lib/time";

const LEAD_MINUTES = 20;      // 지금부터 최소 20분 뒤에 시작 (Nado! + confirm 할 시간)
const CONFIRM_BEFORE = 10;    // 시작 10분 전까지 confirm
const MAX_INVITES = 3;        // 한 학생이 동시에 가질 수 있는 초대(아직 안 끝난 방) 수
const LAST_END = "21:00";     // 약속은 9시~21시 안에서만 (DB build_activity_slots 와 같은 범위)

export type MatchOptions = { now?: string; dryRun?: boolean; force?: boolean };

export async function runMatch(sb: Db, opts: MatchOptions = {}) {
  // 같은 분에 이미 누가 돌렸으면 건너뜀 (타이머 + 여러 폰이 동시에 불러도 방이 겹치지 않게)
  if (!opts.force && !opts.dryRun) {
    const claim = await sb.rpc("claim_match_minute");
    if (claim.error) throw new Error(claim.error.message);
    if (claim.data !== true) return { skipped: "Already ran this minute.", rooms: [] as unknown[] };
  }
  // 1. 지금 (데모 시계 반영) + 빈 시간 계산
  let nowIso = opts.now;
  if (!nowIso) {
    const r = await sb.rpc("app_now");
    if (r.error) throw new Error(r.error.message);
    nowIso = r.data as string;
  }
  const at = new Date(nowIso);
  if (Number.isNaN(at.getTime())) throw new Error("now must be an ISO timestamp.");
  const { date, time } = campusToday(at);
  const day = dayOfWeek(date);

  const built = await sb.rpc("build_activity_slots", { p_now: at.toISOString() });
  if (built.error) throw new Error(built.error.message);

  // 2. 읽기 (1,000줄 넘는 표는 끝까지)
  const dayStart = campusInstant(date, "00:00");
  const dayEnd = campusInstant(addDays(date, 1), "00:00");
  const [slotRows, interestRows, realRows, activitiesRes, placesRes, todayRes] = await Promise.all([
    selectAll<{ student_id: string; activity: string; start_time: string; end_time: string }>((from, to) =>
      sb.from("activity_slots").select("student_id, activity, start_time, end_time").order("id").range(from, to)),
    selectAll<{ student_id: string; activity: string; min_size: number }>((from, to) =>
      sb.from("interests").select("student_id, activity, min_size").order("student_id").order("activity").range(from, to)),
    selectAll<{ id: string }>((from, to) =>
      sb.from("students").select("id").eq("is_sample", false).order("id").range(from, to)),
    sb.from("activities").select("name, label, category, max_size, meet_place_id, dest_place_id"),
    sb.from("places").select("id, key, name"),
    sb.from("rooms").select("activity, starts_at, ends_at, room_members(student_id, status)")
      .neq("status", "cancelled").gte("starts_at", dayStart).lt("starts_at", dayEnd),
  ]);
  for (const r of [activitiesRes, placesRes, todayRes]) if (r.error) throw new Error(r.error.message);
  const activities = activitiesRes.data ?? [];
  const real = new Set(realRows.map((r) => r.id));

  const summary = { now: { date, time, day }, freeSlots: built.data as number, rooms: [] as unknown[], skipped: [] as unknown[] };

  // 같은 활동 방은 하루에 하나: 오늘 이미 초대받았거나 들어간 (학생, 활동)은 뺌
  // 초대 수: 아직 안 끝난 방의 초대(invited/joined/confirmed)를 학생별로 셈 → 3개면 더 안 줌
  const taken = new Set<string>();
  const invites: Record<string, number> = {};
  type TodayRoom = { activity: string; starts_at: string; ends_at: string | null; room_members: { student_id: string; status: string }[] };
  for (const room of (todayRes.data ?? []) as TodayRoom[]) {
    const ends = room.ends_at ? new Date(room.ends_at) : new Date(new Date(room.starts_at).getTime() + 3_600_000);
    for (const m of room.room_members ?? []) {
      if (!["invited", "joined", "confirmed"].includes(m.status)) continue;
      taken.add(`${m.student_id}|${room.activity}`);
      if (ends > at) invites[m.student_id] = (invites[m.student_id] ?? 0) + 1;
    }
  }
  const minSize = new Map(interestRows.map((i) => [`${i.student_id}|${i.activity}`, i.min_size]));
  const slots: Slot[] = slotRows
    .filter((s) => !taken.has(`${s.student_id}|${s.activity}`))
    .map((s) => ({
      studentId: s.student_id,
      activity: s.activity,
      day,
      start: String(s.start_time).slice(0, 5),
      end: String(s.end_time).slice(0, 5) > LAST_END ? LAST_END : String(s.end_time).slice(0, 5),
      minSize: minSize.get(`${s.student_id}|${s.activity}`) ?? 2,
      priority: real.has(s.student_id) ? 1 : 0,
    }));

  // 실제 학생이 원하는 활동만 보면 됨. 없으면 Claude도 안 부르고 끝
  const wanted = [...new Set(slots.filter((s) => s.priority).map((s) => s.activity))].sort();
  if (!wanted.length) return summary;

  // 3. 장소: 아직 없는 활동은 Claude가 골라서 저장
  const placeById = new Map((placesRes.data ?? []).map((p) => [p.id as string, p.name as string]));
  const need = activities.filter((a) => wanted.includes(a.name) && !(a.meet_place_id && placeById.has(a.meet_place_id)));
  const chosen = await choosePlaces(
    need.map((a) => ({ activity: a.name, label: a.label, category: a.category, maxSize: a.max_size })),
    [...placeById.values()],
  );
  if (!opts.dryRun && chosen.size) await savePlaces(sb, chosen, activities, placeById);

  const where = new Map<string, { meetId: string | null; destId: string | null; meet: string; dest: string }>();
  for (const a of activities) {
    const c = chosen.get(a.name);
    if (c) {
      const fresh = activities.find((x) => x.name === a.name)!; // savePlaces filled the ids in
      where.set(a.name, { meetId: fresh.meet_place_id, destId: fresh.dest_place_id, meet: c.meet.name, dest: c.dest.name });
    } else if (a.meet_place_id && placeById.has(a.meet_place_id)) {
      const meet = placeById.get(a.meet_place_id)!;
      where.set(a.name, {
        meetId: a.meet_place_id, destId: a.dest_place_id ?? a.meet_place_id,
        meet, dest: (a.dest_place_id && placeById.get(a.dest_place_id)) || meet,
      });
    }
  }

  // 4. 누구끼리 몇 시에 (코드)
  const places: Place[] = [...where].map(([activity, w]) => ({ name: w.meet, goodFor: [activity] }));
  const { rooms, skipped } = openRooms({
    slots, places, now: { day, time }, activityMap: {},
    maxSizes: Object.fromEntries(activities.map((a) => [a.name, a.max_size])),
    leadMinutes: LEAD_MINUTES, alignToFree: true, requirePriority: true,
    maxRoomsPerStudent: MAX_INVITES, roomsAlready: invites,
  });
  summary.skipped = skipped.filter((s) => wanted.includes(s.activity));
  if (!rooms.length) return summary;

  // "Right after MATH-UA 121": 실제 학생의 수업이 방 시작 시각에 끝나면
  const realInRooms = [...new Set(rooms.flatMap((r) => r.members.filter((m) => real.has(m))))];
  const classes = await sb.from("busy_blocks").select("student_id, end_time, label")
    .eq("kind", "class").eq("day_of_week", day).in("student_id", realInRooms);
  if (classes.error) throw new Error(classes.error.message);
  const contextFor = (members: string[], start: string) => {
    const c = (classes.data ?? []).find((b) => members.includes(b.student_id) && String(b.end_time).slice(0, 5) === start);
    return c ? `Right after ${String(c.label ?? "class").split(" ").slice(0, 2).join(" ")}` : null;
  };

  // 5. 문구 (Claude)
  const ids = rooms.map((_, i) => `p${i + 1}`);
  const text = await writePlans(rooms.map((r, i) => {
    const w = where.get(r.activity);
    return { plan: ids[i], activity: r.activity, start: r.start, end: r.end,
      meet: w?.meet ?? r.place, dest: w?.dest ?? r.place, people: r.members.length };
  }));

  // 6. 저장
  for (const [i, r] of rooms.entries()) {
    const w = where.get(r.activity);
    const t = text.get(ids[i])!;
    const startsAt = campusInstant(date, r.start);
    const row = {
      activity: r.activity,
      starts_at: startsAt,
      ends_at: campusInstant(date, r.end),
      confirm_by: new Date(new Date(startsAt).getTime() - CONFIRM_BEFORE * 60_000).toISOString(),
      place_id: w?.meetId ?? null,
      dest_place_id: w?.destId ?? null,
      place_reason: t.place_reason,
      invitation: t.invitation,
      icebreaker: t.icebreaker,
      color: r.color,
      min_size: r.minSize,
      max_size: r.maxSize,
      context_label: contextFor(r.members, r.start),
      status: "open",
    };
    const plan = { ...row, members: r.members, real: r.members.filter((m) => real.has(m)), meet: w?.meet, dest: w?.dest };
    if (opts.dryRun) {
      summary.rooms.push(plan);
      continue;
    }
    const room = await sb.from("rooms").insert(row).select("id").single();
    if (room.error) {
      console.error("[match] room insert failed:", room.error);
      continue;
    }
    const members = await sb.from("room_members")
      .insert(r.members.map((student_id) => ({ room_id: room.data.id, student_id, status: "invited" })));
    if (members.error) console.error("[match] member insert failed:", members.error);
    summary.rooms.push({ id: room.data.id, ...plan });
  }
  return summary;
}

// Claude가 고른 장소를 places 에 넣고 (이름이 같으면 같은 줄) activities 에 연결
async function savePlaces(
  sb: Db,
  chosen: Map<string, PlacePair>,
  activities: { name: string; meet_place_id: string | null; dest_place_id: string | null }[],
  placeById: Map<string, string>,
) {
  const keyOf = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "place";
  const rows = new Map<string, Record<string, unknown>>();
  for (const pair of chosen.values()) {
    for (const [p, campus] of [[pair.meet, true], [pair.dest, false]] as const) {
      const key = keyOf(p.name);
      const prev = rows.get(key);
      rows.set(key, {
        key, name: p.name, address: p.address, description: p.description,
        is_campus: campus || prev?.is_campus === true,
        ns_street: p.ns || null, ew_street: p.ew || null, far: p.far, confident: p.confident,
      });
    }
  }
  const saved = await sb.from("places").upsert([...rows.values()], { onConflict: "key" }).select("id, key, name");
  if (saved.error) throw new Error(saved.error.message);
  const idOf = new Map((saved.data ?? []).map((p) => [p.key as string, p.id as string]));
  for (const p of saved.data ?? []) placeById.set(p.id, p.name);

  for (const [activity, pair] of chosen) {
    const meetId = idOf.get(keyOf(pair.meet.name)) ?? null;
    const destId = idOf.get(keyOf(pair.dest.name)) ?? meetId;
    const res = await sb.from("activities").update({ meet_place_id: meetId, dest_place_id: destId }).eq("name", activity);
    if (res.error) throw new Error(res.error.message);
    const a = activities.find((x) => x.name === activity);
    if (a) {
      a.meet_place_id = meetId;
      a.dest_place_id = destId;
    }
  }
}
