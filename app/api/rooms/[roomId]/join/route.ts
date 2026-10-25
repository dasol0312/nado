import { NextResponse } from "next/server";
import { fail, isUuid, membership } from "@/lib/server/api";
import { createClient } from "@/lib/supabase/server";

// A student says "nado!" to an invitation.
// Body: { studentId }. The first person to join gets Claude's icebreaker posted
// in the room; once two people have joined, the room is confirmed.
export async function POST(req: Request, ctx: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await ctx.params;
  const body = await req.json().catch(() => null);
  const studentId = body?.studentId;
  if (!isUuid(roomId) || !isUuid(studentId)) return fail(400, "BAD_REQUEST", "Valid roomId and studentId are required.");

  const sb = await createClient();
  try {
    const status = await membership(sb, roomId, studentId);
    if (!status) return fail(404, "NOT_INVITED", "This student was not invited to this room.");

    if (status !== "joined") {
      const joined = await sb
        .from("room_members")
        .update({ status: "joined", responded_at: new Date().toISOString() })
        .eq("room_id", roomId)
        .eq("student_id", studentId);
      if (joined.error) throw new Error(joined.error.message);
    }

    // Claude's first message (student_id null), posted once
    const claudeMessages = await sb
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("room_id", roomId)
      .is("student_id", null);
    if (claudeMessages.error) throw new Error(claudeMessages.error.message);
    if (!claudeMessages.count) {
      const room = await sb.from("rooms").select("icebreaker").eq("id", roomId).single();
      if (room.error) throw new Error(room.error.message);
      if (room.data.icebreaker) {
        const posted = await sb.from("messages").insert({ room_id: roomId, student_id: null, content: room.data.icebreaker });
        if (posted.error) throw new Error(posted.error.message);
      }
    }

    const joinedCount = await sb
      .from("room_members")
      .select("student_id", { count: "exact", head: true })
      .eq("room_id", roomId)
      .eq("status", "joined");
    if (joinedCount.error) throw new Error(joinedCount.error.message);
    if ((joinedCount.count ?? 0) >= 2) {
      const confirmed = await sb.from("rooms").update({ status: "confirmed" }).eq("id", roomId).eq("status", "open");
      if (confirmed.error) throw new Error(confirmed.error.message);
    }

    return NextResponse.json({ ok: true, joined: joinedCount.count ?? 0 });
  } catch (e) {
    return fail(500, "DB_ERROR", (e as Error).message);
  }
}
