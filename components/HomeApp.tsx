"use client";

import { useState } from "react";
import ActivityPlanner from "./ActivityPlanner";
import DemoControls from "./DemoControls";
import Invitations from "./Invitations";
import StudentPicker from "./StudentPicker";
import { useStudent } from "./useStudent";

type Tab = "times" | "invites";

export default function HomeApp() {
  const [studentId, setStudentId] = useStudent();
  const [tab, setTab] = useState<Tab>("times");
  const [pending, setPending] = useState(0);

  const tabClass = (t: Tab) =>
    `flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${tab === t ? "bg-white shadow-sm" : "opacity-70"}`;

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-8">
      <header>
        <p className="text-xs font-bold tracking-[0.18em]">ME TOO. LET&apos;S DO IT.</p>
        <h1 className="text-6xl font-bold tracking-tighter">
          nado<span className="text-[#e77747]">!</span>
        </h1>
        <p className="mt-2 opacity-80">Pick what you want to do and paint the hours you&apos;re free. Claude does the asking.</p>
      </header>

      <StudentPicker studentId={studentId} onChange={setStudentId} />

      {studentId ? (
        <div className="flex flex-col gap-4">
          <div role="tablist" aria-label="nado" className="flex gap-1 rounded-xl bg-[#e3e8e3] p-1">
            <button role="tab" aria-selected={tab === "times"} className={tabClass("times")} onClick={() => setTab("times")}>
              My times
            </button>
            <button role="tab" aria-selected={tab === "invites"} className={tabClass("invites")} onClick={() => setTab("invites")}>
              Invitations
              {pending > 0 && (
                <span className="ml-2 rounded-full bg-[#e77747] px-2 py-0.5 text-xs text-white">{pending}</span>
              )}
            </button>
          </div>

          {/* Both stay mounted so invitations keep updating live and unsaved paint isn't lost */}
          <div role="tabpanel" hidden={tab !== "times"}>
            <ActivityPlanner key={studentId} studentId={studentId} />
          </div>
          <div role="tabpanel" hidden={tab !== "invites"}>
            <Invitations key={`inv-${studentId}`} studentId={studentId} onPendingChange={setPending} />
          </div>
        </div>
      ) : (
        <p className="text-sm opacity-70">Pick a demo student to start.</p>
      )}

      <DemoControls />
    </div>
  );
}
