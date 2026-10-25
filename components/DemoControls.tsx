"use client";

import { useState } from "react";
import { addDays, campusToday, dayOfWeek } from "@/lib/time";

type OpenResult = {
  opened: { id: string; activity: string; start: string; end: string; place: string; members: string[] }[];
  skipped: { activity: string; reason: string }[];
  filtered: { original: string; activity: string; removed: string }[];
};

// Default: the coming Sunday (judging day), or today if it's Sunday
function comingSunday() {
  const today = campusToday().date;
  return addDays(today, (7 - dayOfWeek(today)) % 7);
}

// Demo only: stands in for Claude checking on a schedule.
export default function DemoControls() {
  const [date, setDate] = useState(comingSunday);
  const [time, setTime] = useState("10:30");
  const [opening, setOpening] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [lastRun, setLastRun] = useState<OpenResult | null>(null);

  async function openRooms(replace: boolean) {
    if (replace && !confirm(`Delete every room on ${date} (with its joins and replies) and open new ones?`)) return;
    setOpening(true);
    setNotice(null);
    try {
      const res = await fetch("/api/open-rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ now: { date, time }, replace }),
      });
      const json = await res.json();
      if (!res.ok) {
        setNotice(json.message ?? "Something went wrong.");
      } else {
        setLastRun(json);
      }
    } catch {
      setNotice("Could not reach the server.");
    } finally {
      setOpening(false);
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-dashed border-[#c8d1c9] p-4">
      <div>
        <p className="font-semibold">Demo controls</p>
        <p className="text-sm opacity-70">In the real app Claude checks on a schedule. Here, a button does it.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span>Pretend it&apos;s</span>
        <input
          type="date"
          className="rounded-lg border border-[#c8d1c9] bg-white p-2"
          value={date}
          onChange={(e) => e.target.value && setDate(e.target.value)}
          aria-label="Date"
        />
        <input
          type="time"
          className="rounded-lg border border-[#c8d1c9] bg-white p-2"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          aria-label="Time"
        />
      </div>
      <button
        className="rounded-xl bg-[#203e35] px-4 py-3 font-semibold text-white disabled:opacity-50"
        disabled={opening}
        onClick={() => openRooms(false)}
      >
        {opening ? "Claude is opening rooms…" : "Let Claude open rooms"}
      </button>
      <button className="self-start text-sm underline opacity-70" disabled={opening} onClick={() => openRooms(true)}>
        Start this date over (deletes its rooms, joins, and replies)
      </button>
      {notice && <p className="text-sm text-[#b4532a]">{notice}</p>}
      {lastRun && (
        <div className="text-sm">
          <p className="font-semibold">
            Claude opened {lastRun.opened.length} {lastRun.opened.length === 1 ? "room" : "rooms"}
            {lastRun.opened.length === 0 ? " (students already in a room that day aren't invited again)" : ""}
          </p>
          <ul className="list-disc pl-5">
            {lastRun.opened.map((r) => (
              <li key={r.id}>
                {r.activity} {r.start}–{r.end} at {r.place} ({r.members.length} invited)
              </li>
            ))}
            {lastRun.filtered.map((f) => (
              <li key={f.original}>
                Cleaned &quot;{f.original}&quot; → {f.activity}
              </li>
            ))}
            {lastRun.skipped.map((s) => (
              <li key={s.activity} className="opacity-60">
                {s.activity}: {s.reason}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
