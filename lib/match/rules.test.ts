// Group-size rules and the room life cycle (no database, no Claude)
// Run: npx tsx lib/match/rules.test.ts
import { applyGroupRules, confirmDeadline, settle } from "./rules";
import { buildSlots, freeIntervals, keepAroundRealStudents } from "./snapshot";

let failed = 0;
function check(label: string, ok: boolean, detail = "") {
  console.log(`${ok ? "✅" : "❌"} ${label}${detail ? `  (${detail})` : ""}`);
  if (!ok) failed++;
}
const mins = (m: Record<string, number>) => (id: string) => m[id] ?? 2;

console.log("\n[1] Group size");
{
  const r = applyGroupRules({ members: ["a", "b", "c"], minOf: mins({ c: 4 }), max: 6 });
  check("member wanting 4+ leaves a group of 3", r.keep.join() === "a,b" && r.drop.join() === "c" && !r.dissolve);
}
{
  const r = applyGroupRules({ members: ["a", "b", "c", "d"], minOf: mins({ a: 4, b: 4, c: 4, d: 4 }), max: 6 });
  check("everyone wants 4, 4 people: all stay, min 4", r.keep.length === 4 && r.minSize === 4);
}
{
  const r = applyGroupRules({ members: ["a", "b", "c"], minOf: mins({ a: 3, b: 4, c: 4 }), max: 6 });
  check("cascade: 4s leave, then the 3 leaves too → dissolve", r.dissolve && r.keep.length === 0);
}
{
  const r = applyGroupRules({ members: ["a", "b", "c", "d", "e", "f"], minOf: mins({ f: 3 }), max: 4 });
  check("max 4 keeps the 4 smallest minimums", r.keep.length === 4 && r.drop.includes("f"));
}

console.log("\n[2] Snapshot");
{
  const free = freeIntervals([{ start: 600, end: 645 }, { start: 840, end: 915 }], 540, 1380);
  check("free time between classes", JSON.stringify(free) === JSON.stringify([{ start: 540, end: 600 }, { start: 645, end: 840 }, { start: 915, end: 1380 }]));
  const slots = buildSlots([{ id: "me", busy: [{ start: 840, end: 915 }], interests: ["boba", "ramen"] }], 1, 710);
  check("Mon 11:50: 11:50-2pm and 3:15-4:50pm, per interest", slots.length === 4 && slots[0].start === "11:50" && slots[0].end === "14:00" && slots[2].end === "16:50", slots.map((s) => `${s.activity} ${s.start}-${s.end}`).join(", "));
  check("nothing late at night", buildSlots([{ id: "me", busy: [], interests: ["boba"] }], 1, 22 * 60 + 30).length === 0);
}

{
  const slot = (studentId: string, activity: string, start: string, end: string) => ({ studentId, activity, day: 1, start, end });
  const kept = keepAroundRealStudents([
    slot("me", "boba", "12:00", "14:00"),
    slot("s1", "boba", "13:00", "16:00"), // overlaps me 1h → stays
    slot("s2", "boba", "13:30", "16:00"), // only 30 min with me → out
    slot("s3", "chess", "12:00", "14:00"), // nobody real wants chess → out
  ], (id) => id.startsWith("s"));
  check("sample slots stay only around a real student", kept.map((s) => s.studentId).join() === "me,s1", kept.map((s) => s.studentId).join());
}

console.log("\n[3] Confirm deadline");
{
  const M = 60_000, now = 0;
  check("start in 3h → 30 min before", confirmDeadline(180 * M, now) === 150 * M);
  check("start in 25 min → 15 min from now", confirmDeadline(25 * M, now) === 15 * M);
  check("start in 15 min → 5 min before", confirmDeadline(15 * M, now) === 10 * M);
}

console.log("\n[4] Room life cycle");
{
  const base = { status: "open" as const, minSize: 3, confirmBy: 1000 };
  const m = (s: string) => s.split("").map((c, i) => ({ id: `m${i}`, status: ({ i: "invited", j: "joined", c: "confirmed", x: "cancelled" } as const)[c as "i"] }));
  check("waiting while someone hasn't answered", settle({ ...base, now: 0, members: m("ccj") }).action === "wait");
  check("opens when all 3 confirmed", settle({ ...base, now: 0, members: m("ccc") }).action === "open");
  const late = settle({ ...base, now: 2000, members: m("cccj") });
  check("deadline: opens with 3, drops the one who didn't confirm", late.action === "open" && late.decline.join() === "m3");
  check("can't reach the minimum anymore → dissolve", settle({ ...base, now: 0, members: m("cjxx") }).action === "dissolve");
  check("confirmed room below minimum after a cancel → dissolve", settle({ ...base, status: "confirmed", now: 0, members: m("ccx") }).action === "dissolve");
  check("confirmed room still at minimum → stays", settle({ ...base, status: "confirmed", now: 0, members: m("cccx") }).action === "wait");
}

console.log(failed ? `\n${failed} failed` : "\nAll passed");
process.exit(failed ? 1 : 0);
