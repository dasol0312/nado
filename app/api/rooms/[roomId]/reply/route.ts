import { NextResponse } from "next/server";
import { isQuickReply, QUICK_REPLIES } from "@/lib/quick-replies";
import { dbError, fail, isUuid, membership, requireStudent } from "@/lib/server/api";
import { createClient } from "@/lib/supabase/server";

// A quick reply in the room. Body: { reply: "here" | "late" | "cant" }
// Confirmed members only, and only the fixed replies (no free-text chat).
// "Can't make it" is just a message; leaving the group is POST /api/rooms/[roomId]/cancel.
export async function POST(req: Request, ctx: { params: Promise<{ roomId: string }> }) {
  const me = await requireStudent();
  if ("error" in me) return me.error;
  const { roomId } = await ctx.params;
  const body = await req.json().catch(() => null);
  const reply = body?.reply;
  if (!isUuid(roomId)) return fail(400, "BAD_REQUEST", "Valid roomId is required.");
  if (!isQuickReply(reply)) return fail(400, "BAD_REQUEST", `reply must be one of: ${Object.keys(QUICK_REPLIES).join(", ")}.`);

  const sb = await createClient();
  try {
    if ((await membership(sb, roomId, me.studentId)) !== "confirmed") return fail(403, "NOT_CONFIRMED", "Only confirmed members can reply in this room.");
    const res = await sb.from("messages").insert({ room_id: roomId, student_id: me.studentId, content: QUICK_REPLIES[reply] });
    if (res.error) throw new Error(res.error.message);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return dbError(e);
  }
}
