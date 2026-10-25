import FindFlow from "@/components/find/FindFlow";
import { requireMe } from "@/lib/server/page";

export default async function FindPage({ params }: { params: Promise<{ roomId: string }> }) {
  await requireMe();
  const { roomId } = await params;
  return (
    <main className="screen">
      <FindFlow roomId={roomId} />
    </main>
  );
}
