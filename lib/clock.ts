// The demo clock. app_clock holds one row: when `base` is set, "now" is base plus
// the real time passed since `set_at`, so both phones see the same moment.
// Same rule as the DB function app_now() (supabase/migrations/20261025_match_helpers.sql), for the browser.
export type ClockRow = { base: string | null; set_at: string; label: string | null };

export function clockNow(row: ClockRow | null, real = Date.now()): Date {
  if (!row?.base) return new Date(real);
  return new Date(new Date(row.base).getTime() + (real - new Date(row.set_at).getTime()));
}
