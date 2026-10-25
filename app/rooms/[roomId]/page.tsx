import RoomView from "@/components/room/RoomView";
import { requireMe } from "@/lib/server/page";

export default async function RoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  await requireMe();
  const { roomId } = await params;
  return (
    <main className="screen">
      <RoomView roomId={roomId} />
    </main>
  );
}
