import { NextResponse } from "next/server";
import { dbError, fail, requireStudent } from "@/lib/server/api";
import { createClient } from "@/lib/supabase/server";

// Replace my interests. Body: { interests: [{ activity, min }] }
// min = the smallest group I'd enjoy (at least 2, at most the activity's max).
export async function PUT(req: Request) {
  const me = await requireStudent();
  if ("error" in me) return me.error;
  const body = await req.json().catch(() => null);
  const list: unknown = body?.interests;
  if (!Array.isArray(list) || list.length > 30) return fail(400, "BAD_REQUEST", "interests must be a list.");

  const sb = await createClient();
  try {
    const names = list.map((i) => (typeof i?.activity === "string" ? i.activity : ""));
    const known = await sb.from("activities").select("name, max_size").in("name", names);
    if (known.error) throw new Error(known.error.message);
    const max = new Map(known.data.map((a) => [a.name, a.max_size as number]));
    const rows = [];
    for (const i of list as { activity: string; min: number }[]) {
      if (!max.has(i.activity)) return fail(400, "UNKNOWN_ACTIVITY", `Add "${i.activity}" as an interest first.`);
      if (!Number.isInteger(i.min) || i.min < 2 || i.min > max.get(i.activity)!) {
        return fail(400, "BAD_MIN", `Minimum for ${i.activity} must be 2 to ${max.get(i.activity)}.`);
      }
      rows.push({ student_id: me.studentId, activity: i.activity, min_size: i.min });
    }

    const removed = await sb.from("interests").delete().eq("student_id", me.studentId);
    if (removed.error) throw new Error(removed.error.message);
    if (rows.length) {
      const added = await sb.from("interests").insert(rows);
      if (added.error) throw new Error(added.error.message);
    }
    return NextResponse.json({ ok: true, interests: rows.length });
  } catch (e) {
    return dbError(e);
  }
}
