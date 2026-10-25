import { NextResponse } from "next/server";
import { dbError, fail } from "@/lib/server/api";
import { startSession } from "@/lib/server/session";
import { hasInterests, NYU_EMAIL, studentForEmail } from "@/lib/server/students";
import { createClient } from "@/lib/supabase/server";

// Step 2 of sign-in: check the 6-digit code and sign this browser in. Body: { email, code }
// Demo (default): any 6 digits. New students land on Profile; returning ones on Matches.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const code = typeof body?.code === "string" ? body.code.trim() : "";
  if (!NYU_EMAIL.test(email)) return fail(400, "BAD_EMAIL", "Use your NYU email (ending in @nyu.edu).");
  if (!/^\d{6}$/.test(code)) return fail(400, "BAD_CODE", "Enter all 6 digits.");

  const sb = await createClient();
  if (process.env.NADO_EMAIL_OTP === "1") {
    const { error } = await sb.auth.verifyOtp({ email, token: code, type: "email" });
    if (error) return fail(400, "WRONG_CODE", "That code didn't work. Check the latest email or resend.");
  }

  try {
    const student = await studentForEmail(sb, email);
    await startSession(student.id);
    return NextResponse.json({ ok: true, nickname: student.nickname, next: (await hasInterests(sb, student.id)) ? "/matches" : "/profile" });
  } catch (e) {
    return dbError(e);
  }
}
