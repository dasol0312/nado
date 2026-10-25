import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

// Who is signed in on this browser: a signed cookie holding the student's id.
// Set after the NYU email code is verified (app/api/auth/verify).
export const SESSION_COOKIE = "nado_session";
const MAX_AGE = 60 * 60 * 24 * 30;

function secret() {
  const s = process.env.NADO_SESSION_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === "production") console.warn("[nado] NADO_SESSION_SECRET is not set; using the demo secret.");
  return "nado-demo-session-secret";
}

const sign = (value: string) => createHmac("sha256", secret()).update(value).digest("base64url");

export function readSession(raw: string | undefined): string | null {
  if (!raw) return null;
  const dot = raw.lastIndexOf(".");
  if (dot < 0) return null;
  const id = raw.slice(0, dot);
  const given = Buffer.from(raw.slice(dot + 1));
  const want = Buffer.from(sign(id));
  return given.length === want.length && timingSafeEqual(given, want) ? id : null;
}

// The signed-in student's id, or null
export async function sessionStudentId() {
  return readSession((await cookies()).get(SESSION_COOKIE)?.value);
}

// Route Handlers only (cookies can't be written from Server Components)
export async function startSession(studentId: string) {
  (await cookies()).set(SESSION_COOKIE, `${studentId}.${sign(studentId)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function endSession() {
  (await cookies()).delete(SESSION_COOKIE);
}
