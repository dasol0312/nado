import { redirect } from "next/navigation";
import { sessionStudentId } from "@/lib/server/session";
import { hasInterests } from "@/lib/server/students";
import { createClient } from "@/lib/supabase/server";

// Signed out → login; no interests yet → profile (where you set everything up); otherwise → matches
export default async function Home() {
  const id = await sessionStudentId();
  if (!id) redirect("/login");
  const sb = await createClient();
  const { data } = await sb.from("students").select("id").eq("id", id).maybeSingle();
  if (!data) redirect("/login");
  redirect((await hasInterests(sb, id)) ? "/matches" : "/profile");
}
