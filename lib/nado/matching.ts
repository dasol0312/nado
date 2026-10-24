// nado: 방 계산 (시간 계산은 전부 코드, Claude 없음)
//
// 흐름
//   ① Claude가 활동 이름 정리 → activityMap  (prompts.ts / claude.ts)
//   ② 이 파일: 같은 활동 + 겹치는 시간 → 방(멤버, 시간, 장소, 색)
//   ③ Claude가 방마다 초대 문구 + 아이스브레이커 작성
//
// 규칙
//   - 오늘(now.day) 슬롯만 본다
//   - 지금부터 30분 뒤 이후, 정시/30분에 시작
//   - 2~6명, 최소 60분 겹침, 방은 60~120분
//   - 사람이 가장 많이 모이는 방부터 확정 (같으면 더 이른 시간)
//   - 한 학생은 시간이 겹치는 방에 하나만, 같은 활동 방은 하루에 하나만
//   - 남은 사람들로 같은 활동 방을 또 열 수 있음 (6명 넘으면 두 번째 방)

export type Slot = {
  studentId: string;
  activity: string; // 학생이 고르거나 입력한 원래 이름
  day: number;      // 0=일 1=월 ... 6=토
  start: string;    // "HH:MM"
  end: string;      // "HH:MM" (자정은 "24:00" 또는 "23:59")
};

export type Place = { name: string; goodFor: string[] };

// ①번 Claude 결과: 원래 이름 → 정리된 이름 (null = 거름)
export type ActivityMap = Record<string, string | null>;

export type Room = {
  activity: string;
  mergedFrom: string[]; // 이 방에 묶인 원래 이름들 (예: ["boba", "bubble tea"])
  day: number;
  start: string;
  end: string;
  place: string;
  members: string[];    // studentId
  color: string;
};

export type Skipped = { activity: string; reason: string };

export const ROOM_COLORS = ["#FF8A3D", "#3D8BFF", "#2BB673", "#A55BFF", "#FF4F8B", "#F5B700"];

const MIN_PEOPLE = 2;
const MAX_PEOPLE = 6;
const MIN_MINUTES = 60;
const MAX_MINUTES = 120;
const LEAD_MINUTES = 30;
const STEP = 30;

export const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
export const toHHMM = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

type Interval = { from: number; to: number };

export function openRooms(input: {
  slots: Slot[];
  places: Place[];
  now: { day: number; time: string };
  activityMap: ActivityMap;
}): { rooms: Room[]; skipped: Skipped[] } {
  const { slots, places, now, activityMap } = input;

  // 지금 + 30분을 30분 단위로 올림
  const earliest = Math.ceil((toMin(now.time) + LEAD_MINUTES) / STEP) * STEP;

  // 정리된 활동 → 학생별 가능한 시간 (earliest 이전은 잘라냄)
  const byActivity = new Map<string, Map<string, Interval[]>>();
  const originals = new Map<string, Map<string, string>>(); // activity → studentId → 원래 이름
  const seenToday = new Map<string, Set<string>>();          // 오늘 슬롯이 있는 학생 (skipped 사유용)

  for (const s of slots) {
    if (s.day !== now.day) continue;
    const activity = activityMap[s.activity] ?? (s.activity in activityMap ? null : s.activity.trim().toLowerCase());
    if (!activity) continue; // ①번에서 거른 활동

    if (!seenToday.has(activity)) seenToday.set(activity, new Set());
    seenToday.get(activity)!.add(s.studentId);

    const from = Math.max(toMin(s.start), earliest);
    const to = Math.min(toMin(s.end) === 23 * 60 + 59 ? 24 * 60 : toMin(s.end), 24 * 60);
    if (to - from < MIN_MINUTES) continue;

    if (!byActivity.has(activity)) byActivity.set(activity, new Map());
    const students = byActivity.get(activity)!;
    if (!students.has(s.studentId)) students.set(s.studentId, []);
    students.get(s.studentId)!.push({ from, to });

    if (!originals.has(activity)) originals.set(activity, new Map());
    originals.get(activity)!.set(s.studentId, s.activity);
  }

  const busy = new Map<string, Interval[]>(); // 이미 방에 들어간 학생의 시간
  const isFree = (id: string, from: number, to: number) =>
    !(busy.get(id) ?? []).some((b) => b.from < to && from < b.to);

  type Candidate = { activity: string; start: number; end: number; members: string[] };

  // 한 활동에서 지금 열 수 있는 가장 좋은 방
  function bestFor(activity: string): Candidate | null {
    const students = byActivity.get(activity)!;
    let best: Candidate | null = null;

    for (let start = earliest; start + MIN_MINUTES <= 24 * 60; start += STEP) {
      const fits: { id: string; until: number }[] = [];
      for (const [id, intervals] of students) {
        const iv = intervals.find((i) => i.from <= start && i.to >= start + MIN_MINUTES);
        if (iv && isFree(id, start, start + MIN_MINUTES)) fits.push({ id, until: iv.to });
      }
      if (fits.length < MIN_PEOPLE) continue;

      // 6명 넘으면 오래 있을 수 있는 사람 우선, 그다음 id 순 (항상 같은 결과)
      fits.sort((a, b) => b.until - a.until || a.id.localeCompare(b.id));
      const chosen = fits.slice(0, MAX_PEOPLE);

      // 끝 시간: 최대 120분, 모두가 있을 수 있고, 다른 방이랑 안 겹치게
      let end = Math.min(start + MAX_MINUTES, ...chosen.map((c) => c.until));
      for (const c of chosen) {
        for (const b of busy.get(c.id) ?? []) if (b.from >= start + MIN_MINUTES) end = Math.min(end, b.from);
      }
      end = Math.floor(end / STEP) * STEP;

      if (!best || chosen.length > best.members.length) {
        best = { activity, start, end, members: chosen.map((c) => c.id).sort() };
      }
    }
    return best;
  }

  const rooms: Omit<Room, "color">[] = [];

  // 가장 큰 방부터 하나씩 확정
  while (true) {
    let pick: Candidate | null = null;
    for (const activity of [...byActivity.keys()].sort()) {
      const c = bestFor(activity);
      if (!c) continue;
      if (
        !pick ||
        c.members.length > pick.members.length ||
        (c.members.length === pick.members.length && c.start < pick.start)
      ) pick = c;
    }
    if (!pick) break;

    for (const id of pick.members) {
      if (!busy.has(id)) busy.set(id, []);
      busy.get(id)!.push({ from: pick.start, to: pick.end });
    }
    // 같은 활동 방은 하루에 하나만: 방에 들어간 학생은 이 활동 후보에서 빠짐
    const pool = byActivity.get(pick.activity)!;
    for (const id of pick.members) pool.delete(id);
    const names = originals.get(pick.activity)!;
    rooms.push({
      activity: pick.activity,
      mergedFrom: [...new Set(pick.members.map((id) => names.get(id)!))].sort(),
      day: now.day,
      start: toHHMM(pick.start),
      end: toHHMM(pick.end),
      place: pickPlace(pick.activity, places),
      members: pick.members,
    });
  }

  // 시작 시간 순으로 정렬하고 색 배정
  rooms.sort((a, b) => a.start.localeCompare(b.start) || a.activity.localeCompare(b.activity));
  const colored: Room[] = rooms.map((r, i) => ({ ...r, color: ROOM_COLORS[i % ROOM_COLORS.length] }));

  // 방이 하나도 안 열린 활동
  const opened = new Set(rooms.map((r) => r.activity));
  const skipped: Skipped[] = [...seenToday.keys()]
    .filter((a) => !opened.has(a))
    .sort()
    .map((activity) => {
      const total = seenToday.get(activity)!.size;
      const stillFree = byActivity.get(activity)?.size ?? 0;
      const reason =
        total < MIN_PEOPLE
          ? `Only 1 student wants this today.`
          : stillFree < MIN_PEOPLE
            ? `Not enough students free after ${toHHMM(earliest)}.`
            : `No ${MIN_MINUTES}-minute overlap between students.`;
      return { activity, reason };
    });

  return { rooms: colored, skipped };
}

function pickPlace(activity: string, places: Place[]): string {
  // 그 활동 전용에 가까운 곳 우선: good_for에서 앞에 있을수록, 목록이 짧을수록
  const matches = places
    .filter((p) => p.goodFor.includes(activity))
    .sort((a, b) => a.goodFor.indexOf(activity) - b.goodFor.indexOf(activity) || a.goodFor.length - b.goodFor.length);
  return (matches[0] ?? places[0]).name; // 맞는 곳 없으면 목록 첫 번째 (가장 일반적인 장소를 맨 앞에)
}
