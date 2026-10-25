"use client";

// One group I said nado to: confirm progress, then "Enter room" once everyone confirmed
import Link from "next/link";
import { useEffect, useState } from "react";
import { planRange, whenLabel } from "@/lib/plan-text";
import { formatMinutes, campusClock } from "@/lib/time";
import { confirmedCount, useApp, type Plan } from "../shell/AppProvider";

export default function GroupCard({ plan }: { plan: Plan }) {
  const { now, activities, act, toast, reloadPlans } = useApp();
  const info = activities.find((a) => a.name === plan.activity);
  const size = plan.members.length;
  const done = confirmedCount(plan);
  const waitingSamples = plan.status === "open" && plan.members.some((m) => m.isSample && m.status !== "confirmed");

  // Right after Nado!: "AI is forming the team" for 1.5 s, then the confirm step
  const [forming, setForming] = useState(false);
  useEffect(() => {
    let joinedAt = 0;
    try {
      joinedAt = Number(sessionStorage.getItem(`nado:joinedAt:${plan.id}`) ?? 0);
    } catch {}
    const left = joinedAt + 1500 - Date.now();
    if (left <= 0) return;
    const on = setTimeout(() => setForming(true), 0);
    const off = setTimeout(() => setForming(false), left);
    return () => {
      clearTimeout(on);
      clearTimeout(off);
    };
  }, [plan.id]);

  // Demo: sample students confirm one by one (0.9 s, then every 0.65 s) while this card is on screen
  useEffect(() => {
    if (!waitingSamples || forming) return;
    const t = setTimeout(() => {
      act("/api/demo/sample-confirm", { roomId: plan.id }).catch(() => {});
    }, done === 0 ? 900 : 650);
    return () => clearTimeout(t);
  }, [waitingSamples, forming, done, plan.id, act]);

  async function confirm() {
    try {
      await act(`/api/rooms/${plan.id}/confirm`);
      await reloadPlans();
    } catch (e) {
      toast((e as Error).message);
    }
  }

  const deadline = plan.confirmBy ? formatMinutes(campusClock(new Date(plan.confirmBy)).minutes) : null;
  return (
    <article className="card rec">
      <div className="top">
        <span>{whenLabel(plan, now)}</span>
        <span className="mono time">{planRange(plan)}</span>
        {plan.status === "confirmed"
          ? <span className="pill good">Room open</span>
          : forming ? <span className="pill amber">AI is forming the team</span>
          : <span className="pill amber">Waiting to confirm</span>}
      </div>
      <div className="kw">{plan.activity}<small>{info?.label ?? plan.activity} · {size} people</small></div>
      {plan.status === "open" && forming ? (
        <div className="aibox"><span className="spinner" style={{ color: "var(--accent)" }} /><div>The AI is forming a team of {plan.minSize} to {plan.maxSize} people.</div></div>
      ) : plan.status === "open" ? (
        <div className="stack">
          <div className="between small"><span>{done} of {size} confirmed</span>{deadline && <span className="muted">Confirm by {deadline}</span>}</div>
          <div className="progress"><i style={{ width: `${(done / size) * 100}%` }} /></div>
          {plan.myStatus === "confirmed"
            ? <p className="small muted">You’re confirmed. Waiting for the others.</p>
            : <button className="btn block" onClick={confirm}>Confirm and join the room</button>}
        </div>
      ) : (
        <>
          <p className="small muted"><span className="sw c-confirmed" /> Added to your schedule. Matching skips this hour now.</p>
          <Link className="btn block" href={`/rooms/${plan.id}`}>Enter room</Link>
        </>
      )}
    </article>
  );
}
