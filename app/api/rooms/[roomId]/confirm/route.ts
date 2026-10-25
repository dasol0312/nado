import { changeMyStatus } from "@/lib/server/rooms";

// "Confirm and join the room". When everyone in the group has confirmed (or the deadline
// passes with enough people), the room opens and the hour goes on everyone's schedule.
export async function POST(_req: Request, ctx: { params: Promise<{ roomId: string }> }) {
  return changeMyStatus(ctx, ["invited", "joined"], "confirmed", undefined, true);
}
