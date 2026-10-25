import "server-only";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export type Db = Awaited<ReturnType<typeof createClient>>;

export const fail = (status: number, error: string, message: string) =>
  NextResponse.json({ error, message }, { status });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === "string" && UUID.test(v);

// The student's status in a room, or null if they weren't invited
export async function membership(sb: Db, roomId: string, studentId: string) {
  const res = await sb
    .from("room_members")
    .select("status")
    .eq("room_id", roomId)
    .eq("student_id", studentId)
    .maybeSingle();
  if (res.error) throw new Error(res.error.message);
  return (res.data?.status as "invited" | "joined" | "declined" | undefined) ?? null;
}
