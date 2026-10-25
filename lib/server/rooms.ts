import "server-only";
import { NextResponse } from "next/server";
import { settle } from "@/lib/match/rules";
import { createClient } from "@/lib/supabase/server";
import type { MemberStatus, RoomStatus } from "@/types/database";
import { dbError, demoNow, fail, isUuid, membership, requireStudent, type Db } from "./api";

// Open or dissolve a room depending on who answered (lib/match/rules.ts settle).
// Matching (lib/server/match.ts) already wrote the place, reason and icebreaker.
export async function settleRoom(sb: Db, roomId: string, now: Date): Promise<RoomStatus | null> {
  const res = await sb.from("rooms").select("status, min_size, confirm_by, room_members(student_id, status)").eq("id", roomId).maybeSingle();
  if (res.error) throw new Error(res.error.message);
  if (!res.data) return null;
  const r = res.data as unknown as { status: RoomStatus; min_size: number; confirm_by: string | null; room_members: { student_id: string; status: MemberStatus }[] };
  const result = settle({
    status: r.status,
    minSize: r.min_size,
    confirmBy: r.confirm_by ? new Date(r.confirm_by).getTime() : null,
    now: now.getTime(),
    members: r.room_members.map((m) => ({ id: m.student_id, status: m.status })),
  });
  if (result.action === "wait") return r.status;
  if (result.decline.length) {
    const d = await sb.from("room_members").update({ status: "declined", responded_at: now.toISOString() }).eq("room_id", roomId).in("student_id", result.decline);
    if (d.error) throw new Error(d.error.message);
  }
  const status: RoomStatus = result.action === "open" ? "confirmed" : "cancelled";
  const u = await sb.from("rooms").update({ status }).eq("id", roomId);
  if (u.error) throw new Error(u.error.message);
  return status;
}

// Shared shape of the room actions: signed-in member, allowed current status → new status,
// then settle the room (open or dissolve it) on the demo clock.
export async function changeMyStatus(
  ctx: { params: Promise<{ roomId: string }> },
  from: MemberStatus[],
  to: MemberStatus,
  after?: (sb: Db, roomId: string) => Promise<void>,
  needsOpenPlan = false, // Nado!/Confirm: the plan must still be open and not started
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
    // A retry of something that already went through is fine (e.g. a double tap on Confirm)
    if (status === to) return NextResponse.json({ ok: true, status: to, roomStatus: await settleRoom(sb, roomId, now) });
    const room = await sb.from("rooms").select("status, starts_at, confirm_by").eq("id", roomId).single();
    if (room.error) throw new Error(room.error.message);
    const started = new Date(room.data.starts_at).getTime() <= now.getTime();
    const pastDeadline = !!room.data.confirm_by && new Date(room.data.confirm_by).getTime() <= now.getTime();
    if (room.data.status === "cancelled" || (needsOpenPlan && (room.data.status !== "open" || started || pastDeadline))) {
      if (pastDeadline && room.data.status === "open") await settleRoom(sb, roomId, now); // close it out now
      return fail(409, "PLAN_CLOSED", "This plan isn’t open anymore.");
    }
    if (!from.includes(status)) return fail(409, "WRONG_STEP", `You can't do that now (you're ${status}).`);
    // Only if my status is still what we just read (two taps, or the deadline, may race this)
    const res = await sb
      .from("room_members")
      .update({ status: to, responded_at: now.toISOString() })
      .eq("room_id", roomId)
      .eq("student_id", me.studentId)
      .eq("status", status)
      .select("student_id");
    if (res.error) throw new Error(res.error.message);
    if (!res.data.length) return fail(409, "WRONG_STEP", "That changed just now. Try again.");
    await after?.(sb, roomId);
    const roomStatus = await settleRoom(sb, roomId, now);
    return NextResponse.json({ ok: true, status: to, roomStatus });
  } catch (e) {
    return dbError(e);
  }
}
