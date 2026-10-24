// nado: ①Claude → ②코드 → ③Claude 를 한 번에 돌리는 함수
// 서버에서만 사용 (API 키 필요). 예: app/api/open-rooms/route.ts 에서 호출
//
//   import { openRoomsWithClaude } from "@/lib/nado/claude";
//   const result = await openRoomsWithClaude({ slots, places, now, presets });
//
// Claude 호출이 실패해도 데모가 멈추지 않게, 실패하면 기본값으로 계속 진행한다.

import Anthropic from "@anthropic-ai/sdk";
import { openRooms, type Place, type Room, type Skipped, type Slot, type ActivityMap } from "./matching";
import {
  NORMALIZE_SYSTEM, normalizeUser, type NormalizeResult,
  WRITE_SYSTEM, writeUser, type WriteResult,
} from "./prompts";

const MODEL = "claude-sonnet-5-5";
// ANTHROPIC_API_KEY 환경 변수를 자동으로 읽음
// 계정에 묶인 키(workspace 지정 안 된 키)면 ANTHROPIC_WORKSPACE_ID 도 .env.local 에 넣기
export function makeClient() {
  const workspace = process.env.ANTHROPIC_WORKSPACE_ID;
  return new Anthropic(workspace ? { defaultHeaders: { "anthropic-workspace-id": workspace } } : {});
}
const client = makeClient();

export type OpenedRoom = Room & { invitation: string; icebreaker: string };
export type Filtered = { original: string; activity: string; removed: string };

export async function openRoomsWithClaude(input: {
  slots: Slot[];
  places: Place[];
  now: { day: number; time: string };
  presets: string[];
}): Promise<{ rooms: OpenedRoom[]; skipped: Skipped[]; filtered: Filtered[] }> {
  const { slots, places, now, presets } = input;

  // ① 활동 이름 정리 (오늘 슬롯의 이름만, 중복 없이)
  const names = [...new Set(slots.filter((s) => s.day === now.day).map((s) => s.activity))].sort();
  const activityMap: ActivityMap = {};
  const filtered: Filtered[] = [];
  const claudeSkipped: Skipped[] = [];

  const normalized = await askJson<NormalizeResult>(NORMALIZE_SYSTEM, normalizeUser(names, presets));
  for (const name of names) {
    const a = normalized?.activities?.find((x) => x.original === name);
    if (!a) {
      activityMap[name] = name.trim().toLowerCase(); // Claude 실패 시: 원래 이름 그대로
      continue;
    }
    activityMap[name] = a.activity;
    if (a.activity === null) claudeSkipped.push({ activity: name, reason: a.skip_reason ?? "Not allowed on nado." });
    else if (a.removed_condition) filtered.push({ original: name, activity: a.activity, removed: a.removed_condition });
  }

  // ② 시간 계산 (코드)
  const { rooms, skipped } = openRooms({ slots, places, now, activityMap });

  // ③ 초대 문구 + 아이스브레이커
  const ids = rooms.map((_, i) => `r${i + 1}`);
  const written = rooms.length
    ? await askJson<WriteResult>(
        WRITE_SYSTEM,
        writeUser(rooms.map((r, i) => ({
          room: ids[i], activity: r.activity, start: r.start, end: r.end, place: r.place, people: r.members.length,
        }))),
      )
    : null;

  const opened: OpenedRoom[] = rooms.map((r, i) => {
    const w = written?.rooms?.find((x) => x.room === ids[i]);
    // 조건을 뺀 원래 이름("boba, Koreans only")은 화면에 안 보이게 숨김
    const hidden = new Set(filtered.map((f) => f.original));
    return {
      ...r,
      mergedFrom: [...new Set(r.mergedFrom.map((n) => (hidden.has(n) ? filtered.find((f) => f.original === n)!.activity : n)))],
      invitation: w?.invitation ?? `${cap(r.activity)} at ${shortTime(r.start)} at ${r.place}, anyone?`,
      icebreaker: w?.icebreaker ?? `What got you into ${r.activity}?`,
    };
  });

  return { rooms: opened, skipped: [...claudeSkipped, ...skipped], filtered };
}

// Claude에게 묻고 JSON으로 받기. 실패하면 null
async function askJson<T>(system: string, user: string): Promise<T | null> {
  try {
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 2000,
      system,
      messages: [{ role: "user", content: user }],
    });
    const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    return parseJson<T>(text);
  } catch (e) {
    console.error("[nado] Claude call failed:", e);
    return null;
  }
}

export function parseJson<T>(text: string): T | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const shortTime = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m ? `${h12}:${String(m).padStart(2, "0")}` : `${h12}`;
};
