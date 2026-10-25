import { NextResponse } from "next/server";
import { AiError, readAlbertSchedule } from "@/lib/ai";
import { fail, requireStudent } from "@/lib/server/api";

export const maxDuration = 60;
const TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const TIME = /^([01]?\d|2[0-3]):[0-5]\d$/;
const DAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

// Read an Albert schedule screenshot. Form data: image (PNG/JPG/WebP, up to 5 MB)
// Returns { classes: [{ label, day: 0-6, start, end }] }. Nothing is saved here;
// the screen shows the classes and saves them with PUT /api/profile/schedule.
// Errors (code → what the student sees):
//   AI_UNAVAILABLE      Claude isn't connected
//   IMAGES_UNAVAILABLE  Claude is connected but can't take images here
//   NO_CLASSES          not a schedule / nothing recognised
//   IMAGE_REJECTED      Claude refused or couldn't use the image
export async function POST(req: Request) {
  const me = await requireStudent();
  if ("error" in me) return me.error;
  const form = await req.formData().catch(() => null);
  const file = form?.get("image");
  if (!(file instanceof File) || !TYPES.has(file.type)) return fail(400, "IMAGE_REJECTED", "Upload a PNG or JPG screenshot.");
  if (file.size > 5 * 1024 * 1024) return fail(400, "IMAGE_REJECTED", "That image is over 5 MB. Crop it to the schedule.");

  const data = Buffer.from(await file.arrayBuffer()).toString("base64");
  let classes;
  try {
    classes = await readAlbertSchedule({ data, mediaType: file.type });
  } catch (e) {
    console.error("[schedule/read]", e);
    const code = e instanceof AiError ? e.code : "failed";
    if (code === "images_unavailable") return fail(503, "IMAGES_UNAVAILABLE", "Claude is connected, but images can’t be sent from here. Paint your class hours as Fixed below instead.");
    if (code === "rejected") return fail(422, "IMAGE_REJECTED", "Claude couldn’t use that image. Upload a PNG or JPG screenshot of your Albert schedule.");
    if (code === "rate_limited") return fail(429, "RATE_LIMITED", "Too many requests right now. Try again in a minute.");
    return fail(502, "AI_FAILED", "Claude didn’t answer. Try again, or paint your class hours as Fixed below.");
  }
  if (classes === null) {
    return fail(503, "AI_UNAVAILABLE", "Claude isn’t connected yet, so screenshots can’t be read. Paint your class hours as Fixed below instead.");
  }
  const ok = (Array.isArray(classes) ? classes : [])
    .filter((c) => c && DAYS[c.day] !== undefined && TIME.test(c.start) && TIME.test(c.end) && c.end.padStart(5, "0") > c.start.padStart(5, "0"))
    .map((c) => ({ label: String(c.course || "Class").slice(0, 60), day: DAYS[c.day], start: c.start.padStart(5, "0"), end: c.end.padStart(5, "0") }));
  if (!ok.length) return fail(422, "NO_CLASSES", "No classes found in that image. Take a screenshot that shows days and times.");
  return NextResponse.json({ classes: ok });
}
