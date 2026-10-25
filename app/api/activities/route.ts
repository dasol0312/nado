import { NextResponse } from "next/server";
import { thinkAboutInterest, type InterestAnswer } from "@/lib/ai";
import { CATALOG, CATEGORIES, CATEGORY_DEST, CATEGORY_MEET, type Category } from "@/lib/catalog";
import { EW_Y, NS_X, PLACES } from "@/lib/places";
import { dbError, fail, requireStudent, type Db } from "@/lib/server/api";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

// Add a custom interest. Body: { name, rethink? }
// Claude decides the category, the largest group of strangers it works for, where to meet on
// campus and where the activity happens (a known spot, or a real venue it suggests).
// Without Claude it's added as "Other", up to 4 people, meeting at Kimmel.
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
    if (rethink && CATALOG.some((a) => a.name === name)) return fail(400, "BUILT_IN", "Built-in activities have fixed sizes.");

    const answer = await thinkAboutInterest({
      name: raw,
      categories: CATEGORIES,
      campus: PLACES.filter((p) => p.campus).map((p) => ({ key: p.key, name: p.name })),
      places: PLACES.filter((p) => !p.campus).map((p) => ({ key: p.key, name: p.name, address: p.address })),
      nsStreets: Object.keys(NS_X),
      ewStreets: Object.keys(EW_Y),
    }).catch((e) => {
      console.error("[activities] Claude failed:", e);
      return null;
    });
    const v = checkAnswer(answer);
    const row = await toRow(sb, name, raw, v);

    const saved = existing.data
      ? await sb.from("activities").update(row).eq("name", name).select("*").single()
      : await sb.from("activities").insert({ ...row, name, created_by: me.studentId }).select("*").single();
    if (saved.error) throw new Error(saved.error.message);

    // A rethink can lower the max: nobody's minimum may stay above it
    if (existing.data) {
      const tooBig = await sb.from("interests").update({ min_size: row.max_size }).eq("activity", name).gt("min_size", row.max_size);
      if (tooBig.error) throw new Error(tooBig.error.message);
    }

    // So lib/nado's pickPlace picks this campus building as the meeting spot
    const meet = await sb.from("places").select("id, good_for").eq("id", row.meet_place_id).maybeSingle();
    if (meet.error) throw new Error(meet.error.message);
    if (meet.data && !meet.data.good_for.includes(name)) {
      const upd = await sb.from("places").update({ good_for: [...meet.data.good_for, name] }).eq("id", meet.data.id);
      if (upd.error) throw new Error(upd.error.message);
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
    meet: PLACES.find((p) => p.key === a.meet && p.campus)?.key ?? CATEGORY_MEET[a.cat as Category],
    place: PLACES.find((p) => p.key === a.place)?.key ?? null, // only places we already know
    venue: a.venue && a.venue.name ? a.venue : null,
    reason: String(a.reason || "").slice(0, 320),
  };
}

async function toRow(sb: Db, name: string, raw: string, v: ReturnType<typeof checkAnswer>) {
  const category = v?.category ?? "Other";
  const meetKey = v?.meet ?? CATEGORY_MEET[category];
  const ids = await sb.from("places").select("id, key").in("key", [meetKey, v?.place ?? CATEGORY_DEST[category]]);
  if (ids.error) throw new Error(ids.error.message);
  const id = (k: string) => ids.data.find((p) => p.key === k)?.id ?? null;

  let dest = id(v?.place ?? CATEGORY_DEST[category]);
  if (v && !v.place && v.venue) dest = await saveVenue(sb, name, v.venue);
  return {
    label: v?.label || raw.charAt(0).toUpperCase() + raw.slice(1),
    category,
    max_size: v?.max ?? 4,
    min_default: v?.min ?? 2,
    meet_place_id: id(meetKey),
    dest_place_id: dest ?? id(meetKey),
    reason: v?.reason || null,
    by_ai: !!v,
  };
}

// A venue Claude suggested becomes its own place, pinned on the map by its streets
async function saveVenue(sb: Db, name: string, venue: NonNullable<InterestAnswer["venue"]>) {
  const key = `ai_${name.replace(/[^a-z0-9]+/g, "_")}`.slice(0, 40);
  const res = await sb.from("places").upsert({
    key,
    name: String(venue.name).slice(0, 40),
    address: String(venue.address || "near Washington Square").slice(0, 60),
    is_campus: false,
    ns_street: NS_X[venue.ns] !== undefined ? venue.ns : null,
    ew_street: EW_Y[venue.ew] !== undefined ? venue.ew : null,
    far: ["N", "S", "E", "W"].includes(venue.far) ? venue.far : "",
    confident: venue.confident !== false,
  }, { onConflict: "key" }).select("id").single();
  if (res.error) throw new Error(res.error.message);
  return res.data.id as string;
}
