import "server-only";
import { randomNickname } from "@/lib/demo";
import type { Db } from "./api";

export const NYU_EMAIL = /^[a-z0-9._%+-]+@nyu\.edu$/i;
// Judge mode: any email (judges aren't NYU students)
export const ANY_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Find the student for this email, or create one with a random nickname
export async function studentForEmail(sb: Db, rawEmail: string, judge = false) {
  const email = rawEmail.trim().toLowerCase();
  const found = await sb.from("students").select("id, nickname").eq("email", email).maybeSingle();
  if (found.error) throw new Error(found.error.message);
  if (found.data) return { ...found.data, isNew: false };

  for (let tries = 0; tries < 8; tries++) {
    const nickname = tries < 6 ? randomNickname() : `${randomNickname()} ${Math.floor(Math.random() * 90 + 10)}`;
    const made = await sb.from("students").insert({ email, nickname, is_sample: false, is_judge: judge }).select("id, nickname").single();
    if (!made.error) return { ...made.data, isNew: true };
    if (made.error.code !== "23505") throw new Error(made.error.message); // 23505 = nickname taken, try another
    const raced = await sb.from("students").select("id, nickname").eq("email", email).maybeSingle();
    if (raced.data) return { ...raced.data, isNew: false };
  }
  throw new Error("Couldn't pick a free nickname. Try again.");
}

// Signed in but hasn't picked interests yet → land on Profile
export async function hasInterests(sb: Db, studentId: string) {
  const res = await sb.from("interests").select("activity", { count: "exact", head: true }).eq("student_id", studentId);
  if (res.error) throw new Error(res.error.message);
  return (res.count ?? 0) > 0;
}
