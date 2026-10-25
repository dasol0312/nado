"use client";

// Hidden demo clock (tap the clock on Right now 5 times). Sets the shared app_clock,
// so every phone and the matcher move to the same date and time.
import { useEffect, useRef, useState } from "react";
import { CLOCK_PRESETS } from "@/lib/demo";
import { campusClock, DAY_SHORT, dayOfWeek, isDate, nextWeekday } from "@/lib/time";
import { useApp } from "./AppProvider";

export default function ClockSheet({ onClose }: { onClose: () => void }) {
  const { now, clock, act, reloadClock, runMatch, toast } = useApp();
  const start = campusClock(now);
  const [date, setDate] = useState(start.date);
  const [time, setTime] = useState(start.time);
  const [busy, setBusy] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  // Nothing scrolls while the sheet is open: lock the screen behind it and swallow drags
  useEffect(() => {
    const screen = document.querySelector<HTMLElement>(".screen");
    const before = screen?.style.overflow ?? "";
    if (screen) screen.style.overflow = "hidden";
    const el = wrap.current;
    const stop = (e: TouchEvent) => e.preventDefault();
    el?.addEventListener("touchmove", stop, { passive: false });
    return () => {
      if (screen) screen.style.overflow = before;
      el?.removeEventListener("touchmove", stop);
    };
  }, []);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  const set = async (body: Record<string, string>, msg: string) => {
    setBusy(true);
    try {
      await act("/api/demo/clock", body, "PUT");
      await reloadClock();
      toast(msg);
      onClose();
      runMatch({ quietIfNone: true, force: true }); // the clock moved, so run even if this minute already did
    } catch (e) {
      toast((e as Error).message);
      setBusy(false);
    }
  };

  const valid = isDate(date) && /^\d{2}:\d{2}$/.test(time);
  const today = campusClock(new Date()).date;

  return (
    <div ref={wrap} className="sheet-wrap" style={{ touchAction: "none", overscrollBehavior: "contain" }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Demo clock">
        <div className="stack" style={{ gap: 4 }}>
          <span className="eyebrow">Secret demo clock</span>
          <h2>Jump to any moment</h2>
          <p className="small muted">
            Everyone on the demo moves with you. {clock?.base ? `Now: ${clock.label ?? "custom time"}.` : "Following real time."}
          </p>
        </div>
        <div className="chips">
          {CLOCK_PRESETS.filter((p) => p.day !== null).map((p) => (
            <button key={p.id} className="chip" onClick={() => { setDate(nextWeekday(today, p.day!)); setTime(p.time!); }}>
              {p.label.split(" · ")[0]}
            </button>
          ))}
        </div>
        <div className="row" style={{ flexWrap: "nowrap" }}>
          <div className="field" style={{ flex: 1.4 }}>
            <label htmlFor="clock-date">Date {isDate(date) && <span className="muted">· {DAY_SHORT[dayOfWeek(date)]}</span>}</label>
            <input id="clock-date" className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="clock-time">Time (NYC)</label>
            <input id="clock-time" className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
        </div>
        <div className="row" style={{ flexWrap: "nowrap" }}>
          <button className="btn ghost block" disabled={busy} onClick={() => set({ preset: "real" }, "Back to real time")}>Real time</button>
          <button className="btn block" disabled={busy || !valid} onClick={() => set({ date, time }, `Clock set to ${DAY_SHORT[dayOfWeek(date)]} ${time}`)}>
            Set clock
          </button>
        </div>
      </div>
    </div>
  );
}
