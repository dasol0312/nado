"use client";

// Bottom sheet: the smallest group I'd enjoy for one activity (the AI sets the largest)
import { useEffect, useState } from "react";
import type { ActivityRow } from "../shell/AppProvider";

export default function MinSizeSheet({
  activity, initial, exists, custom, rethinking, onRethink, onSave, onRemove, onClose,
}: {
  activity: ActivityRow;
  initial: number;
  exists: boolean;
  custom: boolean; // added by a student (not one of the 16 built-ins)
  rethinking: boolean;
  onRethink: () => void;
  onSave: (min: number) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const [min, setMin] = useState(initial);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  return (
    <div className="sheet-wrap" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Minimum group size">
        <div className="stack" style={{ gap: 4 }}>
          <span className="eyebrow">{activity.category}</span>
          <h2>What’s the smallest group you’d enjoy for {activity.label.toLowerCase()}?</h2>
        </div>
        <div className="stepper">
          <button aria-label="One fewer" onClick={() => setMin((m) => Math.max(2, m - 1))}>−</button>
          <output className="mono" aria-live="polite">{Math.min(min, activity.max_size)}</output>
          <button aria-label="One more" onClick={() => setMin((m) => Math.min(activity.max_size, m + 1))}>+</button>
        </div>
        <div className="aibox">
          <span className="ai">{custom ? (activity.by_ai ? "CLAUDE" : "DEFAULT") : "AI"}</span>
          <div className="stack" style={{ gap: 4 }}>
            <div>Up to <b>{activity.max_size} people</b> for {activity.label}.{activity.reason ? ` ${activity.reason}` : ""}</div>
            {activity.meet && (
              <div className="small muted">
                Meet at {activity.meet.name}
                {activity.dest && activity.dest.key !== activity.meet.key ? `, then ${activity.dest.name}` : ""}
              </div>
            )}
            <div className="small muted">If fewer than your minimum are free, we won’t form a team.</div>
            {custom && (
              <div>
                {rethinking
                  ? <span className="small muted"><span className="spinner" style={{ width: 12, height: 12, verticalAlign: -2 }} /> Claude is rethinking…</span>
                  : <button className="link" onClick={onRethink}>Ask Claude to rethink</button>}
              </div>
            )}
          </div>
        </div>
        <div className="row" style={{ flexWrap: "nowrap" }}>
          {exists
            ? <button className="btn ghost block" onClick={onRemove}>Remove interest</button>
            : <button className="btn ghost block" onClick={onClose}>Cancel</button>}
          <button className="btn block" onClick={() => onSave(Math.min(min, activity.max_size))}>Save</button>
        </div>
      </div>
    </div>
  );
}
