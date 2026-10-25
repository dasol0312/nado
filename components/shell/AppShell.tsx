"use client";

// The app column: full screen on a phone, centred on wider screens. Holds the push banner,
// the Nado! pop and the toast, which sit on top of whichever screen is showing.
import { useApp } from "./AppProvider";
import { Mascot } from "./icons";
import PushBanner from "./PushBanner";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { toastMsg, popping } = useApp();
  return (
    <div className="phone">
      <PushBanner />
      {children}
      {popping && (
        <div className="pop" aria-hidden="true"><Mascot width={150} /><b>Nado!</b></div>
      )}
      {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
    </div>
  );
}
