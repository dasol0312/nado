"use client";

// Groups I said nado to, plus groups that dissolved. When everyone confirms, go straight in.
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { planRange, whenLabel } from "@/lib/plan-text";
import { useApp } from "../shell/AppProvider";
import { Mascot } from "../shell/icons";
import GroupCard from "./GroupCard";

export default function GroupsView() {
  const { now, plans, plansReady, toast, runMatch } = useApp();
  const router = useRouter();
  const active = plans.filter((p) => p.status !== "cancelled" && (p.myStatus === "joined" || p.myStatus === "confirmed"));
  const past = plans.filter((p) => p.status === "cancelled" && p.myStatus !== "declined" && p.myStatus !== "invited").slice(-3).reverse();

  // A group that just opened → into the room
  const before = useRef<Map<string, string> | null>(null);
  useEffect(() => {
    if (!plansReady) return;
    const prev = before.current;
    before.current = new Map(plans.map((p) => [p.id, p.status]));
    if (!prev) return;
    const opened = plans.find((p) => p.status === "confirmed" && p.myStatus === "confirmed" && prev.get(p.id) === "open");
    if (opened) {
      toast("Everyone confirmed. You’re in, and it’s on your schedule");
      router.push(`/rooms/${opened.id}`);
      // That hour is on my schedule now; look again for the rest of the next 4 hours
      runMatch({ title: "A plan fits the next few hours", quietIfNone: true });
    }
  }, [plans, plansReady, router, toast, runMatch]);

  return (
    <>
      <h1>Groups</h1>
      {active.length ? active.map((p) => <GroupCard key={p.id} plan={p} />) : (
        <div className="empty">
          <Mascot width={72} style={{ margin: "0 auto 8px" }} />
          You haven’t joined a group yet.<br />Tap <b>Nado!</b> on a match and it shows up here.
        </div>
      )}
      {past.length > 0 && (
        <>
          <div className="section-h"><h2>Past groups</h2></div>
          {past.map((p) => (
            <article key={p.id} className="card rec" style={{ opacity: 0.75 }}>
              <div className="top">
                <span>{whenLabel(p, now)}</span>
                <span className="mono time">{planRange(p)}</span>
                <span className="pill bad">Dissolved</span>
              </div>
              <div className="kw">{p.activity}<small>fell below the minimum</small></div>
              <p className="small muted">That hour went back into the matching pool.</p>
            </article>
          ))}
        </>
      )}
    </>
  );
}
