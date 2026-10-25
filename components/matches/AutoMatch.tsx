"use client";

// Matching runs on arrival and every 5 minutes (each run asks Claude twice, so not more often).
// The demo clock and "Check again now" run it too.
import { useEffect } from "react";
import { useApp } from "../shell/AppProvider";

const EVERY = 5 * 60_000;

export default function AutoMatch() {
  const { profile, runMatch } = useApp();
  const ready = !!profile?.interests.length;

  useEffect(() => {
    if (!ready) return;
    let last = 0;
    try {
      last = Number(sessionStorage.getItem("nado:lastMatch") ?? 0);
    } catch {}
    const first = setTimeout(() => runMatch({ quietIfNone: true }), Date.now() - last > EVERY ? 600 : EVERY - (Date.now() - last));
    const every = setInterval(() => runMatch({ quietIfNone: true }), EVERY);
    return () => {
      clearTimeout(first);
      clearInterval(every);
    };
  }, [ready, runMatch]);

  return null;
}
