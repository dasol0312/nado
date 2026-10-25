"use client";

// "Right now": plans starting in the next 4 hours that I haven't answered yet
import { useEffect, useRef, useState } from "react";
import { clockText } from "@/lib/plan-text";
import { campusClock, DAY_SHORT, HORIZON_MINUTES } from "@/lib/time";
import { useApp } from "../shell/AppProvider";
import ClockSheet from "../shell/ClockSheet";
import { Mascot } from "../shell/icons";
import PlanCard from "./PlanCard";

export default function MatchesView() {
  const { now, clock, plans, plansReady, matching, runMatch, notifOn, setNotifOn, toast } = useApp();
  const [hash, setHash] = useState("");
  // Easter egg: tap the clock 5 times quickly to set the demo date and time
  const [clockOpen, setClockOpen] = useState(false);
  const taps = useRef<number[]>([]);
  const tapClock = () => {
    const t = Date.now();
    taps.current = [...taps.current.filter((x) => t - x < 2000), t];
    if (taps.current.length >= 5) {
      taps.current = [];
      setClockOpen(true);
    }
  };
  useEffect(() => {
    const read = () => setHash(window.location.hash.replace("#plan-", ""));
    const t = setTimeout(read, 0);
    window.addEventListener("hashchange", read);
    return () => {
      clearTimeout(t);
      window.removeEventListener("hashchange", read);
    };
  }, []);
  useEffect(() => {
    if (hash) document.getElementById(`plan-${hash}`)?.scrollIntoView({ block: "center" });
  }, [hash, plans]);

  const horizon = now.getTime() + HORIZON_MINUTES * 60_000;
  const list = plans.filter((p) => p.status === "open" && p.myStatus === "invited" && p.startsAt > now.getTime() && p.startsAt <= horizon);

  return (
    <>
      <div className="between"><h1>Right now</h1><button type="button" className={`pill mono ${clock?.base ? "amber" : "plain"}`} onClick={tapClock}
          style={{ userSelect: "none", WebkitUserSelect: "none", cursor: "default" }}
          title={clock?.base ? "Demo clock (New York time)" : "New York time"}>
          {clock?.base ? `${DAY_SHORT[campusClock(now).day]} ${clockText(now)}` : clockText(now)}
        </button></div>
      <p className="small muted" style={{ marginTop: -8 }}>Plans starting in the next 4 hours, built around when your classes end.</p>
      <div className="card between">
        <div>
          <h3 style={{ fontSize: 14.5 }}>Match notifications</h3>
          <p className="small muted">We ping you when a plan fits the next few hours, like the moment a class lets out.</p>
        </div>
        <label className="toggle">
          <input type="checkbox" checked={notifOn} aria-label="Match notifications"
            onChange={(e) => { setNotifOn(e.target.checked); toast(e.target.checked ? "Match notifications on" : "Notifications off. Matches still land here"); }} />
          <span />
        </label>
      </div>
      <button className="btn soft sm" disabled={matching} onClick={() => runMatch({ title: "A plan fits the next few hours" })}>
        {matching ? <span className="matching"><span className="spinner" />Claude is looking for plans…</span> : "Check again now (runs every 5 min)"}
      </button>
      <div className="section-h"><h2>Next 4 hours</h2><span className="small muted">{list.length} plan{list.length === 1 ? "" : "s"}</span></div>
      {!plansReady ? (
        <div className="empty"><span className="spinner" /></div>
      ) : list.length ? (
        list.map((p) => <PlanCard key={p.id} plan={p} highlight={p.id === hash} />)
      ) : (
        <div className="empty">
          <Mascot width={64} style={{ margin: "0 auto 8px" }} />
          Nothing fits the next 4 hours.<br />We’ll check again when your next class ends.
        </div>
      )}
      <p className="small muted" style={{ textAlign: "center" }}>Plans never overlap in time. You won’t know who’s in the group until you meet.</p>
      {clockOpen && <ClockSheet onClose={() => setClockOpen(false)} />}
    </>
  );
}
