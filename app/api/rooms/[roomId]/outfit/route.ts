import { NextResponse } from "next/server";
import { dbError, fail, isUuid, membership, requireStudent } from "@/lib/server/api";
import { createClient } from "@/lib/supabase/server";

type Ctx = { params: Promise<{ roomId: string }> };
const field = (v: unknown) => typeof v === "string" && v.length > 0 && v.length <= 40;

// 30 minutes before: what I'm wearing, shown to my group as hints.
// Body: { outfit: { color, top, shoes, hair } }. DELETE removes it after we've met.
export async function PUT(req: Request, ctx: Ctx) {
  const body = await req.json().catch(() => null);
  const o = body?.outfit;
  if (!o || ![o.color, o.top, o.shoes, o.hair].every(field)) return fail(400, "BAD_REQUEST", "outfit needs color, top, shoes and hair.");
  return save(ctx, { color: o.color, top: o.top, shoes: o.shoes, hair: o.hair });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  return save(ctx, null);
}

async function save(ctx: Ctx, outfit: Record<string, string> | null) {
  const me = await requireStudent();
  if ("error" in me) return me.error;
  const { roomId } = await ctx.params;
  if (!isUuid(roomId)) return fail(400, "BAD_REQUEST", "Valid roomId is required.");
  const sb = await createClient();
  try {
    if ((await membership(sb, roomId, me.studentId)) !== "confirmed") return fail(403, "NOT_CONFIRMED", "Only confirmed members share hints.");
    const res = await sb.from("room_members").update({ outfit }).eq("room_id", roomId).eq("student_id", me.studentId);
    if (res.error) throw new Error(res.error.message);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return dbError(e);
  }
}
