"use client";

// Upload an Albert screenshot; Claude reads the classes (POST /api/schedule/read).
import type { Block } from "@/lib/schedule";
import { UploadIcon } from "../shell/icons";

export type ParseState =
  | { state: "idle" }
  | { state: "reading" }
  | { state: "done" }
  | { state: "error"; msg: string };

export default function AlbertUpload({
  parse, classes, onParse, onClasses,
}: {
  parse: ParseState;
  classes: Block[];
  onParse: (p: ParseState) => void;
  onClasses: (c: Block[]) => void;
}) {
  async function read(file: File | undefined) {
    if (!file) return;
    onParse({ state: "reading" });
    const form = new FormData();
    form.append("image", file);
    try {
      const res = await fetch("/api/schedule/read", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) return onParse({ state: "error", msg: json.message ?? "That image couldn't be read." });
      onClasses((json.classes as { label: string; day: number; start: string; end: string }[]).map((c) => ({ kind: "class", ...c })));
      onParse({ state: "done" });
    } catch {
      onParse({ state: "error", msg: "Couldn't reach the server. Try again." });
    }
  }

  return (
    <>
      <label className="upload" htmlFor="albert">
        <UploadIcon />
        <div>
          <h3>Upload your Albert schedule</h3>
          <p className="small muted">A screenshot of your class schedule. Claude reads it; we never ask for your Albert login.</p>
        </div>
        <input type="file" id="albert" accept="image/png,image/jpeg,image/webp" aria-label="Albert schedule screenshot"
          onChange={(e) => { read(e.target.files?.[0]); e.target.value = ""; }} />
      </label>
      {parse.state === "reading" && (
        <div className="aibox"><span className="spinner" style={{ color: "var(--accent)" }} /><div>Claude is reading your schedule screenshot…</div></div>
      )}
      {parse.state === "done" && (
        <div className="aibox">
          <span className="ai">AI</span>
          <div>Found {classes.length} class meetings and filled them in. Fix anything else below.</div>
        </div>
      )}
      {parse.state === "error" && <p className="err">{parse.msg}</p>}
    </>
  );
}
