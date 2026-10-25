"use client";

// Countdown to the next matching run (top of every minute), shown instead of a button
import { useEffect, useState } from "react";
import { useApp } from "../shell/AppProvider";
import { msToNextCheck } from "./AutoMatch";

const mmss = (ms: number) => {
  const s = Math.ceil(ms / 1000) % 60;
  return `00:${String(s).padStart(2, "0")}`;
};

export default function NextCheck() {
  const { matching } = useApp();
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setLeft(msToNextCheck());
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, 250);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, []);

  return (
    <div className="next-check" role="status" aria-live="off">
      {matching ? (
        <span className="matching"><span className="spinner" />Claude is looking for plans…</span>
      ) : (
        <>
          <span>Next check in</span>
          <b className="mono">{left === null ? "00:--" : mmss(left)}</b>
        </>
      )}
    </div>
  );
}
