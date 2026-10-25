"use client";

// Quiet status line under the notifications card: a slow "live" dot, what we're watching,
// and a small ring that fills toward the next matching run (top of every minute).
// The seconds stay small and muted so the screen doesn't feel like a timer.
import { useEffect, useState } from "react";
import { useApp } from "../shell/AppProvider";
import { EVERY, msToNextCheck } from "./AutoMatch";

const mmss = (ms: number) => `00:${String(Math.ceil(ms / 1000) % 60).padStart(2, "0")}`;

export default function NextCheck() {
  const { matching } = useApp();
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setLeft(msToNextCheck());
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, []);

  const done = left === null ? 0 : 1 - left / EVERY;
  return (
    <div className="next-check" role="status">
      {matching ? (
        <span className="matching"><span className="spinner" style={{ width: 12, height: 12 }} />Claude is looking for plans…</span>
      ) : (
        <>
          <span className="live-dot" aria-hidden="true" />
          <span><b>Live</b><span className="muted"> · checking every minute</span></span>
          <span className="next-in" aria-label={left === null ? undefined : `Next check in ${Math.ceil(left / 1000)} seconds`}>
            <span className="ring" style={{ "--p": `${Math.round(done * 360)}deg` } as React.CSSProperties} aria-hidden="true" />
            <span className="mono">{left === null ? "00:--" : mmss(left)}</span>
          </span>
        </>
      )}
    </div>
  );
}
