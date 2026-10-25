import "server-only";
import { NextResponse } from "next/server";
import { clockNow, type ClockRow } from "@/lib/clock";
import { createClient } from "@/lib/supabase/server";
import type { MemberStatus } from "@/types/database";
import { sessionStudentId } from "./session";

export type Db = Awaited<ReturnType<typeof createClient>>;

export const fail = (status: number, error: string, message: string) =>
  NextResponse.json({ error, message }, { status });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === "string" && UUID.test(v);

// The signed-in student, or a 401 response to return
export async function requireStudent(): Promise<{ studentId: string } | { error: NextResponse }> {
  const studentId = await sessionStudentId();
  if (!studentId || !isUuid(studentId)) return { error: fail(401, "SIGNED_OUT", "Sign in with your NYU email first.") };
  return { studentId };
}

// The student's status in a room, or null if they weren't invited
export async function membership(sb: Db, roomId: string, studentId: string) {
  const res = await sb
    .from("room_members")
    .select("status")
    .eq("room_id", roomId)
    .eq("student_id", studentId)
    .maybeSingle();
  if (res.error) throw new Error(res.error.message);
  return (res.data?.status as MemberStatus | undefined) ?? null;
}

// "Now" on the demo clock (real time when the clock isn't set)
export async function demoNow(sb: Db) {
  const { data, error } = await sb.from("app_clock").select("base, set_at, label").eq("id", 1).maybeSingle();
  if (error) throw new Error(error.message);
  return clockNow(data as ClockRow | null);
}

export const dbError = (e: unknown) => fail(500, "DB_ERROR", (e as Error).message);
