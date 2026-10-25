"use client";

// Interest chips grouped by category, a custom interest form, and the min-size sheet.
// Controlled: `value` in, onChange(value) out.
import { useState } from "react";
import { CATEGORIES, isPreset } from "@/lib/catalog";
import { useApp } from "../shell/AppProvider";
import MinSizeSheet from "./MinSizeSheet";

export type Picked = { activity: string; min: number };

// show: "all" (every activity), "picked" (my interests), "unpicked" (add more)
export default function InterestPicker({ value, onChange, show = "all" }: { value: Picked[]; onChange: (v: Picked[]) => void; show?: "all" | "picked" | "unpicked" }) {
  const { activities, act, reloadActivities } = useApp();
  const [open, setOpen] = useState<string | null>(null);
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; error: boolean } | null>(null);
  const [rethinking, setRethinking] = useState(false);

  async function rethink(name: string) {
    setRethinking(true);
    try {
      const res = await act("/api/activities", { name, rethink: true });
      const a = res.activity as { by_ai: boolean; category: string; max_size: number };
      await reloadActivities();
      const mine = value.find((v) => v.activity === name);
      if (mine && mine.min > a.max_size) onChange(value.map((v) => (v.activity === name ? { ...v, min: a.max_size } : v)));
      setMsg({ text: a.by_ai ? `Claude rethought it: ${a.category} · up to ${a.max_size} people` : "Claude isn't connected yet, so the defaults stay.", error: false });
    } catch (err) {
      setMsg({ text: (err as Error).message, error: true });
    } finally {
      setRethinking(false);
    }
  }

  const picked = (name: string) => value.find((v) => v.activity === name);
  const sheet = open ? activities.find((a) => a.name === open) : undefined;

  async function addCustom(e: React.FormEvent) {
    e.preventDefault();
    const name = custom.trim();
    if (!name) return;
    setBusy(name);
    setMsg(null);
    try {
      const res = await act("/api/activities", { name });
      const a = res.activity as { name: string; category: string; max_size: number; by_ai: boolean };
      await reloadActivities();
      setCustom("");
      setMsg({
        text: !res.created ? `${a.name} is already on the list.` : a.by_ai
          ? `Claude thought it through: ${a.category} · up to ${a.max_size} people`
          : `Added with defaults (${a.category}, up to ${a.max_size} people). Claude can set these once it's connected.`,
        error: false,
      });
      setOpen(a.name);
    } catch (err) {
      setMsg({ text: (err as Error).message, error: true });
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      {CATEGORIES.map((cat) => {
        const list = activities.filter((a) => a.category === cat && (show === "all" || (show === "picked") === !!picked(a.name)));
        if (!list.length) return null;
        return (
          <div className="catgroup" key={cat}>
            <div className="eyebrow">{cat}</div>
            <div className="chips">
              {list.map((a) => {
                const t = picked(a.name);
                return (
                  <button key={a.name} className={`chip${t ? " on" : ""}`} onClick={() => setOpen(a.name)}>
                    {a.name}{t && <small>min {t.min}</small>}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
      {show !== "picked" && <form className="stack" onSubmit={addCustom} autoComplete="off">
        <label className="eyebrow" htmlFor="customKw">Add your own</label>
        <div className="row" style={{ flexWrap: "nowrap" }}>
          <input className="input" id="customKw" placeholder="e.g. badminton, knitting" maxLength={40} value={custom} onChange={(e) => setCustom(e.target.value)} />
          <button className="btn sm" type="submit" disabled={!!busy}>{busy ? <span className="spinner" /> : "Add"}</button>
        </div>
        {busy && (
          <div className="aibox">
            <span className="spinner" style={{ color: "var(--accent)" }} />
            <div>Claude is thinking about <b>{busy}</b>: what it is, how many strangers it really works for, and where to meet on campus.</div>
          </div>
        )}
        {!busy && msg && <p className={`small ${msg.error ? "err" : "muted"}`}>{msg.text}</p>}
      </form>}
      {sheet && (
        <MinSizeSheet
          key={sheet.name}
          activity={sheet}
          initial={picked(sheet.name)?.min ?? Math.min(sheet.min_default, sheet.max_size)}
          exists={!!picked(sheet.name)}
          custom={!isPreset(sheet.name)}
          rethinking={rethinking}
          onRethink={() => rethink(sheet.name)}
          onClose={() => setOpen(null)}
          onRemove={() => { onChange(value.filter((v) => v.activity !== sheet.name)); setOpen(null); }}
          onSave={(min) => {
            onChange(picked(sheet.name) ? value.map((v) => (v.activity === sheet.name ? { ...v, min } : v)) : [...value, { activity: sheet.name, min }]);
            setOpen(null);
          }}
        />
      )}
    </>
  );
}
