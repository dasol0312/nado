// Room life cycle: when a plan opens or dissolves (no database, no Claude)
// Run: npx tsx lib/match/rules.test.ts
import { settle, subtractBusy } from "./rules";

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

console.log("\n[2] Someone who left a plan stays out of that hour");
{
  const h = (x: number) => x * 60;
  const same = (a: { from: number; to: number }[], b: number[][]) => JSON.stringify(a.map((p) => [p.from, p.to])) === JSON.stringify(b);
  check("no busy → unchanged", same(subtractBusy(h(12), h(16), []), [[h(12), h(16)]]));
  check("left 1–2pm → 12–1 and 2–4", same(subtractBusy(h(12), h(16), [{ from: h(13), to: h(14) }]), [[h(12), h(13)], [h(14), h(16)]]));
  check("pieces under 60 min are dropped", same(subtractBusy(h(12), h(14), [{ from: h(12) + 30, to: h(13) + 30 }]), []));
  check("busy covering everything → nothing", same(subtractBusy(h(12), h(13), [{ from: h(11), to: h(15) }]), []));
  check("busy outside → unchanged", same(subtractBusy(h(12), h(13), [{ from: h(9), to: h(10) }]), [[h(12), h(13)]]));
}

console.log(failed ? `\n${failed} failed` : "\nAll passed");
process.exit(failed ? 1 : 0);
