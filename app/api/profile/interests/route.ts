import { NextResponse } from "next/server";
import { dbError, fail, requireStudent } from "@/lib/server/api";
import { MAX_INTERESTS } from "@/lib/catalog";
import { createClient } from "@/lib/supabase/server";
import { parseInterestList } from "@/lib/validate";

// Replace my interests. Body: { interests: [{ activity, min }] }
// min = the smallest group I'd enjoy (at least 2, at most the activity's max). At most MAX_INTERESTS (3).
// Saves new rows first, then removes the rest, so a failed save never wipes the old interests.
export async function PUT(req: Request) {
  const me = await requireStudent();
  if ("error" in me) return me.error;
  const body = await req.json().catch(() => null);

  const sb = await createClient();
  try {
    // Over the limit is OK only while trimming down (older profiles may have more than 3)
    let cap = MAX_INTERESTS;
    if (Array.isArray(body?.interests) && body.interests.length > MAX_INTERESTS) {
      const now = await sb.from("interests").select("activity", { count: "exact", head: true }).eq("student_id", me.studentId);
      if (now.error) throw new Error(now.error.message);
      cap = Math.max(MAX_INTERESTS, (now.count ?? 0) - 1);
    }
    const parsed = parseInterestList(body?.interests, cap);
    if (!parsed.ok) return fail(400, /up to/.test(parsed.message) ? "TOO_MANY" : "BAD_REQUEST", parsed.message);

    const names = parsed.rows.map((r) => r.activity);
    const known = names.length ? await sb.from("activities").select("name, max_size").in("name", names) : { data: [], error: null };
    if (known.error) throw new Error(known.error.message);
    const max = new Map((known.data ?? []).map((a) => [a.name as string, a.max_size as number]));
    for (const i of parsed.rows) {
      if (!max.has(i.activity)) return fail(400, "UNKNOWN_ACTIVITY", `Add "${i.activity}" as an interest first.`);
      if (i.min < 2 || i.min > max.get(i.activity)!) return fail(400, "BAD_MIN", `Minimum for ${i.activity} must be 2 to ${max.get(i.activity)}.`);
    }

    if (parsed.rows.length) {
      const saved = await sb.from("interests").upsert(
        parsed.rows.map((i) => ({ student_id: me.studentId, activity: i.activity, min_size: i.min })),
        { onConflict: "student_id,activity" },
      );
      if (saved.error) throw new Error(saved.error.message);
    }
    let stale = sb.from("interests").delete().eq("student_id", me.studentId);
    if (names.length) stale = stale.not("activity", "in", `(${names.map((n) => `"${n.replace(/["\\]/g, "\\$&")}"`).join(",")})`);
    const removed = await stale;
    if (removed.error) throw new Error(removed.error.message);
    return NextResponse.json({ ok: true, interests: parsed.rows.length });
  } catch (e) {
    return dbError(e);
  }
}
