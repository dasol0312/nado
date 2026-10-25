// The demo clock. app_clock holds one row: when `base` is set, "now" is base plus
// the real time passed since `set_at`, so both phones see the same moment.
// Shared by the server (lib/server/clock.ts) and the browser (components/shell/AppProvider.tsx).
export type ClockRow = { base: string | null; set_at: string; label: string | null };

export function clockNow(row: ClockRow | null, real = Date.now()): Date {
  if (!row?.base) return new Date(real);
  return new Date(new Date(row.base).getTime() + (real - new Date(row.set_at).getTime()));
}
