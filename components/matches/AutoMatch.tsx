"use client";

// Matching runs on arrival and at the top of every minute, the same beat as the DB timer
// (pg_cron, every minute). The countdown on Right now (NextCheck) counts down to the same moment.
import { useEffect } from "react";
import { useApp } from "../shell/AppProvider";

export const EVERY = 60_000;
// ms until the next whole minute
export const msToNextCheck = (t = Date.now()) => EVERY - (t % EVERY);

export default function AutoMatch() {
  const { profile, runMatch } = useApp();
  const ready = !!profile?.interests.length;

  useEffect(() => {
    if (!ready) return;
    let last = 0;
    try {
      last = Number(sessionStorage.getItem("nado:lastMatch") ?? 0);
    } catch {}
    const run = () => runMatch({ quietIfNone: true });
    const arrive = Date.now() - last > EVERY ? setTimeout(run, 600) : undefined;
    let every: ReturnType<typeof setInterval> | undefined;
    const first = setTimeout(() => {
      run();
      every = setInterval(run, EVERY);
    }, msToNextCheck());
    return () => {
      clearTimeout(arrive);
      clearTimeout(first);
      clearInterval(every);
    };
  }, [ready, runMatch]);

  return null;
}
