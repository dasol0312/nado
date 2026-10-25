import { NextResponse } from "next/server";
import { dbError, fail, requireStudent } from "@/lib/server/api";
import { createClient } from "@/lib/supabase/server";
import { toMinutes } from "@/lib/time";

const TIME = /^([01]\d|2[0-3]):[0-5]\d$|^24:00$/;
const KINDS = new Set(["class", "fixed", "never"]);
type Block = { kind: string; day: number; start: string; end: string; label?: string | null };

// Replace my busy hours. Body: { blocks: [{ kind: "class"|"fixed"|"never", day: 0-6, start, end, label? }] }
// Everything not listed between 9 AM and 9 PM counts as free.
export async function PUT(req: Request) {
  const me = await requireStudent();
  if ("error" in me) return me.error;
  const body = await req.json().catch(() => null);
  const blocks: unknown = body?.blocks;
  if (!Array.isArray(blocks) || blocks.length > 7 * 24) return fail(400, "BAD_REQUEST", "blocks must be a list.");
  for (const b of blocks as Block[]) {
    const ok = b && KINDS.has(b.kind) && Number.isInteger(b.day) && b.day >= 0 && b.day <= 6 &&
      typeof b.start === "string" && TIME.test(b.start) && typeof b.end === "string" && TIME.test(b.end) &&
      toMinutes(b.end) > toMinutes(b.start) && !(b.end === "24:00" && b.start >= "23:59") && (b.label == null || (typeof b.label === "string" && b.label.length <= 80));
    if (!ok) return fail(400, "BAD_REQUEST", "Each block needs kind, day 0-6 and start < end (HH:MM).");
  }

  // Add the new blocks first, then remove the old ones, so a failed save never wipes the schedule
  const sb = await createClient();
  try {
    const old = await sb.from("busy_blocks").select("id").eq("student_id", me.studentId);
    if (old.error) throw new Error(old.error.message);
    if (blocks.length) {
      const added = await sb.from("busy_blocks").insert((blocks as Block[]).map((b) => ({
        student_id: me.studentId, kind: b.kind, day_of_week: b.day,
        start_time: b.start, end_time: b.end === "24:00" ? "23:59" : b.end, label: b.label ?? null,
      })));
      if (added.error) throw new Error(added.error.message);
    }
    const oldIds = (old.data ?? []).map((b) => b.id as string);
    if (oldIds.length) {
      const removed = await sb.from("busy_blocks").delete().in("id", oldIds);
      if (removed.error) throw new Error(removed.error.message);
    }
    return NextResponse.json({ ok: true, blocks: blocks.length });
  } catch (e) {
    return dbError(e);
  }
}
