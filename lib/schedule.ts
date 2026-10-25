// Busy blocks <-> painted grid cells. Classes keep their exact times (09:30-10:45);
// fixed / never hours are painted per hour and saved as merged runs.
import { DAY_END, DAY_START, campusClock, toMinutes } from "./time";

export type Block = { kind: "class" | "fixed" | "never"; day: number; start: string; end: string; label: string | null };
type Cells = Record<string, "class" | "fixed" | "never" | "confirmed">;

const key = (day: number, hour: number) => `${day}-${hour}`;
const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;

// Cells for the grid. A class covers every hour it touches; confirmed plans sit on top.
export function cellsFromBlocks(blocks: Block[], confirmed: { startsAt: number; endsAt: number }[] = []): Cells {
  const cells: Cells = {};
  for (const b of blocks) {
    const from = Math.floor(toMinutes(b.start) / 60), to = Math.ceil(toMinutes(b.end) / 60);
    for (let h = Math.max(from, DAY_START / 60); h < Math.min(to, DAY_END / 60); h++) {
      if (cells[key(b.day, h)] !== "class") cells[key(b.day, h)] = b.kind;
    }
  }
  for (const p of confirmed) {
    const s = campusClock(new Date(p.startsAt)), e = campusClock(new Date(p.endsAt));
    for (let h = Math.floor(s.minutes / 60); h < Math.ceil(e.minutes / 60); h++) cells[key(s.day, h)] = "confirmed";
  }
  return cells;
}

// Blocks to save: the classes as they are, plus painted fixed/never hours merged into runs
export function blocksFromCells(classes: Block[], cells: Cells): Block[] {
  const out: Block[] = [...classes];
  for (let day = 0; day < 7; day++) {
    let run: { kind: "fixed" | "never"; from: number } | null = null;
    for (let h = DAY_START / 60; h <= DAY_END / 60; h++) {
      const v = h < DAY_END / 60 ? cells[key(day, h)] : undefined;
      const kind = v === "fixed" || v === "never" ? v : null;
      if (run && run.kind !== kind) {
        out.push({ kind: run.kind, day, start: hh(run.from), end: hh(h), label: null });
        run = null;
      }
      if (kind && !run) run = { kind, from: h };
    }
  }
  return out;
}

export const sameBlocks = (a: Block[], b: Block[]) => {
  const norm = (x: Block[]) => x.map((v) => `${v.kind}|${v.day}|${v.start}|${v.end}|${v.label ?? ""}`).sort().join(";");
  return norm(a) === norm(b);
};
