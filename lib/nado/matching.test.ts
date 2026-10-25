// nado 방 계산 테스트 (Claude 없이, ①번 결과는 직접 넣어서)
// 실행: npx tsx lib/nado/matching.test.ts

import { openRooms, type ActivityMap, type Slot } from "./matching";
import { NAMES, PLACES, SLOTS } from "./sample-data";

let failed = 0;
function check(label: string, ok: boolean, detail = "") {
  console.log(`${ok ? "✅" : "❌"} ${label}${detail ? `  (${detail})` : ""}`);
  if (!ok) failed++;
}
const names = (ids: string[]) => ids.map((id) => NAMES[id] ?? id).sort();

// ①번 Claude가 돌려줬다고 가정한 결과
const MAP: ActivityMap = { "bubble tea": "boba", "pickup basketball": "basketball" };

// 1. 데모 장면: 일요일 10:30 ------------------------------------------------------
{
  console.log("\n[1] Sunday 10:30 (judging time)");
  const { rooms, skipped } = openRooms({ slots: SLOTS, places: PLACES, now: { day: 0, time: "10:30" }, activityMap: MAP });
  for (const r of rooms) console.log(`   ${r.color} ${r.activity} ${r.start}-${r.end} @ ${r.place}: ${names(r.members).join(", ")}  [${r.mergedFrom}]`);
  for (const s of skipped) console.log(`   skipped ${s.activity}: ${s.reason}`);

  const boba = rooms.find((r) => r.activity === "boba");
  check("boba 15:00-16:00, 5 students", boba?.start === "15:00" && boba?.end === "16:00" && boba?.members.length === 5);
  check("bubble tea merged into boba", !!boba?.mergedFrom.includes("bubble tea"));
  const hike = rooms.find((r) => r.activity === "hiking");
  check("hiking 11:00-12:00, Noah + Emma (no Carlos)",
    hike?.start === "11:00" && hike?.end === "12:00" && names(hike!.members).join() === "Emma Johansson,Noah Fischer");
  check("baseball starts 12:00 at Main Quad", rooms.find((r) => r.activity === "baseball")?.start === "12:00"
    && rooms.find((r) => r.activity === "baseball")?.place === "Main Quad fountain");
  check("musicals starts 13:00 at theater", rooms.find((r) => r.activity === "musicals")?.start === "13:00"
    && rooms.find((r) => r.activity === "musicals")?.place === "Campus Theater box office");
  check("skipped: board games + photography",
    skipped.map((s) => s.activity).sort().join() === "board games,photography");
  check("colors in start-time order", rooms.map((r) => r.color).join() === "#FF8A3D,#3D8BFF,#2BB673,#A55BFF");
}

// 2. 같은 입력이면 항상 같은 결과 ------------------------------------------------------
{
  const a = JSON.stringify(openRooms({ slots: SLOTS, places: PLACES, now: { day: 0, time: "10:30" }, activityMap: MAP }));
  const b = JSON.stringify(openRooms({ slots: [...SLOTS].reverse(), places: PLACES, now: { day: 0, time: "10:30" }, activityMap: MAP }));
  console.log("\n[2] Deterministic");
  check("same result even if slot order changes", a === b);
}

// 3. 차별 조건이 붙은 활동 (①번에서 boba로 정리됨) ------------------------------------
{
  console.log("\n[3] 'boba, Koreans only' cleaned to boba");
  const slots: Slot[] = [...SLOTS, { studentId: "test", activity: "boba, Koreans only", day: 0, start: "14:00", end: "17:00" }];
  const { rooms } = openRooms({ slots, places: PLACES, now: { day: 0, time: "10:30" },
    activityMap: { ...MAP, "boba, Koreans only": "boba" } });
  const boba = rooms.find((r) => r.activity === "boba")!;
  check("test user joins boba room, now 6 students", boba.members.includes("test") && boba.members.length === 6);
}

// 4. 7명 이상이면 6명 방 + 남은 사람으로 다음 방 --------------------------------------------
{
  console.log("\n[4] 8 students want boba at the same time");
  const slots: Slot[] = Array.from({ length: 8 }, (_, i) => ({
    studentId: `b${i + 1}`, activity: "boba", day: 2, start: "15:00", end: i < 6 ? "18:00" : "17:00",
  }));
  const { rooms } = openRooms({ slots, places: PLACES, now: { day: 2, time: "12:00" }, activityMap: {} });
  for (const r of rooms) console.log(`   ${r.activity} ${r.start}-${r.end}: ${r.members.join(", ")}`);
  check("first room has 6 ('nobody twice' checked below)", rooms[0]?.members.length === 6);
  check("the other 2 get a second room", rooms.length === 2 && rooms[1].members.length === 2);
  check("nobody in both rooms", new Set(rooms.flatMap((r) => r.members)).size === 8);
}

// 5. 한 학생이 두 활동에서 시간이 겹칠 때 --------------------------------------------------
{
  console.log("\n[5] Same student wants boba and basketball at the same time");
  const slots: Slot[] = [
    { studentId: "x", activity: "boba", day: 3, start: "15:00", end: "17:00" },
    { studentId: "x", activity: "basketball", day: 3, start: "15:00", end: "17:00" },
    { studentId: "a1", activity: "boba", day: 3, start: "15:00", end: "17:00" },
    { studentId: "a2", activity: "boba", day: 3, start: "15:00", end: "17:00" },
    { studentId: "c1", activity: "basketball", day: 3, start: "15:00", end: "17:00" },
  ];
  const { rooms, skipped } = openRooms({ slots, places: PLACES, now: { day: 3, time: "12:00" }, activityMap: {} });
  for (const r of rooms) console.log(`   ${r.activity} ${r.start}-${r.end}: ${r.members.join(", ")}`);
  for (const s of skipped) console.log(`   skipped ${s.activity}: ${s.reason}`);
  check("x goes to the bigger room (boba, 3 people)", rooms.length === 1 && rooms[0].activity === "boba" && rooms[0].members.includes("x"));
  check("basketball skipped (only c1 left)", skipped.some((s) => s.activity === "basketball"));
}

// 6. Claude가 거른 활동 (null) ---------------------------------------------------------------
{
  console.log("\n[6] Activity filtered by Claude (date night → null)");
  const slots: Slot[] = [
    { studentId: "d1", activity: "date night", day: 5, start: "19:00", end: "22:00" },
    { studentId: "d2", activity: "date night", day: 5, start: "19:00", end: "22:00" },
  ];
  const { rooms } = openRooms({ slots, places: PLACES, now: { day: 5, time: "12:00" }, activityMap: { "date night": null } });
  check("no room opened", rooms.length === 0);
}

// 7. 다른 요일, 밤 늦게 ------------------------------------------------------------------
{
  console.log("\n[7] Monday 18:00 (basketball night)");
  const { rooms } = openRooms({ slots: SLOTS, places: PLACES, now: { day: 1, time: "18:00" }, activityMap: MAP });
  for (const r of rooms) console.log(`   ${r.activity} ${r.start}-${r.end} @ ${r.place}: ${names(r.members).join(", ")}`);
  const bb = rooms.find((r) => r.activity === "basketball");
  check("basketball at Rec Center courts, 21:00-22:00 (Jamal, Kenji, Ethan overlap)",
    bb?.place === "Rec Center courts" && bb?.start === "21:00" && bb?.members.length === 3, bb ? `${bb.start}-${bb.end}` : "none");
  check("rooms never start before now + 30min", rooms.every((r) => r.start >= "18:30"));
}

// 8. 각자 원하는 최소 인원 ---------------------------------------------------------
{
  console.log("\n[8] per-student minimum group size");
  const base = { activity: "board games", day: 2, start: "15:00", end: "18:00" };
  const slots: Slot[] = [
    { ...base, studentId: "m1", minSize: 2 },
    { ...base, studentId: "m2", minSize: 2 },
    { ...base, studentId: "m3", minSize: 4 }, // only wants 4+
  ];
  const { rooms } = openRooms({ slots, places: PLACES, now: { day: 2, time: "12:00" }, activityMap: {} });
  check("3 people: the one who wants 4+ is left out", rooms.length === 1 && rooms[0].members.join() === "m1,m2");
  const four = openRooms({ slots: [...slots, { ...base, studentId: "m4", minSize: 3 }], places: PLACES,
    now: { day: 2, time: "12:00" }, activityMap: {} }).rooms;
  check("4 people: everyone fits, room minSize = 4", four[0]?.members.length === 4 && four[0]?.minSize === 4);
}

// 9. 활동별 최대 인원 + 실제 학생 우선 -------------------------------------------------
{
  console.log("\n[9] activity max size, real students first");
  const slots: Slot[] = Array.from({ length: 6 }, (_, i) => ({
    studentId: `s${i + 1}`, activity: "boba", day: 2, start: "15:00", end: "18:00",
  }));
  slots.push({ studentId: "zz_judge", activity: "boba", day: 2, start: "15:00", end: "16:00", priority: 1 });
  const { rooms } = openRooms({ slots, places: PLACES, now: { day: 2, time: "12:00" }, activityMap: {},
    maxSizes: { boba: 4 } });
  check("boba rooms hold at most 4", rooms.every((r) => r.members.length <= 4 && r.maxSize === 4));
  check("the judge gets a seat in the first room", rooms[0]?.members.includes("zz_judge"));
}

// 9b. 샘플끼리만 있는 방은 안 연다 (실제 학생과 묶일 사람을 남겨둠) --------------------------
{
  console.log("\n[9b] requirePriority keeps the sample pool for real students");
  const samples: Slot[] = Array.from({ length: 10 }, (_, i) => ({
    studentId: `s${i + 1}`, activity: i < 5 ? "boba" : "coffee", day: 2, start: "15:00", end: "18:00",
  }));
  const none = openRooms({ slots: samples, places: PLACES, now: { day: 2, time: "12:00" }, activityMap: {},
    requirePriority: true }).rooms;
  check("only samples: no rooms", none.length === 0);
  const judge: Slot = { studentId: "judge", activity: "coffee", day: 2, start: "16:00", end: "17:30", priority: 1 };
  const some = openRooms({ slots: [...samples, judge], places: PLACES, now: { day: 2, time: "12:00" }, activityMap: {},
    maxSizes: { coffee: 4 }, requirePriority: true }).rooms;
  check("one room, with the judge, at the judge's time",
    some.length === 1 && some[0].members.includes("judge") && some[0].start === "16:00" && some[0].members.length === 4);
}

// 10. 수업 끝나자마자 시작 ------------------------------------------------------------
{
  console.log("\n[10] start right when class ends (3:15)");
  const slots: Slot[] = [
    { studentId: "c1", activity: "boba", day: 1, start: "15:15", end: "17:00" },
    { studentId: "c2", activity: "boba", day: 1, start: "15:15", end: "17:00" },
    { studentId: "c3", activity: "boba", day: 1, start: "14:00", end: "17:00" },
  ];
  const aligned = openRooms({ slots, places: PLACES, now: { day: 1, time: "14:50" }, activityMap: {},
    leadMinutes: 20, alignToFree: true }).rooms;
  check("opens at 15:15 with all 3", aligned[0]?.start === "15:15" && aligned[0]?.members.length === 3,
    aligned[0] ? `${aligned[0].start}-${aligned[0].end}` : "none");
  check("ends on a clean time, at least 60 min", aligned[0]?.end === "17:00");
  const old = openRooms({ slots, places: PLACES, now: { day: 1, time: "14:50" }, activityMap: {} }).rooms;
  check("without alignToFree it waits for 15:30", old[0]?.start === "15:30");
}

console.log(failed ? `\n${failed} check(s) failed` : "\nAll checks passed 🎉");
process.exit(failed ? 1 : 0);
