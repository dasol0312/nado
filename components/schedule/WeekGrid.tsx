"use client";

// Weekly busy grid, Monday first, 9 AM-9 PM. Press and drag to paint the current mode;
// class and confirmed-plan cells can't be painted over. Today and the current hour are marked.
import { useEffect, useRef } from "react";
import { addDays, campusClock, DAY_END, DAY_SHORT, DAY_START, formatGridHour, formatShortDate, WEEK_ORDER } from "@/lib/time";

export type CellKind = "class" | "fixed" | "never" | "confirmed";
export type PaintMode = "never" | "fixed" | "erase";
export type Cells = Record<string, CellKind>; // "day-hour", day 0 = Sunday

export const cellKey = (day: number, hour: number) => `${day}-${hour}`;
const HOURS = Array.from({ length: (DAY_END - DAY_START) / 60 }, (_, i) => DAY_START / 60 + i);

export default function WeekGrid({
  cells,
  onPaint,
  mode,
  now,
  editable = true,
}: {
  cells: Cells;
  onPaint?: (next: Cells) => void;
  mode?: PaintMode;
  now: Date;
  editable?: boolean;
}) {
  const paint = useRef<{ val: CellKind | null; next: Cells; changed: boolean } | null>(null);
  const live = useRef(cells);
  useEffect(() => {
    live.current = cells;
  }, [cells]);

  useEffect(() => {
    const stop = () => {
      const p = paint.current;
      paint.current = null;
      if (p?.changed) onPaint?.(p.next);
    };
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    return () => {
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
  }, [onPaint]);

  const c = campusClock(now);
  const monday = addDays(c.date, -((c.day + 6) % 7));
  const curHour = Math.floor(c.minutes / 60);

  function apply(key: string) {
    const p = paint.current;
    if (!p) return;
    const cur = p.next[key];
    if (cur === "class" || cur === "confirmed" || (cur ?? null) === p.val) return;
    if (p.val) p.next[key] = p.val;
    else delete p.next[key];
    p.changed = true;
    onPaint?.({ ...p.next }); // live redraw while dragging
  }

  function down(e: React.PointerEvent, key: string) {
    if (!editable || !mode) return;
    e.preventDefault();
    const cur = live.current[key];
    const val: CellKind | null = mode === "erase" ? null : cur === mode ? null : mode;
    paint.current = { val, next: { ...live.current }, changed: false };
    apply(key);
  }

  // Touch keeps firing on the first cell, so find the cell under the finger
  function move(e: React.PointerEvent) {
    if (!paint.current) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const key = el instanceof HTMLElement ? el.dataset.cell : undefined;
    if (key) apply(key);
  }

  return (
    <div className={`grid${editable ? " editable" : ""}`} onPointerMove={move} aria-label="Weekly schedule. Today and the current hour are highlighted.">
      <div />
      {WEEK_ORDER.map((d, i) => (
        <div key={d} className={`hd${d === c.day ? " today" : ""}`}>
          <span>{DAY_SHORT[d]}<small>{formatShortDate(addDays(monday, i))}</small></span>
        </div>
      ))}
      {HOURS.map((h) => (
        <div key={h} style={{ display: "contents" }}>
          <div className={`tm${h === curHour ? " now" : ""}`}>{formatGridHour(h)}</div>
          {WEEK_ORDER.map((d) => {
            const key = cellKey(d, h);
            const v = cells[key];
            const today = d === c.day;
            const isNow = today && h === curHour;
            return (
              <div
                key={key}
                data-cell={key}
                className={`cell${today ? " td" : ""}${isNow ? " nowc" : ""}${v ? ` c-${v}` : ""}`}
                style={isNow ? ({ "--nowpos": `${Math.round(((c.minutes % 60) / 60) * 100)}%` } as React.CSSProperties) : undefined}
                title={isNow ? "Now" : undefined}
                onPointerDown={(e) => down(e, key)}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
