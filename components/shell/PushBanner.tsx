"use client";

// In-app push: "A plan fits the next few hours" with Nado! / Details / Later
import { useRouter } from "next/navigation";
import { planContext, planRange, startsIn } from "@/lib/plan-text";
import { useApp } from "./AppProvider";
import { useNado } from "./useNado";

export default function PushBanner() {
  const { banner, hideBanner, activities, profile, now } = useApp();
  const nado = useNado();
  const router = useRouter();
  if (!banner) return null;
  const p = banner.plan;
  const info = activities.find((a) => a.name === p.activity);
  const ctx = planContext(p, info?.category, profile?.blocks ?? []);
  return (
    <div className="banner" key={banner.key}>
      <div className="banner-in">
        <div className="b-app"><i className="appicon" aria-hidden="true" style={{ backgroundImage: "url(/mascot.webp)" }} />Nado · now</div>
        <div className="b-title">{banner.title}</div>
        {p.invitation && <div>{p.invitation}</div>}
        <div className="small">
          {ctx && <><b>{ctx}</b> · </>}
          <span className="mono">{planRange(p)}</span> · {p.activity} · {p.members.length} people · {startsIn(p, now)}
        </div>
        <div className="b-actions">
          <button className="btn nado" onClick={() => nado(p.id)}>Nado!</button>
          <button className="btn ghost sm" onClick={() => { hideBanner(); router.push(`/matches#plan-${p.id}`); }}>Details</button>
          <button className="btn ghost sm" onClick={hideBanner}>Later</button>
        </div>
      </div>
    </div>
  );
}
