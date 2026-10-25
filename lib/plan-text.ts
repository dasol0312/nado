// Short text for plan cards and banners (campus time, demo clock)
import { campusClock, DAY_SHORT, formatMinutes, formatRange, formatShortDate } from "./time";

type Timed = { startsAt: number; endsAt: number; activity: string };
type Block = { kind: string; day: number; end: string; label: string | null };

export function planRange(p: { startsAt: number; endsAt: number }) {
  return formatRange(campusClock(new Date(p.startsAt)).minutes, campusClock(new Date(p.endsAt)).minutes);
}

export function startsIn(p: { startsAt: number }, now: Date) {
  const mins = Math.round((p.startsAt - now.getTime()) / 60_000);
  if (mins <= 0) return "happening now";
  if (mins < 60) return `starts in ${mins} min`;
  return `starts in ${Math.floor(mins / 60)}h${mins % 60 ? ` ${mins % 60}m` : ""}`;
}

// "Mon 10/27 · starts in 40 min"
export function whenLabel(p: { startsAt: number }, now: Date) {
  const c = campusClock(new Date(p.startsAt));
  return `${DAY_SHORT[c.day]} ${formatShortDate(c.date)} · ${startsIn(p, now)}`;
}

// "Right after MATH-UA 121" when one of my classes ends just before; "Lunch break" for food
export function planContext(p: Timed, category: string | undefined, blocks: Block[]) {
  const c = campusClock(new Date(p.startsAt));
  const after = blocks.find((b) => b.kind === "class" && b.day === c.day && toMin(b.end) <= c.minutes && c.minutes - toMin(b.end) <= 20);
  if (after?.label) return `Right after ${after.label.split(" ").slice(0, 2).join(" ")}`;
  if (category === "Food") {
    if (c.minutes >= 690 && c.minutes < 840) return "Lunch break";
    if (c.minutes >= 1050 && c.minutes < 1230) return "Dinner break";
  }
  return "";
}

export const clockText = (now: Date) => formatMinutes(campusClock(now).minutes);

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
