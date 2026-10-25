"use client";

// The room after everyone confirmed: where to meet (map + AI reason), who's coming,
// the 30-minute reminder, and the demo "one member cancels" button.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { mapPlace, walkMinutes } from "@/lib/places";
import { planRange, whenLabel } from "@/lib/plan-text";
import { useApp } from "../shell/AppProvider";
import { BackIcon } from "../shell/icons";
import CampusMap from "./CampusMap";
import MemberChips from "./MemberChips";
import QuickReplies from "./QuickReplies";

const THINKING = [
  "Looking at NYU buildings around Washington Square",
  "Checking which spots fit this activity and group size",
  "Preferring indoor, easy-to-find meeting points",
  "Estimating the walk to where the activity happens",
];

export default function RoomView({ roomId }: { roomId: string }) {
  const { now, plans, plansReady, activities, act, toast, runMatch } = useApp();
  const router = useRouter();
  const plan = plans.find((p) => p.id === roomId);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);

  // The "finding the best spot" steps play once per room on this phone
  useEffect(() => {
    if (!plan || plan.status !== "confirmed") return;
    let seen = false;
    try {
      seen = sessionStorage.getItem(`nado:place:${roomId}`) === "1";
      sessionStorage.setItem(`nado:place:${roomId}`, "1");
    } catch {}
    if (seen) {
      const t = setTimeout(() => setStep(THINKING.length), 0);
      return () => clearTimeout(t);
    }
    const t = setInterval(() => setStep((s) => Math.min(THINKING.length, s + 1)), 580);
    return () => clearInterval(t);
  }, [plan?.status, roomId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!plansReady) return <div className="empty"><span className="spinner" /></div>;
  if (!plan || plan.status === "cancelled" || plan.myStatus === "cancelled" || plan.myStatus === "declined") {
    return (
      <>
        <div className="backbar"><Link href="/groups" className="link" style={{ display: "flex", alignItems: "center", gap: 2, textDecoration: "none" }}><BackIcon />Groups</Link></div>
        <div className="empty">This group isn’t open anymore.</div>
      </>
    );
  }
  if (plan.status !== "confirmed") {
    return (
      <>
        <div className="backbar"><Link href="/groups" className="link" style={{ display: "flex", alignItems: "center", gap: 2, textDecoration: "none" }}><BackIcon />Groups</Link></div>
        <div className="empty">The room opens once everyone confirms.</div>
      </>
    );
  }

  const info = activities.find((a) => a.name === plan.activity);
  const meet = mapPlace(plan.meet), dest = mapPlace(plan.dest) ?? meet;
  const same = !dest || meet?.key === dest.key;
  const ready = step >= THINKING.length;

  async function cancel(path: string, mine: boolean) {
    setBusy(true);
    try {
      const res = await act(path, mine ? undefined : { roomId });
      if (res.roomStatus === "cancelled") {
        toast(`${mine ? "You left" : `${res.nickname} cancelled`}. Below the minimum, so the room dissolved. Rematching that hour`);
        router.push("/groups");
        setTimeout(() => runMatch({ title: "Rematched: a new team for the same hour" }), 1800);
      } else {
        toast(mine ? "You left the group" : `${res.nickname} cancelled. Still ${plan!.members.length - 1} (min ${plan!.minSize})`);
        if (mine) router.push("/groups");
      }
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="backbar"><Link href="/groups" className="link" style={{ display: "flex", alignItems: "center", gap: 2, textDecoration: "none" }}><BackIcon />Groups</Link></div>
      <div className="stack" style={{ gap: 6 }}>
        <div className="row"><span className="pill good">Confirmed</span><span className="small muted">{whenLabel(plan, now)} · <span className="mono">{planRange(plan)}</span></span></div>
        <h1>{plan.activity} <span className="muted" style={{ fontSize: 18, fontWeight: 600 }}>{info?.label}</span></h1>
        <p className="small muted">{plan.members.length} people · min {plan.minSize} · max {plan.maxSize} (set by AI)</p>
        <p className="small row" style={{ gap: 6 }}><span className="sw c-confirmed" />On your schedule · no other matches for this hour <Link className="link" href="/profile">See schedule</Link></p>
      </div>

      <div className="card stack" style={{ gap: 12 }}>
        <div className="between"><h3>Where to meet</h3><span className="pill">On campus · AI pick</span></div>
        {!ready ? (
          <div className="aibox">
            <span className="spinner" style={{ color: "var(--accent)" }} />
            <div className="stack" style={{ gap: 6 }}>
              <b>Finding the best spot on campus…</b>
              {THINKING.map((t, i) => (
                <div key={t} className="small" style={{ opacity: i <= step ? 1 : 0.35 }}>{i < step ? "✓" : i === step ? "•" : "·"} {t}</div>
              ))}
            </div>
          </div>
        ) : (
          <>
            {meet && <CampusMap meet={meet} dest={dest} />}
            {plan.placeReason && <div className="aibox"><span className="ai">AI</span><div>{plan.placeReason}</div></div>}
            <div className="route">
              <span className="dotm" />
              <div><b>{plan.meet?.name ?? "Campus"}</b><div className="small muted">{plan.meet?.address} · find each other here</div></div>
              {!same && dest && meet && (
                <>
                  <span className="line" /><span />
                  <span className="doto" />
                  <div>
                    <b>{dest.name}</b>
                    <div className="small muted">{dest.address} · {dest.far ? "a longer walk, head there together" : `about ${walkMinutes(meet, dest)} min, walk over together`}</div>
                    {dest.suggested && <div className="small" style={{ color: "var(--amber)" }}>Suggested by Claude{dest.sure ? "" : " as a general spot"} · check it’s open before you go</div>}
                  </div>
                </>
              )}
            </div>
            <p className="small muted">The AI picks a campus spot for this group and activity: indoors, easy to find, and covered by campus security.</p>
          </>
        )}
      </div>

      <div className="card stack" style={{ gap: 10 }}>
        <h3>Group</h3>
        <MemberChips members={plan.members} />
        <p className="small muted">Nobody can see anyone’s profile. When you meet, the AI gives you hints to find each other.</p>
      </div>

      <QuickReplies roomId={roomId} members={plan.members} />

      <Link className="btn block" href={`/rooms/${roomId}/find`}>Get the 30-minute reminder (demo: start now)</Link>
      <button className="btn ghost sm" disabled={busy} onClick={() => cancel(`/api/rooms/${roomId}/cancel`, true)}>I can’t make it</button>
      <div className="demo-act">
        <span className="eyebrow">Demo · schedule change</span>
        <p className="small muted">If cancellations drop the group below {plan.minSize} people, the room dissolves and everyone left goes back into matching for that hour.</p>
        <button className="btn ghost sm" disabled={busy} onClick={() => cancel("/api/demo/cancel-member", false)}>One member cancels</button>
      </div>
    </>
  );
}
