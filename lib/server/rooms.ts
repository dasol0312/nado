import "server-only";
import { NextResponse } from "next/server";
import { settleRoom } from "@/lib/match/run";
import type { MemberStatus } from "@/types/database";
import { createClient } from "@/lib/supabase/server";
import { dbError, demoNow, fail, isUuid, membership, requireStudent } from "./api";

// Shared shape of the room actions: signed-in member, allowed current status → new status,
// then settle the room (open or dissolve it) on the demo clock.
export async function changeMyStatus(
  ctx: { params: Promise<{ roomId: string }> },
  from: MemberStatus[],
  to: MemberStatus,
  after?: (sb: Awaited<ReturnType<typeof createClient>>, roomId: string) => Promise<void>,
) {
  const me = await requireStudent();
  if ("error" in me) return me.error;
  const { roomId } = await ctx.params;
  if (!isUuid(roomId)) return fail(400, "BAD_REQUEST", "Valid roomId is required.");

  const sb = await createClient();
  try {
    const now = await demoNow(sb);
    const status = await membership(sb, roomId, me.studentId);
    if (!status) return fail(404, "NOT_INVITED", "You're not in this group.");
    if (status !== to) {
      if (!from.includes(status)) return fail(409, "WRONG_STEP", `You can't do that now (you're ${status}).`);
      const res = await sb
        .from("room_members")
        .update({ status: to, responded_at: now.toISOString() })
        .eq("room_id", roomId)
        .eq("student_id", me.studentId);
      if (res.error) throw new Error(res.error.message);
    }
    await after?.(sb, roomId);
    const roomStatus = await settleRoom(sb, roomId, now);
    return NextResponse.json({ ok: true, status: to, roomStatus });
  } catch (e) {
    return dbError(e);
  }
}
