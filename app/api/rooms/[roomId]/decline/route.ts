import { NextResponse } from "next/server";
import { fail, isUuid, membership } from "@/lib/server/api";
import { createClient } from "@/lib/supabase/server";

// "Not this time" on an invitation. Body: { studentId }
export async function POST(req: Request, ctx: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await ctx.params;
  const body = await req.json().catch(() => null);
  const studentId = body?.studentId;
  if (!isUuid(roomId) || !isUuid(studentId)) return fail(400, "BAD_REQUEST", "Valid roomId and studentId are required.");

  const sb = await createClient();
  try {
    const status = await membership(sb, roomId, studentId);
    if (!status) return fail(404, "NOT_INVITED", "This student was not invited to this room.");
    if (status === "joined") return fail(409, "ALREADY_JOINED", "Use the Can't make it reply inside the room instead.");

    const res = await sb
      .from("room_members")
      .update({ status: "declined", responded_at: new Date().toISOString() })
      .eq("room_id", roomId)
      .eq("student_id", studentId);
    if (res.error) throw new Error(res.error.message);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(500, "DB_ERROR", (e as Error).message);
  }
}
