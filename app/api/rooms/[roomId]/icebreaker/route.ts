import { NextResponse } from "next/server";
import { nextIcebreaker } from "@/lib/ai";
import { questionsFor } from "@/lib/catalog";
import { dbError, fail, isUuid, requireStudent } from "@/lib/server/api";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 30;

// "Another question" after the group found each other. Body: { previous }
// Claude writes a new one about the activity; without Claude, the next one from the bank.
export async function POST(req: Request, ctx: { params: Promise<{ roomId: string }> }) {
  const me = await requireStudent();
  if ("error" in me) return me.error;
  const { roomId } = await ctx.params;
  if (!isUuid(roomId)) return fail(400, "BAD_REQUEST", "Valid roomId is required.");
  const body = await req.json().catch(() => null);
  const previous = typeof body?.previous === "string" ? body.previous.slice(0, 200) : "";

  const sb = await createClient();
  try {
    const room = await sb.from("rooms").select("activity, room_members(status)").eq("id", roomId).maybeSingle();
    if (room.error) throw new Error(room.error.message);
    if (!room.data) return fail(404, "NO_ROOM", "That group doesn't exist.");
    const act = await sb.from("activities").select("label, category").eq("name", room.data.activity).maybeSingle();
    if (act.error) throw new Error(act.error.message);
    const info = act.data;

    const people = room.data.room_members.filter((m) => m.status === "confirmed").length;
    const ai = await nextIcebreaker({ people, label: info?.label ?? room.data.activity, previous }).catch(() => null);
    if (ai) return NextResponse.json({ question: ai.slice(0, 160), byAI: true });
    const bank = questionsFor(room.data.activity, info?.category);
    return NextResponse.json({ question: bank[(bank.indexOf(previous) + 1) % bank.length], byAI: false });
  } catch (e) {
    return dbError(e);
  }
}
