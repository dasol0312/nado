import { NextResponse } from "next/server";
import { dbError } from "@/lib/server/api";
import { demoOff } from "@/lib/server/demo";
import { endSession } from "@/lib/server/session";
import { createClient } from "@/lib/supabase/server";

// Demo "Start over": delete every plan and the matching snapshot, put the clock back to
// real time, and sign this browser out. Profiles stay.
export async function POST() {
  const off = demoOff();
  if (off) return off;
  const sb = await createClient();
  try {
    const rooms = await sb.from("rooms").delete().not("id", "is", null);
    if (rooms.error) throw new Error(rooms.error.message);
    const slots = await sb.from("activity_slots").delete().not("id", "is", null);
    if (slots.error) throw new Error(slots.error.message);
    const clock = await sb.from("app_clock").update({ base: null, set_at: new Date().toISOString(), label: null }).eq("id", 1);
    if (clock.error) throw new Error(clock.error.message);
    await endSession();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return dbError(e);
  }
}
