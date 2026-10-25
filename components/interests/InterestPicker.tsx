"use client";

// Interest chips grouped by category, a custom interest form, and the min-size sheet.
// Controlled: `value` in, onChange(value) out.
import { useState } from "react";
import { CATEGORIES, isPreset, MAX_INTERESTS } from "@/lib/catalog";
import { useApp } from "../shell/AppProvider";
import MinSizeSheet from "./MinSizeSheet";

export type Picked = { activity: string; min: number };

// show: "all" (every activity), "slots" (my picks as 3 slots, empty ones dashed), "picked", "unpicked"
export default function InterestPicker({ value, onChange, show = "all", onEmptySlot }: {
  value: Picked[]; onChange: (v: Picked[]) => void; show?: "all" | "slots" | "picked" | "unpicked"; onEmptySlot?: () => void;
}) {
  const { activities, act, reloadActivities, toast } = useApp();
  const full = value.length >= MAX_INTERESTS;
  const fullMsg = `You can pick up to ${MAX_INTERESTS}. Remove one to add another.`;
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
    if (full) return setMsg({ text: fullMsg, error: true });
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

  const labelOf = (name: string) => activities.find((a) => a.name === name)?.label ?? name;
  const empty = Math.max(0, MAX_INTERESTS - value.length);

  return (
    <>
      {show === "slots" && (
        <div className="slots">
          {value.map((v) => (
            <button key={v.activity} className="slot filled" onClick={() => setOpen(v.activity)}>
              <b>{labelOf(v.activity)}</b>
              <small>min {v.min}</small>
            </button>
          ))}
          {Array.from({ length: empty }, (_, i) => (
            <button key={`empty-${i}`} className="slot" onClick={onEmptySlot} aria-label="Empty slot. Pick an interest below">
              <span aria-hidden="true">+</span>
              <small>Empty</small>
            </button>
          ))}
        </div>
      )}
      {show !== "slots" && CATEGORIES.map((cat) => {
        const list = activities.filter((a) => a.category === cat && (show === "all" || (show === "picked") === !!picked(a.name)));
        // Place has no presets, so on the full list it shows a hint until someone adds a spot
        if (!list.length && !(cat === "Place" && show === "all")) return null;
        return (
          <div className="catgroup" key={cat}>
            <div className="eyebrow">{cat}</div>
            {!list.length && <p className="small muted">Places you like to hang out, like Washington Square Park or the High Line. Add one below.</p>}
            <div className="chips">
              {list.map((a) => {
                const t = picked(a.name);
                return (
                  <button key={a.name} className={`chip${t ? " on" : ""}${!t && full ? " off" : ""}`}
                    onClick={() => (!t && full ? toast(fullMsg) : setOpen(a.name))}>
                    {a.name}{t && <small>min {t.min}</small>}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
      {show !== "picked" && show !== "slots" && <form className="stack" onSubmit={addCustom} autoComplete="off">
        <label className="eyebrow" htmlFor="customKw">Add your own</label>
        <p className="small muted" style={{ marginTop: -4 }}>An activity or a place. Claude sorts it into a category.</p>
        <div className="row" style={{ flexWrap: "nowrap" }}>
          <input className="input" id="customKw" placeholder="e.g. badminton, Washington Square Park" maxLength={40} value={custom} onChange={(e) => setCustom(e.target.value)} />
          <button className="btn sm" type="submit" disabled={!!busy || full}>{busy ? <span className="spinner" /> : "Add"}</button>
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
            if (!picked(sheet.name) && full) return toast(fullMsg);
            onChange(picked(sheet.name) ? value.map((v) => (v.activity === sheet.name ? { ...v, min } : v)) : [...value, { activity: sheet.name, min }]);
            setOpen(null);
          }}
        />
      )}
    </>
  );
}
