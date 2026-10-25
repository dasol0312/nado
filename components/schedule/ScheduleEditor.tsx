"use client";

// Albert upload + paint tools + grid + legend. Controlled: `blocks` in, onChange(blocks) out.
import { useMemo, useState } from "react";
import { blocksFromCells, cellsFromBlocks, type Block } from "@/lib/schedule";
import { clockText } from "@/lib/plan-text";
import { useApp } from "../shell/AppProvider";
import AlbertUpload, { type ParseState } from "./AlbertUpload";
import WeekGrid, { type Cells, type PaintMode } from "./WeekGrid";

export default function ScheduleEditor({ blocks, onChange }: { blocks: Block[]; onChange: (b: Block[]) => void }) {
  const { now, plans } = useApp();
  const [mode, setMode] = useState<PaintMode>("never");
  const [parse, setParse] = useState<ParseState>({ state: "idle" });
  const classes = blocks.filter((b) => b.kind === "class");
  const confirmed = useMemo(() => plans.filter((p) => p.status === "confirmed" && p.myStatus === "confirmed"), [plans]);
  const cells = useMemo(() => cellsFromBlocks(blocks, confirmed), [blocks, confirmed]);

  const setClasses = (list: Block[]) => onChange([...list, ...blocks.filter((b) => b.kind !== "class")]);
  const paint = (next: Cells) => onChange(blocksFromCells(classes, next));

  return (
    <>
      <AlbertUpload
        parse={parse}
        classes={classes}
        onParse={setParse}
        onClasses={setClasses}
      />
      <div className="stack">
        <div className="seg" role="group" aria-label="Paint tool">
          <button className={mode === "never" ? "on" : ""} onClick={() => setMode("never")}><i className="sw c-never" />Never free</button>
          <button className={mode === "fixed" ? "on" : ""} onClick={() => setMode("fixed")}><i className="sw c-fixed" />Fixed</button>
          <button className={mode === "erase" ? "on" : ""} onClick={() => setMode("erase")}>Erase</button>
        </div>
        <WeekGrid cells={cells} onPaint={paint} mode={mode} now={now} />
        <div className="legend">
          <span><i className="cell nowc" style={{ "--nowpos": "50%" } as React.CSSProperties} />Now · {clockText(now)}</span>
          <span><i className="cell c-class" />Class</span>
          <span><i className="cell c-fixed" />Fixed commitment</span>
          <span><i className="cell c-never" />Never free</span>
          <span><i className="cell c-confirmed" />Confirmed plan</span>
        </div>
      </div>
    </>
  );
}
