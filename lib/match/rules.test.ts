// Room life cycle: when a plan opens or dissolves (no database, no Claude)
// Run: npx tsx lib/match/rules.test.ts
import { settle } from "./rules";

let failed = 0;
function check(label: string, ok: boolean, detail = "") {
  console.log(`${ok ? "✅" : "❌"} ${label}${detail ? `  (${detail})` : ""}`);
  if (!ok) failed++;
}

console.log("\n[1] Room life cycle");
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
