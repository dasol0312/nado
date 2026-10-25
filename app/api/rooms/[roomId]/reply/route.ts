import { NextResponse } from "next/server";
import { isQuickReply, QUICK_REPLIES } from "@/lib/quick-replies";
import { fail, isUuid, membership } from "@/lib/server/api";
import { createClient } from "@/lib/supabase/server";

// A quick reply in the room. Body: { studentId, reply: "here" | "late" | "cant" }
// Only students who said nado can reply, and only with the fixed replies.
export async function POST(req: Request, ctx: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await ctx.params;
  const body = await req.json().catch(() => null);
  const studentId = body?.studentId;
  const reply = body?.reply;
  if (!isUuid(roomId) || !isUuid(studentId)) return fail(400, "BAD_REQUEST", "Valid roomId and studentId are required.");
  if (!isQuickReply(reply)) return fail(400, "BAD_REQUEST", `reply must be one of: ${Object.keys(QUICK_REPLIES).join(", ")}.`);

  const sb = await createClient();
  try {
    const status = await membership(sb, roomId, studentId);
    if (status !== "joined") return fail(403, "NOT_JOINED", "Say nado! before replying in this room.");

    const res = await sb.from("messages").insert({ room_id: roomId, student_id: studentId, content: QUICK_REPLIES[reply] });
    if (res.error) throw new Error(res.error.message);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(500, "DB_ERROR", (e as Error).message);
  }
}
