import { NextResponse } from "next/server";
import { CLOCK_PRESETS } from "@/lib/demo";
import { dbError, fail } from "@/lib/server/api";
import { demoOff } from "@/lib/server/demo";
import { createClient } from "@/lib/supabase/server";
import { campusInstant, campusToday, nextWeekday } from "@/lib/time";

// Set the shared demo clock. Body: { preset: "mon1150" | "tue1205" | "wed1505" | "real" }
// Both phones read app_clock, so they agree on "now".
export async function PUT(req: Request) {
  const off = demoOff();
  if (off) return off;
  const body = await req.json().catch(() => null);
  const preset = CLOCK_PRESETS.find((p) => p.id === body?.preset);
  if (!preset) return fail(400, "BAD_REQUEST", `preset must be one of: ${CLOCK_PRESETS.map((p) => p.id).join(", ")}.`);

  const base = preset.day === null ? null : campusInstant(nextWeekday(campusToday().date, preset.day), preset.time);
  const sb = await createClient();
  const res = await sb.from("app_clock").upsert({ id: 1, base, set_at: new Date().toISOString(), label: preset.day === null ? null : preset.label });
  if (res.error) return dbError(new Error(res.error.message));
  return NextResponse.json({ ok: true, base });
}
