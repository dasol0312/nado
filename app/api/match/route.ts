import { NextResponse } from "next/server";
import { runMatch } from "@/lib/match/run";
import { demoNow, fail, requireStudent } from "@/lib/server/api";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
// Claude makes two calls inside /api/open-rooms; give them time.
export const maxDuration = 60;

// Find plans starting in the next 4 hours (on the demo clock).
// "Check again now", the demo clock, and rematching after a group dissolves all call this.
// 1. snapshot: free time × interests → activity_slots   (lib/match/snapshot.ts)
// 2. Yerin's /api/open-rooms opens rooms with Claude    (unchanged)
// 3. group-size rules + meeting spots + confirm deadline (lib/match/rules.ts)
export async function POST(req: Request) {
  const me = await requireStudent();
  if ("error" in me) return me.error;
  const sb = await createClient();
  try {
    const result = await runMatch(sb, await demoNow(sb), new URL(req.url).origin);
    return NextResponse.json({ ...result, mine: result.opened.filter((r) => r.members.includes(me.studentId)).map((r) => r.id) });
  } catch (e) {
    console.error("[match]", e);
    return fail(500, "MATCH_FAILED", (e as Error).message);
  }
}
