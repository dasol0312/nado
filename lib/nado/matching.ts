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
//
// 옵션 (안 넘기면 위 규칙 그대로)
//   - Slot.minSize: 그 학생이 원하는 최소 인원. 방 인원이 이보다 적으면 그 학생은 안 넣음
//   - Slot.priority: 클수록 먼저 자리 줌 (실제 학생 > 샘플 학생)
//   - maxSizes: 활동별 최대 인원 (activities.max_size). 없으면 6
//   - leadMinutes: 지금부터 최소 몇 분 뒤에 시작할지 (기본 30)
//   - alignToFree: 정시/30분 말고도, 누군가의 빈 시간이 시작되는 순간(= 수업 끝)에도 시작
//   - requirePriority: 우선순위 있는 학생(실제 학생)이 들어간 방만 연다.
//     샘플 학생끼리만 방을 만들어 버리면, 나중에 가입한 실제 학생과 묶일 사람이 남지 않기 때문
//   우선순위 학생이 있는 방을 크기보다 먼저 확정한다 (우선순위가 없으면 차이 없음)

export type Slot = {
  studentId: string;
  activity: string; // 학생이 고르거나 입력한 원래 이름
  day: number;      // 0=일 1=월 ... 6=토
  start: string;    // "HH:MM"
  end: string;      // "HH:MM" (자정은 "24:00" 또는 "23:59")
  minSize?: number; // 이 학생이 원하는 최소 인원 (기본 2)
  priority?: number; // 클수록 먼저 (기본 0)
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
  minSize: number;      // 멤버들이 원한 최소 인원 중 가장 큰 값 (confirm이 이보다 적으면 방 해산)
  maxSize: number;      // 이 활동의 최대 인원
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
  maxSizes?: Record<string, number>;
  leadMinutes?: number;
  alignToFree?: boolean;
  requirePriority?: boolean;
  maxRoomsPerStudent?: number;          // 한 학생이 동시에 받을 수 있는 초대 수
  roomsAlready?: Record<string, number>; // 학생별로 이미 받은(아직 안 끝난) 초대 수
}): { rooms: Room[]; skipped: Skipped[] } {
  const {
    slots, places, now, activityMap,
    maxSizes = {}, leadMinutes = LEAD_MINUTES, alignToFree = false, requirePriority = false,
    maxRoomsPerStudent = Infinity, roomsAlready = {},
  } = input;
  const roomCount = new Map(Object.entries(roomsAlready));
  const hasRoomLeft = (id: string) => (roomCount.get(id) ?? 0) < maxRoomsPerStudent;

  // 지금 + lead (alignToFree면 그 시각부터, 아니면 30분 단위로 올림)
  const soonest = toMin(now.time) + leadMinutes;
  const earliest = alignToFree ? soonest : Math.ceil(soonest / STEP) * STEP;
  const gridStart = Math.ceil(soonest / STEP) * STEP;
  const minSizeOf = new Map<string, number>(); // "activity|studentId" → 최소 인원
  const priorityOf = new Map<string, number>();

  // 정리된 활동 → 학생별 가능한 시간 (earliest 이전은 잘라냄)
  const byActivity = new Map<string, Map<string, Interval[]>>();
  const freeStarts = new Map<string, Set<number>>(); // activity → 빈 시간이 시작되는 순간들 (수업 끝 등)
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
    minSizeOf.set(`${activity}|${s.studentId}`, Math.max(MIN_PEOPLE, s.minSize ?? MIN_PEOPLE));
    priorityOf.set(s.studentId, Math.max(priorityOf.get(s.studentId) ?? 0, s.priority ?? 0));
    if (alignToFree && toMin(s.start) >= earliest) {
      if (!freeStarts.has(activity)) freeStarts.set(activity, new Set());
      freeStarts.get(activity)!.add(toMin(s.start));
    }

    if (!originals.has(activity)) originals.set(activity, new Map());
    originals.get(activity)!.set(s.studentId, s.activity);
  }

  const busy = new Map<string, Interval[]>(); // 이미 방에 들어간 학생의 시간
  const isFree = (id: string, from: number, to: number) =>
    !(busy.get(id) ?? []).some((b) => b.from < to && from < b.to);

  type Candidate = { activity: string; start: number; end: number; members: string[]; minSize: number; pri: number };
  // 더 좋은 후보: 우선순위 학생이 있는 방 → 더 큰 방 → (같으면 먼저 본 것 = 더 이른 시간)
  const better = (c: Candidate, than: Candidate | null) =>
    !than || c.pri > than.pri || (c.pri === than.pri && c.members.length > than.members.length);
  type Fit = { id: string; until: number; min: number; pri: number };

  // 모두의 최소 인원을 만족하는 가장 큰 그룹 (최대 maxPeople명)
  function pickGroup(fits: Fit[], maxPeople: number): Fit[] | null {
    for (let k = Math.min(fits.length, maxPeople); k >= MIN_PEOPLE; k--) {
      const ok = fits.filter((f) => f.min <= k);
      if (ok.length >= k) return ok.slice(0, k);
    }
    return null;
  }

  // 한 활동에서 지금 열 수 있는 가장 좋은 방
  function bestFor(activity: string): Candidate | null {
    const students = byActivity.get(activity)!;
    const maxPeople = Math.max(MIN_PEOPLE, maxSizes[activity] ?? MAX_PEOPLE);
    let best: Candidate | null = null;

    // 시작 후보: 정시/30분 + (alignToFree면) 빈 시간이 시작되는 순간
    const starts = new Set<number>();
    for (let t = alignToFree ? gridStart : earliest; t + MIN_MINUTES <= 24 * 60; t += STEP) starts.add(t);
    for (const t of freeStarts.get(activity) ?? []) if (t + MIN_MINUTES <= 24 * 60) starts.add(t);

    for (const start of [...starts].sort((a, b) => a - b)) {
      const fits: Fit[] = [];
      for (const [id, intervals] of students) {
        const iv = intervals.find((i) => i.from <= start && i.to >= start + MIN_MINUTES);
        if (iv && isFree(id, start, start + MIN_MINUTES) && hasRoomLeft(id)) {
          fits.push({ id, until: iv.to, min: minSizeOf.get(`${activity}|${id}`) ?? MIN_PEOPLE, pri: priorityOf.get(id) ?? 0 });
        }
      }
      if (fits.length < MIN_PEOPLE) continue;

      // 자리가 모자라면: 우선순위 높은 사람 → 오래 있을 수 있는 사람 → id 순 (항상 같은 결과)
      fits.sort((a, b) => b.pri - a.pri || b.until - a.until || a.id.localeCompare(b.id));
      if (requirePriority && fits[0].pri <= 0) continue;
      const chosen = pickGroup(fits, maxPeople);
      if (!chosen) continue;
      const pri = Math.max(...chosen.map((c) => c.pri));
      if (requirePriority && pri <= 0) continue;

      // 끝 시간: 최대 120분, 모두가 있을 수 있고, 다른 방이랑 안 겹치게
      let end = Math.min(start + MAX_MINUTES, ...chosen.map((c) => c.until));
      for (const c of chosen) {
        for (const b of busy.get(c.id) ?? []) if (b.from >= start + MIN_MINUTES) end = Math.min(end, b.from);
      }
      end = Math.max(start + MIN_MINUTES, Math.floor(end / STEP) * STEP);

      const candidate: Candidate = {
        activity, start, end,
        members: chosen.map((c) => c.id).sort(),
        minSize: Math.max(MIN_PEOPLE, ...chosen.map((c) => c.min)),
        pri,
      };
      if (better(candidate, best)) best = candidate;
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
      if (better(c, pick) || (pick && c.pri === pick.pri && c.members.length === pick.members.length && c.start < pick.start)) {
        pick = c;
      }
    }
    if (!pick) break;

    for (const id of pick.members) {
      roomCount.set(id, (roomCount.get(id) ?? 0) + 1);
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
      minSize: pick.minSize,
      maxSize: Math.max(MIN_PEOPLE, maxSizes[pick.activity] ?? MAX_PEOPLE),
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
  return (matches[0] ?? places[0])?.name ?? ""; // 맞는 곳 없으면 목록 첫 번째 (가장 일반적인 장소를 맨 앞에)
}
