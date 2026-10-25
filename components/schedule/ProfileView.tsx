"use client";

// Profile: nickname, interests and availability. Changes save right away and re-run matching.
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { sameBlocks, type Block } from "@/lib/schedule";
import { MAX_INTERESTS } from "@/lib/catalog";
import InterestPicker, { type Picked } from "../interests/InterestPicker";
import { useApp } from "../shell/AppProvider";
import { Mascot } from "../shell/icons";
import { useGo } from "../shell/useGo";
import ScheduleEditor from "./ScheduleEditor";

export default function ProfileView() {
  const { me, profile, act, toast, reloadProfile, runMatch } = useApp();
  const go = useGo();
  const [blocks, setBlocks] = useState<Block[] | null>(null);
  const [interests, setInterests] = useState<Picked[] | null>(null);
  useEffect(() => {
    if (!profile) return;
    const t = setTimeout(() => {
      setBlocks((b) => b ?? profile.blocks);
      setInterests((i) => i ?? profile.interests);
    }, 0);
    return () => clearTimeout(t);
  }, [profile]);

  // 0.5 s after the last change: save, then re-run matching.
  // One request at a time per path, always with the newest edit, so a slow earlier save
  // can't land after (and overwrite) a newer one. Timers keep running if you leave the page.
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const latest = useRef<Record<string, unknown>>({});
  const saving = useRef<Record<string, boolean>>({});
  const flush = useCallback(async (path: string) => {
    if (saving.current[path]) return; // the running save picks up the newest edit when it finishes
    saving.current[path] = true;
    let saved = false;
    try {
      while (path in latest.current) {
        const body = latest.current[path];
        delete latest.current[path];
        try {
          await act(path, body, "PUT");
          saved = true;
        } catch (e) {
          toast((e as Error).message);
        }
      }
    } finally {
      saving.current[path] = false;
    }
    if (saved) {
      await reloadProfile();
      runMatch({ title: "A plan fits the next few hours", quietIfNone: true });
    }
  }, [act, reloadProfile, runMatch, toast]);
  const save = useCallback((path: string, body: unknown) => {
    latest.current[path] = body;
    clearTimeout(saveTimers.current[path]);
    saveTimers.current[path] = setTimeout(() => flush(path), 500);
  }, [flush]);

  const changeBlocks = (b: Block[]) => {
    setBlocks(b);
    if (!profile || !sameBlocks(b, profile.blocks)) save("/api/profile/schedule", { blocks: b });
  };
  const changeInterests = (v: Picked[]) => {
    setInterests(v);
    save("/api/profile/interests", { interests: v });
  };

  async function signOut() {
    await act("/api/auth/signout").catch(() => {});
    go("/login");
  }

  return (
    <>
      <div className="between"><h1>Profile</h1><span className="pill plain">Visible to the AI only</span></div>
      <div className="card row" style={{ gap: 12, flexWrap: "nowrap" }}>
        <Mascot width={48} style={{ flex: "none" }} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <h3>{me?.nickname}</h3>
          <p className="small muted mono" style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{me?.email}</p>
        </div>
        <button className="btn ghost sm" onClick={signOut}>Sign out</button>
      </div>

      <div className="section-h"><h2>My interests</h2><span className="pill plain mono">{interests?.length ?? 0} / {MAX_INTERESTS}</span></div>
      <div className="card stack" style={{ gap: 10 }}>
        {interests
          ? <InterestPicker value={interests} onChange={changeInterests} show="slots"
              onEmptySlot={() => document.getElementById("browse")?.scrollIntoView({ behavior: "smooth", block: "start" })} />
          : <div className="empty"><span className="spinner" /></div>}
        {!interests?.length && <p className="small muted">Pick up to {MAX_INTERESTS} things you’d do with other students.</p>}
      </div>

      <div className="section-h" id="browse" style={{ scrollMarginTop: 12 }}><h2>Browse interests</h2><span className="small muted">{(interests?.length ?? 0) >= MAX_INTERESTS ? `${MAX_INTERESTS} of ${MAX_INTERESTS} picked` : "Tap to add"}</span></div>
      {interests
        ? <div className="card stack" style={{ gap: 12 }}><InterestPicker value={interests} onChange={changeInterests} /></div>
        : <div className="empty"><span className="spinner" /></div>}

      <div className="section-h"><h2>My availability</h2><span className="small muted">Changes re-run matching</span></div>
      <p className="small muted" style={{ marginTop: -10 }}>Classes come from Albert. Paint other commitments and hours you’re never free; everything else counts as free.</p>
      {blocks ? <ScheduleEditor blocks={blocks} onChange={changeBlocks} /> : <div className="empty"><span className="spinner" /></div>}
      {!!interests?.length && <Link className="btn block" href="/matches">See my matches</Link>}
      <p className="small muted" style={{ textAlign: "center" }}>Other students only see your nickname. Your schedule and interests stay private.</p>
    </>
  );
}
