"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PRESET_ACTIVITIES } from "@/lib/activities";
import { createClient } from "@/lib/supabase/client";
import { addDays, campusToday, formatDate, weekStartOf } from "@/lib/time";
import WeekGrid, { cellsToSlots, slotsToCells } from "./WeekGrid";

type SlotRow = { activity: string; day_of_week: number; start_time: string; end_time: string; week_start: string | null };

const WEEKS_AHEAD = 12;
const sameCells = (a: Set<string>, b: Set<string>) => a.size === b.size && [...a].every((k) => b.has(k));
const clean = (a: string) => a.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 40);

// Pick an activity, then paint when you want to do it, week by week.
// Rows with week_start = null repeat every week (sample data); a saved week replaces them.
export default function ActivityPlanner({ studentId }: { studentId: string }) {
  const sb = useMemo(() => createClient(), []);
  const today = useMemo(() => campusToday().date, []);
  const thisWeek = weekStartOf(today);
  const lastWeek = addDays(thisWeek, WEEKS_AHEAD * 7);

  const [rows, setRows] = useState<SlotRow[]>([]);
  const [week, setWeek] = useState(thisWeek);
  const [picked, setPicked] = useState("");
  const [draft, setDraft] = useState<Set<string> | null>(null); // null = not edited
  const [custom, setCustom] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await sb
      .from("activity_slots")
      .select("activity, day_of_week, start_time, end_time, week_start")
      .eq("student_id", studentId);
    if (res.error) setStatus(res.error.message);
    else setRows(res.data as SlotRow[]);
  }, [sb, studentId]);

  useEffect(() => {
    const first = setTimeout(load, 0);
    return () => clearTimeout(first);
  }, [load]);

  const mine = [...new Set(rows.map((r) => r.activity))].sort();
  const activity = picked || mine[0] || "";
  const choices = [...new Set([...PRESET_ACTIVITIES, ...mine, ...(picked ? [picked] : [])])];

  // What's saved for this activity and week
  const weekRows = rows.filter((r) => r.activity === activity && r.week_start === week);
  const repeating = rows.filter((r) => r.activity === activity && r.week_start === null);
  const source = weekRows.length ? "week" : repeating.length ? "repeat" : "none";
  const saved = slotsToCells(weekRows.length ? weekRows : repeating);
  const cells = draft ?? saved;
  const dirty = draft !== null && !sameCells(draft, saved);

  const hasTimes = (a: string, w: string) => rows.some((r) => r.activity === a && (r.week_start === w || r.week_start === null));
  const savedWeeks = [...new Set(rows.filter((r) => r.activity === activity && r.week_start && r.week_start >= thisWeek).map((r) => r.week_start!))].sort();
  const dates = Array.from({ length: 7 }, (_, i) => addDays(week, i));

  function leave() {
    return !dirty || confirm(`Discard unsaved ${activity} times for this week?`);
  }

  function choose(a: string) {
    const name = clean(a);
    if (!name || !leave()) return;
    setPicked(name);
    setDraft(null);
    setStatus(null);
  }

  function goTo(w: string) {
    if (w < thisWeek || w > lastWeek || !leave()) return;
    setWeek(w);
    setDraft(null);
    setStatus(null);
  }

  async function save(target: string, toSave: Set<string>) {
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch("/api/availability", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, activity, weekStart: target, slots: cellsToSlots(toSave) }),
      });
      const json = await res.json();
      if (!res.ok) {
        setStatus(json.message ?? "Could not save.");
        return false;
      }
      await load();
      return true;
    } catch {
      setStatus("Could not reach the server.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function saveWeek() {
    if (await save(week, cells)) {
      setDraft(null);
      setStatus(`Saved ${activity} for the week of ${formatDate(week)}.`);
    }
  }

  async function copyToNextWeek() {
    const next = addDays(week, 7);
    if (await save(next, cells)) {
      setWeek(next);
      setDraft(null);
      setStatus(`Copied to the week of ${formatDate(next)}. Adjust and save if needed.`);
    }
  }

  async function clearWeek() {
    if (await save(week, new Set())) {
      setDraft(null);
      setStatus(repeating.length ? "Cleared this week. Your every-week times apply again." : `Cleared ${activity} for this week.`);
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-[#c8d1c9] bg-white p-4">
      <div>
        <h2 className="text-lg font-bold">Pick and paint</h2>
        <p className="text-sm opacity-70">Pick something you want to do, then drag over the hours you&apos;re free. Save as many weeks as you like.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {choices.map((a) => (
          <button
            key={a}
            onClick={() => choose(a)}
            className={`rounded-full border px-3 py-1 text-sm ${
              a === activity ? "border-[#203e35] bg-[#203e35] text-white" : "border-[#c8d1c9]"
            }`}
          >
            {a}
            {hasTimes(a, week) ? " ✓" : ""}
          </button>
        ))}
      </div>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          choose(custom);
          setCustom("");
        }}
      >
        <input
          className="min-w-0 flex-1 rounded-lg border border-[#c8d1c9] p-2 text-sm"
          placeholder="Or type your own (e.g. pottery)"
          maxLength={40}
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
        />
        <button className="rounded-lg border border-[#203e35] px-3 text-sm font-semibold" disabled={!custom.trim()}>
          Add
        </button>
      </form>

      {activity ? (
        <>
          <div className="flex items-center justify-between gap-2">
            <button
              className="rounded-lg border border-[#c8d1c9] px-3 py-1 disabled:opacity-30"
              disabled={week <= thisWeek}
              onClick={() => goTo(addDays(week, -7))}
              aria-label="Previous week"
            >
              ◀
            </button>
            <div className="text-center">
              <p className="font-semibold">
                {formatDate(week)} – {formatDate(addDays(week, 6))}
              </p>
              <p className="text-xs opacity-70">{week === thisWeek ? "This week" : week === addDays(thisWeek, 7) ? "Next week" : ""}</p>
            </div>
            <button
              className="rounded-lg border border-[#c8d1c9] px-3 py-1 disabled:opacity-30"
              disabled={week >= lastWeek}
              onClick={() => goTo(addDays(week, 7))}
              aria-label="Next week"
            >
              ▶
            </button>
          </div>

          <p className="text-sm">
            <span className="font-semibold">When do you want to do {activity}?</span>{" "}
            <span className="opacity-70">
              {source === "repeat" && !dirty ? "Showing your every-week times." : source === "none" && !dirty ? "Nothing saved for this week." : ""}
            </span>
          </p>
          <WeekGrid cells={cells} onChange={setDraft} dates={dates} today={today} />

          <div className="flex flex-wrap items-center gap-2">
            <button
              className="rounded-xl bg-[#203e35] px-4 py-2 font-semibold text-white disabled:opacity-40"
              disabled={!dirty || saving}
              onClick={saveWeek}
            >
              {saving ? "Saving…" : "Save this week"}
            </button>
            {cells.size > 0 && !dirty && week < lastWeek && (
              <button className="rounded-xl border border-[#203e35] px-3 py-2 text-sm font-semibold" disabled={saving} onClick={copyToNextWeek}>
                Copy to next week ▶
              </button>
            )}
            {dirty && (
              <button className="text-sm underline" onClick={() => setDraft(null)}>
                Undo changes
              </button>
            )}
            {source === "week" && !dirty && (
              <button className="ml-auto text-sm text-[#b4532a] underline" disabled={saving} onClick={clearWeek}>
                Clear this week
              </button>
            )}
          </div>

          {(savedWeeks.length > 0 || repeating.length > 0) && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="opacity-70">Saved {activity}:</span>
              {repeating.length > 0 && <span className="rounded-full bg-[#f7f5ef] px-2 py-0.5">every week</span>}
              {savedWeeks.map((w) => (
                <button
                  key={w}
                  onClick={() => goTo(w)}
                  className={`rounded-full px-2 py-0.5 ${w === week ? "bg-[#e77747] text-white" : "bg-[#f7f5ef]"}`}
                >
                  {formatDate(w)}
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <p className="text-sm opacity-70">Choose an activity above to paint your times.</p>
      )}
      {status && <p className="text-sm">{status}</p>}
    </section>
  );
}
