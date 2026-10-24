// 진짜 Claude로 ① 활동 이름 정리 → ② 계산 → ③ 문구 작성까지 돌려보기
// 실행: npx tsx --env-file=.env.local lib/nado/try-claude.ts
// (.env.local 에 ANTHROPIC_API_KEY=... 가 있어야 함)

import { makeClient, openRoomsWithClaude } from "./claude";
import { NAMES, PLACES, SLOTS } from "./sample-data";
import type { Slot } from "./matching";

const key = process.env.ANTHROPIC_API_KEY;
if (!key) {
  console.log("❌ ANTHROPIC_API_KEY 가 없어요. 이 폴더의 .env.local 에 넣었는지, 실행할 때 --env-file=.env.local 을 붙였는지 확인해줘.");
  process.exit(1);
}

async function main() {
  // 0. 키가 작동하는지 먼저 짧게 확인
  try {
    await makeClient().messages.create({
      model: "claude-sonnet-5-5",
      max_tokens: 5,
      messages: [{ role: "user", content: "Say hi" }],
    });
    console.log("✅ API 키 작동해요\n");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e: any) {
    console.log(`❌ API 호출 실패 (${e?.status ?? "no status"}): ${e?.message ?? e}`);
    if (e?.status === 401) console.log("   → 키가 틀렸거나 API 키가 아니에요. platform.claude.com > API Keys 에서 새로 만들어줘.");
    if (e?.status === 400 && /credit/i.test(e?.message ?? "")) console.log("   → 크레딧이 없어요. Billing 에서 크레딧을 넣어줘.");
    if (/valid workspace ID/i.test(e?.message ?? "")) console.log("   → ANTHROPIC_WORKSPACE_ID 값이 틀렸어요. wrkspc_ 로 시작하는 ID를 그대로 복사했는지 확인해줘.");
    else if (/workspace/i.test(e?.message ?? "")) console.log("   → 키는 맞아요! .env.local 에 ANTHROPIC_WORKSPACE_ID=wrkspc_... 를 추가해줘 (platform.claude.com > Settings > Workspaces 에서 확인)");
    process.exit(1);
  }

  // 일부러 까다로운 활동 이름 추가 (일요일 14~17시)
  const extra: Slot[] = [
    { studentId: "t_korean", activity: "boba, Koreans only", day: 0, start: "14:00", end: "17:00" },
    { studentId: "t_date1", activity: "date night", day: 0, start: "14:00", end: "17:00" },
    { studentId: "t_date2", activity: "date night", day: 0, start: "14:00", end: "17:00" },
    { studentId: "t_coffee1", activity: "coffee", day: 0, start: "14:00", end: "17:00" },
    { studentId: "t_hoops", activity: "hoops", day: 0, start: "14:00", end: "16:00" },
  ];

  const result = await openRoomsWithClaude({
    slots: [...SLOTS, ...extra],
    places: PLACES,
    now: { day: 0, time: "10:30" }, // 일요일 10:30 (심사 시간)
    presets: ["boba", "basketball", "hiking", "musicals", "baseball", "board games", "karaoke", "coffee", "study"],
  });

  const who = (ids: string[]) => ids.map((id) => NAMES[id] ?? id).join(", ");

  console.log("🏠 열린 방");
  for (const r of result.rooms) {
    console.log(`\n  ${r.color}  ${r.activity}  ${r.start}-${r.end}  @ ${r.place}`);
    console.log(`  묶인 이름: ${r.mergedFrom.join(", ")}`);
    console.log(`  멤버: ${who(r.members)}`);
    console.log(`  초대: ${r.invitation}`);
    console.log(`  첫 메시지: ${r.icebreaker}`);
  }
  console.log("\n🧹 조건 제거 (filtered)");
  for (const f of result.filtered) console.log(`  "${f.original}" → ${f.activity}  (뺀 것: ${f.removed})`);
  console.log("\n⏭️  안 열린 활동 (skipped)");
  for (const s of result.skipped) console.log(`  ${s.activity}: ${s.reason}`);

  console.log(`
  ✔ 확인할 것
    - boba 방에 Aisha(bubble tea)랑 t_korean 이 들어가서 6명인지
    - filtered 에 "Koreans only" 가 빠졌다고 나오는지
    - skipped 에 date night 가 있는지 (방이 열리면 안 됨)
    - coffee 가 boba 랑 안 합쳐졌는지
    - hoops 가 basketball 로 정리됐는지 (혼자라 skipped 에 basketball 로 나오면 정상)`);
}

main();
