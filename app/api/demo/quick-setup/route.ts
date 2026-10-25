import { NextResponse } from "next/server";
import { DEMO_CLASSES, DEMO_EMAIL, DEMO_INTERESTS } from "@/lib/demo";
import { dbError } from "@/lib/server/api";
import { demoOff } from "@/lib/server/demo";
import { startSession } from "@/lib/server/session";
import { studentForEmail } from "@/lib/server/students";
import { createClient } from "@/lib/supabase/server";

// Sign in as demo@nyu.edu with a filled-in profile (demo guide steps 1-4):
// the demo class schedule, 10-11 PM never free, Sat mornings never free, Fri 5-8 PM job,
// and ramen (min 2), boba (min 3), soccer (min 4).
export async function POST() {
  const off = demoOff();
  if (off) return off;
  const sb = await createClient();
  try {
    const me = await studentForEmail(sb, DEMO_EMAIL);
    const blocks = [
      ...DEMO_CLASSES.map((c) => ({ kind: "class", day_of_week: c.day, start_time: c.start, end_time: c.end, label: c.label })),
      ...[0, 1, 2, 3, 4, 5, 6].map((d) => ({ kind: "never", day_of_week: d, start_time: "22:00", end_time: "23:00", label: null })),
      { kind: "never", day_of_week: 6, start_time: "09:00", end_time: "11:00", label: null },
      { kind: "fixed", day_of_week: 5, start_time: "17:00", end_time: "20:00", label: "Campus job" },
    ].map((b) => ({ ...b, student_id: me.id }));

    for (const step of [
      () => sb.from("busy_blocks").delete().eq("student_id", me.id),
      () => sb.from("busy_blocks").insert(blocks),
      () => sb.from("interests").delete().eq("student_id", me.id),
      () => sb.from("interests").insert(DEMO_INTERESTS.map((i) => ({ student_id: me.id, activity: i.activity, min_size: i.min }))),
    ]) {
      const res = await step();
      if (res.error) throw new Error(res.error.message);
    }
    await startSession(me.id);
    return NextResponse.json({ ok: true, nickname: me.nickname, next: "/profile" });
  } catch (e) {
    return dbError(e);
  }
}
