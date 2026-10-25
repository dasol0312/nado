"use client";

// NYU email → 6-digit code. In demo mode no email is sent and any 6 digits work.
import { useState } from "react";
import { useApp } from "../shell/AppProvider";
import { BackIcon, Mascot, MailIcon } from "../shell/icons";
import { useGo } from "../shell/useGo";
import CodeInput from "./CodeInput";

export default function LoginFlow() {
  const { toast } = useApp();
  const go = useGo();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [demo, setDemo] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function post(path: string, body: unknown) {
    const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.message ?? "Something went wrong.");
    return json;
  }

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault();
    if (!/^[a-z0-9._%+-]+@nyu\.edu$/i.test(email.trim())) return setError("Use your NYU email (ending in @nyu.edu).");
    setBusy(true);
    setError("");
    try {
      const res = await post("/api/auth/start", { email });
      setDemo(!!res.demo);
      setStep("code");
      toast(`Code sent to ${email.trim()}${res.demo ? " (demo)" : ""}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function verify(code: string) {
    if (!/^\d{6}$/.test(code)) return setError("Enter all 6 digits.");
    setBusy(true);
    setError("");
    try {
      const res = await post("/api/auth/verify", { email, code });
      go(res.next);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  if (step === "code") {
    return (
      <>
        <div className="backbar"><button onClick={() => { setStep("email"); setError(""); }}><BackIcon />Change email</button></div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 22, padding: "8px 4px" }}>
          <div style={{ color: "var(--accent)" }}><MailIcon /></div>
          <div className="stack">
            <h1>Check your NYU inbox</h1>
            <p className="muted">We sent a 6-digit code to <b style={{ color: "var(--ink)" }}>{email}</b>. Enter it below to verify you’re an NYU student.</p>
          </div>
          <CodeInput bad={!!error} disabled={busy} onSubmit={verify} />
          {error && <p className="err">{error}</p>}
          <p className="small muted">Didn’t get it? <button type="button" className="link" onClick={() => sendCode()}>Resend code</button></p>
          {demo && (
            <div className="aibox" style={{ background: "var(--amber-soft)" }}>
              <span className="ai" style={{ background: "var(--amber)", color: "var(--card)" }}>DEMO</span>
              <div>No email is actually sent in the demo. Type any 6 digits.</div>
            </div>
          )}
        </div>
      </>
    );
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 28, padding: "20px 4px" }}>
      <div className="stack" style={{ gap: 14 }}>
        <div className="row" style={{ gap: 10, flexWrap: "nowrap", alignItems: "flex-end" }}>
          <Mascot width={104} />
          <div className="wordmark">Nado</div>
        </div>
        <p style={{ fontSize: 18, fontWeight: 500, textWrap: "balance" }}>Others ask, “Who’s in?”<br />You say: nado.</p>
        <p className="muted small">“Nado” means “me too” in Korean. We match NYU students who are free at the same time and like the same things. Only the AI sees your schedule and interests.</p>
      </div>
      <form className="stack" style={{ gap: 12 }} noValidate onSubmit={sendCode}>
        <div className="field">
          <label htmlFor="email">NYU email</label>
          <input className="input" id="email" type="email" inputMode="email" autoComplete="email" placeholder="netid@nyu.edu" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        {error && <p className="err">{error}</p>}
        <button className="btn block" type="submit" disabled={busy}>{busy ? <span className="spinner" /> : "Send verification code"}</button>
        <p className="small muted">Only @nyu.edu addresses can join.</p>
      </form>
    </div>
  );
}
