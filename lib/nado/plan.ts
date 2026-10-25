// nado v4.1: Claude가 장소를 고르고 플랜 문구를 쓰는 부분
// 서버에서만 사용 (API 키 필요). app/api/match/route.ts 에서 호출
// Claude 호출이 실패해도 매칭은 멈추지 않는다: 장소는 카테고리별 NYU 건물, 문구는 기본 문장으로 대신함

import { askJson } from "./claude";
import {
  clip, EW_STREETS, LIMITS, NS_STREETS, PLACES_SYSTEM, PLAN_SYSTEM, placesUser, planUser,
  type PlaceChoice, type PlacesResult, type PlanResult,
} from "./prompts";

export type ActivityInfo = { activity: string; label: string; category: string; maxSize: number };
export type PlacePair = { meet: PlaceChoice; dest: PlaceChoice; byClaude: boolean };

// Claude가 실패했을 때만 쓰는 만남 장소 (DB에 미리 넣지 않음)
const building = (name: string, address: string, ns: string, ew: string): PlaceChoice =>
  ({ name, address, description: "NYU building lobby, open to students.", ns, ew, far: "", confident: true });
const KIMMEL = building("Kimmel Center lobby", "60 Washington Sq S", "Thompson St", "W 4th St");
const FALLBACK: Record<string, PlaceChoice> = {
  Sports: building("Paulson Center lobby", "181 Mercer St", "Mercer St", "Bleecker St"),
  Study: building("Bobst Library entrance", "70 Washington Sq S", "University Pl / LaGuardia Pl", "W 4th St"),
  Culture: building("Silver Center lobby", "100 Washington Sq E", "University Pl / LaGuardia Pl", "Waverly Pl"),
};
const fallbackPair = (category: string): PlacePair => {
  const meet = FALLBACK[category] ?? KIMMEL;
  return { meet, dest: meet, byClaude: false };
};

function clean(p: unknown): PlaceChoice | null {
  if (!p || typeof p !== "object") return null;
  const v = p as Record<string, unknown>;
  const name = typeof v.name === "string" ? v.name.trim().slice(0, 40) : "";
  if (!name) return null;
  const str = (x: unknown, max: number) => (typeof x === "string" ? x.trim().slice(0, max) : "");
  return {
    name,
    address: str(v.address, 120),
    description: clip(v.description, LIMITS.placeDescription) ?? "",
    ns: NS_STREETS.includes(str(v.ns, 60)) ? str(v.ns, 60) : "",
    ew: EW_STREETS.includes(str(v.ew, 60)) ? str(v.ew, 60) : "",
    far: ["N", "S", "E", "W"].includes(str(v.far, 1)) ? str(v.far, 1) : "",
    confident: v.confident === true,
  };
}

// 활동마다 만날 곳 + 활동 장소. 한 번에 한 번만 Claude를 부름
export async function choosePlaces(activities: ActivityInfo[], knownPlaces: string[]): Promise<Map<string, PlacePair>> {
  const out = new Map<string, PlacePair>();
  if (!activities.length) return out;
  const result = await askJson<PlacesResult>(PLACES_SYSTEM, placesUser(activities, knownPlaces), 4000);
  for (const a of activities) {
    const r = result?.activities?.find((x) => x.activity === a.activity);
    const meet = clean(r?.meet);
    const dest = clean(r?.dest);
    out.set(a.activity, meet ? { meet, dest: dest ?? meet, byClaude: true } : fallbackPair(a.category));
  }
  return out;
}

export type PlanInput = { plan: string; activity: string; start: string; end: string; meet: string; dest: string; people: number };
export type PlanText = { invitation: string; place_reason: string; icebreaker: string };

// 플랜마다 초대 문구 + 장소 이유 + 아이스브레이커. 많으면 15개씩 나눠서 동시에 부름
export async function writePlans(plans: PlanInput[]): Promise<Map<string, PlanText>> {
  const out = new Map<string, PlanText>();
  const chunks: PlanInput[][] = [];
  for (let i = 0; i < plans.length; i += 15) chunks.push(plans.slice(i, i + 15));
  const results = await Promise.all(chunks.map((c) => askJson<PlanResult>(PLAN_SYSTEM, planUser(c), 3000)));
  const written = results.flatMap((r) => r?.plans ?? []);
  for (const p of plans) {
    const w = written.find((x) => x.plan === p.plan);
    out.set(p.plan, {
      invitation: clip(w?.invitation, LIMITS.invitation) ?? `${cap(p.activity)} at ${shortTime(p.start)}, meet at ${p.meet}?`,
      place_reason: clip(w?.place_reason, LIMITS.placeReason) ?? (p.dest === p.meet
        ? `${p.meet} is easy to find and has room for the group.`
        : `Meet at ${p.meet} first, then walk over to ${p.dest} together.`),
      icebreaker: clip(w?.icebreaker, LIMITS.icebreaker) ?? `What got you into ${p.activity}?`,
    });
  }
  return out;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
export const shortTime = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m ? `${h12}:${String(m).padStart(2, "0")}` : `${h12}`;
};
