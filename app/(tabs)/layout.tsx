import AutoMatch from "@/components/matches/AutoMatch";
import TabBar from "@/components/shell/TabBar";
import { requireMe } from "@/lib/server/page";

// Profile / Matches / Groups share the bottom tab bar. Matching runs in the background here.
export default async function TabsLayout({ children }: { children: React.ReactNode }) {
  await requireMe();
  return (
    <>
      <main className="screen">{children}</main>
      <TabBar />
      <AutoMatch />
    </>
  );
}
