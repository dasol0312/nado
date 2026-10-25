import { changeMyStatus } from "@/lib/server/rooms";

// "Nado!" on a plan. The group then confirms; the room opens once everyone has.
// Demo: sample students in the group say nado at the same moment (they confirm one by one
// through /api/demo/sample-confirm).
export async function POST(_req: Request, ctx: { params: Promise<{ roomId: string }> }) {
  return changeMyStatus(ctx, ["invited"], "joined", async (sb, roomId) => {
    // Only this room's members (a list of all 800 sample ids would overflow the request URL)
    const waiting = await sb
      .from("room_members")
      .select("student_id, students!inner(is_sample)")
      .eq("room_id", roomId)
      .eq("status", "invited")
      .eq("students.is_sample", true);
    if (waiting.error) throw new Error(waiting.error.message);
    if (!waiting.data.length) return;
    const res = await sb
      .from("room_members")
      .update({ status: "joined", responded_at: new Date().toISOString() })
      .eq("room_id", roomId)
      .in("student_id", waiting.data.map((m) => m.student_id));
    if (res.error) throw new Error(res.error.message);
  }, true);
}
