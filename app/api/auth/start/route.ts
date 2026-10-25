import { NextResponse } from "next/server";
import { fail } from "@/lib/server/api";
import { ANY_EMAIL, NYU_EMAIL } from "@/lib/server/students";
import { createClient } from "@/lib/supabase/server";

// Step 1 of sign-in: send a 6-digit code. Body: { email, judge? }
// - NYU students: @nyu.edu only. With NADO_EMAIL_OTP=1 Supabase Auth emails the code
//   (the project's email template must include {{ .Token }}); otherwise demo mode: nothing is sent.
// - Judge mode (judge: true): any email, no email is sent, any 6 digits work.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const judge = body?.judge === true;
  if (judge ? !ANY_EMAIL.test(email) : !NYU_EMAIL.test(email)) {
    return fail(400, "BAD_EMAIL", judge ? "Enter a valid email." : "Use your NYU email (ending in @nyu.edu).");
  }
  // Judge mode skips the code, so it can't be used to get into a student's NYU account
  if (judge && NYU_EMAIL.test(email)) return fail(400, "USE_NYU_SIGNIN", "NYU students sign in with the code instead of Judge mode.");

  if (judge || process.env.NADO_EMAIL_OTP !== "1") return NextResponse.json({ ok: true, demo: true });

  const sb = await createClient();
  const { error } = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (error) return fail(error.status === 429 ? 429 : 500, "OTP_FAILED", error.message);
  return NextResponse.json({ ok: true, demo: false });
}
