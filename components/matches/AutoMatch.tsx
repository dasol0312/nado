"use client";

// While the app is open, matching runs on arrival and then every minute, exactly on the
// minute (:00 seconds), in step with the server timer. The server runs at most once per
// minute (claim_match_minute), so the timer and every open phone share one run.
// The demo clock and "Check again now" run it too.
import { useEffect } from "react";
import { useApp } from "../shell/AppProvider";

const MINUTE = 60_000;
const untilNextMinute = () => MINUTE - (Date.now() % MINUTE) + 250; // a beat after :00

export default function AutoMatch() {
  const { profile, runMatch } = useApp();
  const ready = !!profile?.interests.length;

  useEffect(() => {
    if (!ready) return;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      runMatch({ quietIfNone: true });
      timer = setTimeout(tick, untilNextMinute()); // re-align every time, so it never drifts
    };
    const first = setTimeout(() => runMatch({ quietIfNone: true }), 600);
    timer = setTimeout(tick, untilNextMinute());
    return () => {
      clearTimeout(first);
      clearTimeout(timer);
    };
  }, [ready, runMatch]);

  return null;
}
