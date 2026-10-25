import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { sessionStudentId } from "./session";

// For pages that need a signed-in student: their id, or a redirect to /login
export async function requireMe() {
  const id = await sessionStudentId();
  if (!id) redirect("/login");
  const sb = await createClient();
  const { data } = await sb.from("students").select("id").eq("id", id).maybeSingle();
  if (!data) redirect("/login"); // e.g. the database was reset
  return id;
}
