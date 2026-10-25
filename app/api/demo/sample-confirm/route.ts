import { NextResponse } from "next/server";
import { settleRoom } from "@/lib/match/run";
import { dbError, demoNow, fail, isUuid } from "@/lib/server/api";
import { demoOff } from "@/lib/server/demo";
import { createClient } from "@/lib/supabase/server";

// Demo: one sample student in the group confirms. The Groups screen calls this every
// second or so while it waits, so the "n of m confirmed" bar fills up like real people.
// Body: { roomId }. Returns { remaining } (sample students still to confirm).
export async function POST(req: Request) {
  const off = demoOff();
  if (off) return off;
  const body = await req.json().catch(() => null);
  const roomId = body?.roomId;
  if (!isUuid(roomId)) return fail(400, "BAD_REQUEST", "Valid roomId is required.");

  const sb = await createClient();
  try {
    const waiting = await sb
      .from("room_members")
      .select("student_id, students!inner(is_sample)")
      .eq("room_id", roomId)
      .in("status", ["invited", "joined"])
      .eq("students.is_sample", true);
    if (waiting.error) throw new Error(waiting.error.message);
    const next = waiting.data[0];
    if (next) {
      const res = await sb.from("room_members")
        .update({ status: "confirmed", responded_at: new Date().toISOString() })
        .eq("room_id", roomId)
        .eq("student_id", next.student_id);
      if (res.error) throw new Error(res.error.message);
    }
    const roomStatus = await settleRoom(sb, roomId, await demoNow(sb));
    return NextResponse.json({ ok: true, remaining: Math.max(0, waiting.data.length - 1), roomStatus });
  } catch (e) {
    return dbError(e);
  }
}
