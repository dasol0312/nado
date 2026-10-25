import { NextResponse } from "next/server";
import { settleRoom } from "@/lib/server/rooms";
import { dbError, demoNow, fail, isUuid } from "@/lib/server/api";
import { demoOff } from "@/lib/server/demo";
import { createClient } from "@/lib/supabase/server";

// Demo "schedule change": one sample student in the group cancels.
// Body: { roomId }. Returns { nickname, roomStatus } — "cancelled" means the group dissolved.
export async function POST(req: Request) {
  const off = demoOff();
  if (off) return off;
  const body = await req.json().catch(() => null);
  const roomId = body?.roomId;
  if (!isUuid(roomId)) return fail(400, "BAD_REQUEST", "Valid roomId is required.");

  const sb = await createClient();
  try {
    const members = await sb
      .from("room_members")
      .select("student_id, students!inner(nickname, is_sample)")
      .eq("room_id", roomId)
      .in("status", ["joined", "confirmed"])
      .eq("students.is_sample", true);
    if (members.error) throw new Error(members.error.message);
    const gone = members.data.at(-1);
    if (!gone) return fail(409, "NO_SAMPLE", "No sample student left in this group to cancel.");

    const res = await sb.from("room_members")
      .update({ status: "cancelled", responded_at: new Date().toISOString() })
      .eq("room_id", roomId)
      .eq("student_id", gone.student_id);
    if (res.error) throw new Error(res.error.message);
    const roomStatus = await settleRoom(sb, roomId, await demoNow(sb));
    const nickname = (gone.students as unknown as { nickname: string }).nickname;
    return NextResponse.json({ ok: true, nickname, roomStatus });
  } catch (e) {
    return dbError(e);
  }
}
