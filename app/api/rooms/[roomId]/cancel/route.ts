import { changeMyStatus } from "@/lib/server/rooms";

// I can't make it. If that drops the group below its minimum, the room dissolves
// (roomStatus "cancelled") and the client re-runs /api/match to rematch that hour.
export async function POST(_req: Request, ctx: { params: Promise<{ roomId: string }> }) {
  return changeMyStatus(ctx, ["invited", "joined", "confirmed"], "cancelled");
}
