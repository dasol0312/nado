"use client";

import { colorName } from "@/lib/colors";

// Step 4: everyone's screen turns the room color so you can spot each other.
export default function ColorMatch({
  color,
  place,
  time,
  icebreaker,
  onClose,
}: {
  color: string;
  place: string;
  time: string;
  icebreaker: string | null;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 px-6 text-center text-white"
      style={{ background: color }}
      role="dialog"
      aria-label="Color Match"
    >
      <p className="text-sm font-bold tracking-[0.18em]">TIME TO MEET</p>
      <p className="text-3xl font-bold leading-tight">
        Meet at {place} at {time}.
        <br />
        Look for someone holding a {colorName(color)} screen!
      </p>
      {icebreaker && <p className="max-w-sm text-lg opacity-90">Icebreaker: {icebreaker}</p>}
      <button className="mt-6 rounded-full border-2 border-white px-5 py-2 font-semibold" onClick={onClose}>
        Back to room
      </button>
    </div>
  );
}
