"use client";

import { planContext, planRange, whenLabel } from "@/lib/plan-text";
import { useApp, type Plan } from "../shell/AppProvider";
import { PinIcon } from "../shell/icons";
import { useNado } from "../shell/useNado";

export default function PlanCard({ plan, highlight }: { plan: Plan; highlight?: boolean }) {
  const { now, activities, profile } = useApp();
  const nado = useNado();
  const info = activities.find((a) => a.name === plan.activity);
  const ctx = planContext(plan, info?.category, profile?.blocks ?? []);
  return (
    <article className={`card rec${highlight ? " hl" : ""}`} id={`plan-${plan.id}`}>
      <div className="top">
        <span>{whenLabel(plan, now)}</span>
        <span className="mono time">{planRange(plan)}</span>
        {ctx && <span className="pill">{ctx}</span>}
      </div>
      <div className="kw">{plan.activity}<small>{info?.label ?? plan.activity} · {info?.category ?? "Other"}</small></div>
      <div className="meta">
        <span>{plan.members.length} matched</span>
        <span>min {plan.minSize}</span>
        <span>max {plan.maxSize} (set by AI)</span>
      </div>
      <div className="foot">
        <div className="place"><PinIcon /><span>Meet at {plan.meet?.name ?? "a campus spot"}</span></div>
        <button className="btn nado" onClick={() => nado(plan.id)}>Nado!</button>
      </div>
    </article>
  );
}
