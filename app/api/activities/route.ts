import { NextResponse } from "next/server";
import { thinkAboutInterest, type InterestAnswer } from "@/lib/ai";
import { CATEGORIES, isPreset, type Category } from "@/lib/catalog";
import { dbError, fail, requireStudent } from "@/lib/server/api";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

// Add a custom interest. Body: { name, rethink? }
// Claude decides the category and the largest group of strangers it works for.
// Without Claude it's added as "Other", up to 4 people. Places stay empty: /api/match
// (lib/nado/plan.ts) picks them the first time a plan for it opens.
// rethink: true asks Claude again about a custom interest that already exists.
export async function POST(req: Request) {
  const me = await requireStudent();
  if ("error" in me) return me.error;
  const body = await req.json().catch(() => null);
  const raw = typeof body?.name === "string" ? body.name.trim().replace(/\s+/g, " ") : "";
  const rethink = body?.rethink === true;
  if (!raw || raw.length > 40) return fail(400, "BAD_REQUEST", "Name must be 1-40 characters.");
  const name = raw.toLowerCase();

  const sb = await createClient();
  try {
    const existing = await sb.from("activities").select("*").eq("name", name).maybeSingle();
    if (existing.error) throw new Error(existing.error.message);
    if (existing.data && !rethink) return NextResponse.json({ activity: existing.data, created: false });
    if (rethink && isPreset(name)) return fail(400, "BUILT_IN", "Built-in activities have fixed sizes.");

    const answer = await thinkAboutInterest({ name: raw, categories: CATEGORIES }).catch((e) => {
      console.error("[activities] Claude failed:", e);
      return null;
    });
    const v = checkAnswer(answer);
    const row = {
      label: v?.label || raw.charAt(0).toUpperCase() + raw.slice(1),
      category: v?.category ?? "Other",
      max_size: v?.max ?? 4,
      min_default: v?.min ?? 2,
      reason: v?.reason || null,
      by_ai: !!v,
    };

    const saved = existing.data
      ? await sb.from("activities").update(row).eq("name", name).select("*").single()
      : await sb.from("activities").insert({ ...row, name, created_by: me.studentId }).select("*").single();
    if (saved.error) throw new Error(saved.error.message);

    // A rethink can lower the max: nobody's minimum may stay above it
    if (existing.data) {
      const tooBig = await sb.from("interests").update({ min_size: row.max_size }).eq("activity", name).gt("min_size", row.max_size);
      if (tooBig.error) throw new Error(tooBig.error.message);
    }
    return NextResponse.json({ activity: saved.data, created: !existing.data });
  } catch (e) {
    return dbError(e);
  }
}

// Keep only answers that fit the rules in Nado 개발 명세서 (새 키워드 고민 · 검증)
function checkAnswer(a: InterestAnswer | null) {
  if (!a || !CATEGORIES.includes(a.cat)) return null;
  const max = Math.max(2, Math.min(12, Math.round(Number(a.max)) || 4));
  return {
    label: String(a.label || "").slice(0, 40),
    category: a.cat as Category,
    max,
    min: Math.max(2, Math.min(max, Math.round(Number(a.min)) || 2)),
    reason: String(a.reason || "").slice(0, 320),
  };
}
