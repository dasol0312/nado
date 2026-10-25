import { NextResponse } from "next/server";
import { fail } from "@/lib/server/api";
import { NYU_EMAIL } from "@/lib/server/students";
import { createClient } from "@/lib/supabase/server";

// Step 1 of sign-in: send a 6-digit code. Body: { email }
// Only @nyu.edu. Demo (default): nothing is sent and any 6 digits work.
// With NADO_EMAIL_OTP=1 Supabase Auth emails a real code (the email template must include {{ .Token }}).
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!NYU_EMAIL.test(email)) return fail(400, "BAD_EMAIL", "Use your NYU email (ending in @nyu.edu).");

  if (process.env.NADO_EMAIL_OTP !== "1") return NextResponse.json({ ok: true, demo: true });

  const sb = await createClient();
  const { error } = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (error) return fail(error.status === 429 ? 429 : 500, "OTP_FAILED", error.message);
  return NextResponse.json({ ok: true, demo: false });
}
