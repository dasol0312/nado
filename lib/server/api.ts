import "server-only";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export type Db = Awaited<ReturnType<typeof createClient>>;

export const fail = (status: number, error: string, message: string) =>
  NextResponse.json({ error, message }, { status });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === "string" && UUID.test(v);

// Supabase returns at most 1,000 rows per request, and drops the rest without an error.
// Pages through a query until it's exhausted. Give the query a stable .order() so pages don't overlap.
type Page<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;
export async function selectAll<T>(page: (from: number, to: number) => Page<T>, size = 1000): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += size) {
    const { data, error } = await page(from, from + size - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < size) return rows;
  }
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
  return (res.data?.status as "invited" | "joined" | "declined" | undefined) ?? null;
}
