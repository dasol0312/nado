import { NextResponse } from "next/server";
import { dbError } from "@/lib/server/api";
import { demoOff } from "@/lib/server/demo";
import { endSession } from "@/lib/server/session";
import { createClient } from "@/lib/supabase/server";

// Demo "Start over" between judges: main's reset_demo() deletes rooms, chat, judge/real accounts,
// AI-added activities and Claude-picked places, and resets the clock. The 800 sample students stay.
// Then this browser is signed out.
export async function POST() {
  const off = demoOff();
  if (off) return off;
  const sb = await createClient();
  try {
    const res = await sb.rpc("reset_demo");
    if (res.error) throw new Error(res.error.message);
    await endSession();
    return NextResponse.json({ ok: true, deleted: res.data });
  } catch (e) {
    return dbError(e);
  }
}
