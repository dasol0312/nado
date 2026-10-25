"use client";

import { useEffect, useRef } from "react";
import { DAY_SHORT, formatHour, formatShortDate } from "@/lib/time";

export const GRID_START = 6; // first row: 6 AM
export const GRID_END = 24; // last row ends at midnight
const HOURS = Array.from({ length: GRID_END - GRID_START }, (_, i) => GRID_START + i);

// A painted hour, e.g. "0-15" = Sunday 3-4 PM
export const cellKey = (day: number, hour: number) => `${day}-${hour}`;

// When2meet-style weekly grid. Press a cell and drag: the rectangle between
// that cell and the one under the pointer is painted (or erased, if the first
// cell was already painted). `dates` labels the 7 columns; days before `today`
// can't be changed.
export default function WeekGrid({
  cells,
  onChange,
  dates,
  today,
  color = "#e77747",
}: {
  cells: Set<string>;
  onChange: (next: Set<string>) => void;
  dates: string[];
  today: string;
  color?: string;
}) {
  const isPast = (day: number) => dates[day] < today;
  const painting = useRef<null | { add: boolean; base: Set<string>; anchor: [number, number]; last: string }>(null);

  useEffect(() => {
    const stop = () => {
      painting.current = null;
    };
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    return () => {
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
  }, []);

  // Redraw from the cells as they were before this drag, plus the current rectangle
  function paintTo(key: string) {
    const p = painting.current;
    if (!p) return;
    p.last = key;
    const [day, hour] = key.split("-").map(Number);
    const [d0, h0] = p.anchor;
    const next = new Set(p.base);
    for (let d = Math.min(d0, day); d <= Math.max(d0, day); d++) {
      if (isPast(d)) continue;
      for (let h = Math.min(h0, hour); h <= Math.max(h0, hour); h++) {
        if (p.add) next.add(cellKey(d, h));
        else next.delete(cellKey(d, h));
      }
    }
    onChange(next);
  }

  function start(e: React.PointerEvent, key: string) {
    e.preventDefault();
    const [day, hour] = key.split("-").map(Number);
    if (isPast(day)) return;
    painting.current = { add: !cells.has(key), base: new Set(cells), anchor: [day, hour], last: "" };
    paintTo(key);
  }

  // Touch keeps firing on the first cell, so find the cell under the finger.
  function move(e: React.PointerEvent) {
    if (!painting.current) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const key = el instanceof HTMLElement ? el.dataset.cell : undefined;
    if (key && key !== painting.current.last) paintTo(key);
  }

  return (
    <div
      className="grid select-none gap-px rounded-xl bg-[#e3e8e3] p-px"
      style={{ gridTemplateColumns: `2.75rem repeat(7, minmax(0, 1fr))`, touchAction: "none" }}
      onPointerMove={move}
      role="grid"
      aria-label="Weekly time grid. Press and drag diagonally to paint a block of hours."
    >
      <div className="bg-[#f7f5ef]" />
      {DAY_SHORT.map((d, day) => (
        <div
          key={d}
          className={`bg-[#f7f5ef] py-1 text-center text-xs font-semibold leading-tight ${isPast(day) ? "opacity-40" : ""}`}
        >
          {d}
          <br />
          <span className="font-normal">{formatShortDate(dates[day])}</span>
        </div>
      ))}
      {HOURS.map((h) => (
        <div key={h} className="contents">
          <div className="bg-[#f7f5ef] pr-1 text-right text-[10px] leading-6 opacity-70">{formatHour(h)}</div>
          {DAY_SHORT.map((_, day) => {
            const key = cellKey(day, h);
            const on = cells.has(key);
            const past = isPast(day);
            return (
              <div
                key={key}
                data-cell={key}
                role="gridcell"
                aria-selected={on}
                aria-disabled={past}
                className={`h-6 ${past ? "cursor-not-allowed opacity-40" : "cursor-pointer"}`}
                style={{ background: on ? color : past ? "#eef0ee" : "white" }}
                onPointerDown={(e) => start(e, key)}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

// Painted hours -> slot rows, merging back-to-back hours
export function cellsToSlots(cells: Set<string>) {
  const slots: { day: number; start: string; end: string }[] = [];
  for (let day = 0; day < 7; day++) {
    let runStart: number | null = null;
    for (let h = GRID_START; h <= GRID_END; h++) {
      const on = h < GRID_END && cells.has(cellKey(day, h));
      if (on && runStart === null) runStart = h;
      if (!on && runStart !== null) {
        slots.push({ day, start: `${String(runStart).padStart(2, "0")}:00`, end: `${String(h).padStart(2, "0")}:00` });
        runStart = null;
      }
    }
  }
  return slots;
}

// Slot rows ("14:00:00"-"18:00:00") -> painted hours
export function slotsToCells(slots: { day_of_week: number; start_time: string; end_time: string }[]) {
  const cells = new Set<string>();
  for (const s of slots) {
    const from = Number(s.start_time.slice(0, 2));
    const [eh, em] = s.end_time.split(":").map(Number);
    const to = em > 0 ? eh + 1 : eh;
    for (let h = Math.max(from, GRID_START); h < Math.min(to, GRID_END); h++) cells.add(cellKey(s.day_of_week, h));
  }
  return cells;
}
