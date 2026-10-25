"use client";

// 30 minutes before: outfit → hints to find each member → (give up → screen glows) → Found + icebreaker.
// Glow and "found you" travel between phones as Realtime broadcasts on the room's channel.
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { questionsFor } from "@/lib/catalog";
import { HAIR, OUTFIT_COLORS, sampleOutfit, SHOES, TOPS } from "@/lib/outfits";
import { createClient } from "@/lib/supabase/client";
import type { Outfit } from "@/types/database";
import MemberChips from "../room/MemberChips";
import { useApp } from "../shell/AppProvider";
import { BackIcon, Mascot } from "../shell/icons";
import GlowScreen from "./GlowScreen";

type Phase = "outfit" | "hunt" | "glow" | "done";

export default function FindFlow({ roomId }: { roomId: string }) {
  const { me, plans, plansReady, activities, act, toast } = useApp();
  const plan = plans.find((p) => p.id === roomId);
  const sb = useMemo(() => createClient(), []);
  const channel = useRef<RealtimeChannel | null>(null);

  const [phase, setPhase] = useState<Phase>("outfit");
  const [outfit, setOutfit] = useState<Partial<Outfit>>({});
  const [found, setFound] = useState<Set<string>>(new Set());
  const [hints, setHints] = useState<Record<string, number>>({});
  const [dunno, setDunno] = useState(0);
  const [foundBy, setFoundBy] = useState("");
  const [glowing, setGlowing] = useState<{ id: string; nickname: string } | null>(null);
  const [question, setQuestion] = useState("");
  const [qBusy, setQBusy] = useState(false);

  const others = plan ? plan.members.filter((m) => !m.isMe && m.status === "confirmed").slice(0, 3) : [];
  const target = others.find((m) => !found.has(m.id));
  const info = activities.find((a) => a.name === plan?.activity);

  // Room channel: someone's screen is glowing / someone found the glowing phone
  useEffect(() => {
    if (!me) return;
    const ch = sb
      .channel(`find-${roomId}`)
      .on("broadcast", { event: "glow" }, ({ payload }) => {
        if (payload.id !== me.id) setGlowing({ id: payload.id, nickname: payload.nickname });
      })
      .on("broadcast", { event: "found" }, ({ payload }) => {
        if (payload.target === me.id) setFoundBy(payload.by);
      })
      .subscribe();
    channel.current = ch;
    return () => {
      sb.removeChannel(ch);
    };
  }, [sb, roomId, me]);

  useEffect(() => {
    if (phase !== "done" || !plan || question) return;
    // The first question comes from the activity's list; Claude is asked only for "Another question"
    const t = setTimeout(() => setQuestion(questionsFor(plan.activity, info?.category)[0]), 0);
    act(`/api/rooms/${roomId}/outfit`, undefined, "DELETE").catch(() => {}); // hints are deleted once you've met
    return () => clearTimeout(t);
  }, [phase, plan, question, info?.category, roomId, act]);

  if (!plansReady) return <div className="empty"><span className="spinner" /></div>;
  if (!plan || plan.status !== "confirmed") {
    return <div className="empty">This group isn’t open. <Link className="link" href="/groups">Back to groups</Link></div>;
  }
  const place = plan.meet?.name ?? "the meeting spot";
  const back = <div className="backbar"><Link href={`/rooms/${roomId}`} className="link" style={{ display: "flex", alignItems: "center", gap: 2, textDecoration: "none" }}><BackIcon />Room</Link></div>;

  async function sendOutfit() {
    try {
      await act(`/api/rooms/${roomId}/outfit`, { outfit }, "PUT");
      setPhase(others.length ? "hunt" : "done");
      toast("Outfit sent to the AI. Your group’s hints are here");
    } catch (e) {
      toast((e as Error).message);
    }
  }

  function markFound(id: string) {
    const next = new Set(found).add(id);
    setFound(next);
    if (others.every((m) => next.has(m.id))) setPhase("done");
  }

  function giveUp() {
    setPhase("glow");
    channel.current?.send({ type: "broadcast", event: "glow", payload: { id: me!.id, nickname: me!.nickname } });
    // Sample students can't look up, so one of them "finds" you in the demo
    const sample = others.find((m) => m.isSample && !found.has(m.id));
    if (sample) setTimeout(() => setFoundBy((f) => f || sample.nickname), 3200);
  }

  async function another() {
    setQBusy(true);
    try {
      const res = await act(`/api/rooms/${roomId}/icebreaker`, { previous: question });
      setQuestion(String(res.question));
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setQBusy(false);
    }
  }

  const glowBanner = glowing && phase !== "glow" && (
    <div className="aibox" style={{ background: "var(--glow)", color: "var(--glow-ink)" }}>
      <span className="ai" style={{ background: "var(--glow-ink)", color: "var(--glow)" }}>!</span>
      <div className="stack" style={{ gap: 6 }}>
        <div><b>{glowing.nickname}</b> is holding up a bright yellow screen. Look around!</div>
        <button className="btn sm" style={{ alignSelf: "flex-start", background: "var(--glow-ink)", color: "var(--glow)" }}
          onClick={() => {
            channel.current?.send({ type: "broadcast", event: "found", payload: { target: glowing.id, by: me!.nickname } });
            markFound(glowing.id);
            setGlowing(null);
          }}>I found them</button>
      </div>
    </div>
  );

  if (phase === "outfit") {
    const opt = (k: "top" | "shoes" | "hair", list: string[]) => list.map((v) => (
      <button key={v} className={`chip${outfit[k] === v ? " on" : ""}`} onClick={() => setOutfit({ ...outfit, [k]: v })}>{v}</button>
    ));
    return (
      <>
        {back}
        {glowBanner}
        <div className="aibox"><span className="ai">AI</span><div>{info?.label ?? plan.activity} starts in 30 minutes at <b>{place}</b>. What are you wearing today? Your group only sees this as hints, and it’s deleted after you meet.</div></div>
        <div className="stack"><span className="eyebrow">Top color</span>
          <div className="optgrid">{OUTFIT_COLORS.map(([n, c]) => (
            <button key={n} className={`swatch${outfit.color === n ? " on" : ""}`} style={{ background: c }} aria-label={n} title={n} onClick={() => setOutfit({ ...outfit, color: n })} />
          ))}</div>
        </div>
        <div className="stack"><span className="eyebrow">Top</span><div className="chips">{opt("top", TOPS)}</div></div>
        <div className="stack"><span className="eyebrow">Shoes</span><div className="chips">{opt("shoes", SHOES)}</div></div>
        <div className="stack"><span className="eyebrow">Hair / accessory</span><div className="chips">{opt("hair", HAIR)}</div></div>
        <button className="btn block" disabled={!(outfit.color && outfit.top && outfit.shoes && outfit.hair)} onClick={sendOutfit}>Send to AI and head out</button>
      </>
    );
  }

  if (phase === "hunt" && target) {
    const o = target.outfit ?? (target.isSample ? sampleOutfit(target.id) : null);
    const level = hints[target.id] ?? 0;
    const list: [string, string][] = o ? [["Top", `${o.color} ${o.top}`], ["Shoes", o.shoes], ["Hair", o.hair]] : [];
    return (
      <>
        {back}
        {glowBanner}
        <div className="stack" style={{ gap: 4 }}>
          <span className="eyebrow">Find your group · {place}</span>
          <div className="targets">{others.map((m) => (
            <span key={m.id} className={`pill ${found.has(m.id) ? "good" : m.id === target.id ? "" : "plain"}`}>{found.has(m.id) ? "Found · " : ""}{m.nickname}</span>
          ))}</div>
        </div>
        <div className="card stack" style={{ gap: 12 }}>
          <div className="aibox"><span className="ai">AI</span><div><b>{target.nickname}</b> is nearby. {o ? "Look for someone in:" : "They haven’t shared their outfit yet."}</div></div>
          {o && (
            <>
              <p className="hint">{list[0][1]}</p>
              <div className="hintlist">{list.map(([k, v], i) => i <= level
                ? <div key={k}><span className="n">HINT {i + 1}</span><span>{k}: {v}</span></div>
                : <div key={k} className="locked"><span className="n">HINT {i + 1}</span><span>Tap “Not sure” to unlock</span></div>)}
              </div>
            </>
          )}
        </div>
        <div className="row" style={{ flexWrap: "nowrap" }}>
          <button className="btn block" onClick={() => markFound(target.id)}>Found them</button>
          <button className="btn ghost block" onClick={() => { setDunno((d) => d + 1); setHints({ ...hints, [target.id]: Math.min(2, level + 1) }); }}>Not sure</button>
        </div>
        {dunno >= 2 && (
          <>
            <button className="btn block" style={{ background: "var(--glow)", color: "var(--glow-ink)" }} onClick={giveUp}>I give up · make my screen glow</button>
            <p className="small muted" style={{ textAlign: "center" }}>Your phone lights up bright yellow so your group can find you instead.</p>
          </>
        )}
      </>
    );
  }

  if (phase === "glow") {
    return <GlowScreen nickname={me!.nickname} foundBy={foundBy} onMet={() => { setFound(new Set(others.map((m) => m.id))); setPhase("done"); }} />;
  }

  return (
    <>
      {back}
      <div className="stack" style={{ gap: 8, textAlign: "center", alignItems: "center", padding: "8px 0" }}>
        <Mascot width={120} />
        <div className="wordmark" style={{ fontSize: 52 }}>Found!</div>
        <p className="muted">All {plan.members.length} of you made it for {(info?.label ?? plan.activity).toLowerCase()}.</p>
      </div>
      <MemberChips members={plan.members} />
      <div className="card stack" style={{ gap: 10 }}>
        <div className="between"><h3>Icebreaker</h3><span className="pill">AI</span></div>
        <p className="hint" style={{ fontSize: 21 }}>{question}</p>
        <button className="btn soft sm" disabled={qBusy} onClick={another}>{qBusy ? <><span className="spinner" /> Thinking</> : "Another question"}</button>
      </div>
      <Link className="btn ghost block" href={`/rooms/${roomId}`}>Back to room</Link>
    </>
  );
}
