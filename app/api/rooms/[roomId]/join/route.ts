import { changeMyStatus } from "@/lib/server/rooms";

// "Nado!" on a plan. The group then confirms; the room opens once everyone has.
// Demo: sample students in the group say nado at the same moment (they confirm one by one
// through /api/demo/sample-confirm).
export async function POST(_req: Request, ctx: { params: Promise<{ roomId: string }> }) {
  return changeMyStatus(ctx, ["invited"], "joined", async (sb, roomId) => {
    const samples = await sb.from("students").select("id").eq("is_sample", true);
    if (samples.error) throw new Error(samples.error.message);
    const res = await sb
      .from("room_members")
      .update({ status: "joined", responded_at: new Date().toISOString() })
      .eq("room_id", roomId)
      .eq("status", "invited")
      .in("student_id", samples.data.map((s) => s.id));
    if (res.error) throw new Error(res.error.message);
  });
}
