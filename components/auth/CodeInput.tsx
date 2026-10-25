"use client";

// Six one-digit boxes. Typing moves forward, Backspace moves back, pasting fills them all.
import { useEffect, useRef, useState } from "react";

export default function CodeInput({ bad, disabled, onSubmit }: { bad: boolean; disabled: boolean; onSubmit: (code: string) => void }) {
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  useEffect(() => refs.current[0]?.focus(), []);

  function type(i: number, raw: string) {
    const v = raw.replace(/\D/g, "");
    const next = [...digits];
    if (v.length > 1) {
      v.slice(0, 6 - i).split("").forEach((ch, j) => (next[i + j] = ch));
      refs.current[Math.min(5, i + v.length)]?.focus();
    } else {
      next[i] = v;
      if (v && i < 5) refs.current[i + 1]?.focus();
    }
    setDigits(next);
  }

  return (
    <form className="stack" style={{ gap: 14 }} noValidate onSubmit={(e) => { e.preventDefault(); onSubmit(digits.join("")); }}>
      <div className={`code${bad ? " bad" : ""}`} role="group" aria-label="6-digit code">
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => { refs.current[i] = el; }}
            value={d}
            inputMode="numeric"
            autoComplete={i === 0 ? "one-time-code" : "off"}
            aria-label={`Digit ${i + 1}`}
            onChange={(e) => type(i, e.target.value)}
            onKeyDown={(e) => { if (e.key === "Backspace" && !d && i > 0) refs.current[i - 1]?.focus(); }}
          />
        ))}
      </div>
      <button className="btn block" type="submit" disabled={disabled}>{disabled ? <span className="spinner" /> : "Verify"}</button>
    </form>
  );
}
