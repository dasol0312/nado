// Inline icons from the prototype
export const PinIcon = () => (
  <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
    <path d="M8 1.5a4.5 4.5 0 0 0-4.5 4.5c0 3.2 4.5 8.5 4.5 8.5s4.5-5.3 4.5-8.5A4.5 4.5 0 0 0 8 1.5Zm0 6.2a1.7 1.7 0 1 1 0-3.4 1.7 1.7 0 0 1 0 3.4Z" />
  </svg>
);
const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;
export const BellIcon = () => (
  <svg viewBox="0 0 24 24" {...stroke} aria-hidden="true"><path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15L6 16Z" /><path d="M10 20.5a2.2 2.2 0 0 0 4 0" /></svg>
);
export const GroupIcon = () => (
  <svg viewBox="0 0 24 24" {...stroke} aria-hidden="true">
    <circle cx="9" cy="9" r="3.2" /><circle cx="17" cy="10" r="2.5" />
    <path d="M3.5 19c.6-3 2.8-4.6 5.5-4.6s4.9 1.6 5.5 4.6" /><path d="M15 15.2c2.6-.4 4.8.8 5.5 3.8" />
  </svg>
);
export const CalendarIcon = () => (
  <svg viewBox="0 0 24 24" {...stroke} aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2.5" /><path d="M4 10h16M9 3v4M15 3v4" /></svg>
);
export const UploadIcon = () => (
  <svg viewBox="0 0 24 24" {...stroke} aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M8 14l3-3 2 2 3-3 3 3" /><circle cx="8.5" cy="8.5" r="1.3" /></svg>
);
export const MailIcon = () => (
  <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="M3.5 6.5l8.5 6.5 8.5-6.5" />
  </svg>
);
export const HomeIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" {...stroke} aria-hidden="true"><path d="M4 11.5 12 5l8 6.5" /><path d="M6.5 10v9h11v-9" /><path d="M10 19v-5h4v5" /></svg>
);
export const BackIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
);

// The mascot. A plain <img>: it's a small local webp with a fixed width.
export function Mascot({ width, style }: { width: number; style?: React.CSSProperties }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="mascot" src="/mascot.webp" alt="" width={width} style={{ width, ...style }} />;
}
