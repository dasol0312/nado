import { NextResponse } from "next/server";
import { CLOCK_PRESETS } from "@/lib/demo";
import { dbError, fail } from "@/lib/server/api";
import { demoOff } from "@/lib/server/demo";
import { createClient } from "@/lib/supabase/server";
import { campusInstant, campusToday, formatShortDate, isDate, nextWeekday } from "@/lib/time";

// Set the shared demo clock. Body: { preset: "mon1150" | "tue1205" | "wed1505" | "real" }
// or { date: "YYYY-MM-DD", time: "HH:MM" } in campus time (the hidden clock sheet).
// Both phones read app_clock, so they agree on "now".
export async function PUT(req: Request) {
  const off = demoOff();
  if (off) return off;
  const body = await req.json().catch(() => null);
  const sb = await createClient();

  if (body?.date !== undefined || body?.time !== undefined) {
    const time = typeof body.time === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(body.time) ? body.time : null;
    if (!isDate(body.date) || !time) return fail(400, "BAD_REQUEST", "Send date as YYYY-MM-DD and time as HH:MM.");
    const base = campusInstant(body.date, time);
    const res = await sb.from("app_clock").upsert({ id: 1, base, set_at: new Date().toISOString(), label: `${formatShortDate(body.date)} ${time}` });
    if (res.error) return dbError(new Error(res.error.message));
    return NextResponse.json({ ok: true, base });
  }

  const preset = CLOCK_PRESETS.find((p) => p.id === body?.preset);
  if (!preset) return fail(400, "BAD_REQUEST", `preset must be one of: ${CLOCK_PRESETS.map((p) => p.id).join(", ")}.`);

  const base = preset.day === null ? null : campusInstant(nextWeekday(campusToday().date, preset.day), preset.time);
  const res = await sb.from("app_clock").upsert({ id: 1, base, set_at: new Date().toISOString(), label: preset.day === null ? null : preset.label });
  if (res.error) return dbError(new Error(res.error.message));
  return NextResponse.json({ ok: true, base });
}
