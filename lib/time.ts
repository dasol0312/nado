// Campus local time helpers (NYU, New York). Slots and dates are in campus time.
// Dates are "YYYY-MM-DD" strings; day 0 is Sunday and weeks start on Sunday.
// app/api/open-rooms imports addDays, campusInstant, campusToday, dayOfWeek, isDate, weekStartOf.
export const CAMPUS_TZ = "America/New_York";

export const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
// The schedule grid shows Monday first; these are day_of_week values in that order
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

// Matching and the schedule grid cover 9 AM to 11 PM
export const DAY_START = 9 * 60;
export const DAY_END = 23 * 60;
// Plans start within this many minutes from now
export const HORIZON_MINUTES = 4 * 60;

const pad = (n: number) => String(n).padStart(2, "0");
const parseDate = (date: string) => date.split("-").map(Number) as [number, number, number];

function campusParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CAMPUS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

// Campus date and "HH:MM" at a moment (now by default)
export function campusToday(from = new Date()) {
  return campusParts(from);
}

// Campus date, weekday (0 = Sunday) and minutes since midnight at a moment
export function campusClock(at: Date) {
  const { date, time } = campusParts(at);
  return { date, time, day: dayOfWeek(date), minutes: toMinutes(time) };
}

export function addDays(date: string, n: number) {
  const [y, m, d] = parseDate(date);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

// 0 = Sunday
export function dayOfWeek(date: string) {
  const [y, m, d] = parseDate(date);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

// The Sunday that starts this date's week
export const weekStartOf = (date: string) => addDays(date, -dayOfWeek(date));

// The next date (today included) that falls on this weekday
export const nextWeekday = (from: string, day: number) => addDays(from, (day - dayOfWeek(from) + 7) % 7);

export const isDate = (v: unknown): v is string =>
  typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && addDays(v, 0) === v;

// Campus UTC offset in minutes at a moment, e.g. -240 for EDT
function offsetMinutes(at: Date) {
  const name = new Intl.DateTimeFormat("en-US", { timeZone: CAMPUS_TZ, timeZoneName: "longOffset" })
    .formatToParts(at)
    .find((x) => x.type === "timeZoneName")?.value;
  const m = name?.match(/GMT([+-])(\d{2}):(\d{2})/);
  if (!m) return 0;
  return (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3]));
}

// ISO timestamp for a campus date at "HH:MM"
export function campusInstant(date: string, hhmm: string) {
  const [y, m, d] = parseDate(date);
  const [h, min] = hhmm.split(":").map(Number);
  const asUtc = Date.UTC(y, m - 1, d, h, min);
  return new Date(asUtc - offsetMinutes(new Date(asUtc)) * 60_000).toISOString();
}

// "HH:MM" or "HH:MM:SS" -> minutes since midnight
export const toMinutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
};
// minutes -> "HH:MM"
export const minutesToHHMM = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;

const h12 = (h: number) => ((h + 11) % 12) + 1;
const half = (h: number) => (h % 24 < 12 ? "am" : "pm");

// 690 -> "11:30am", 720 -> "12pm"
export function formatMinutes(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h12(h)}${m ? `:${pad(m)}` : ""}${half(h)}`;
}

// 690, 750 -> "11:30am–12:30pm"; 780, 840 -> "1–2pm"
export function formatRange(a: number, b: number) {
  const same = half(Math.floor(a / 60)) === half(Math.floor(b / 60));
  return `${same ? formatMinutes(a).replace(/am|pm/, "") : formatMinutes(a)}–${formatMinutes(b)}`;
}

// 15 -> "3p" (grid row labels)
export const formatGridHour = (h: number) => `${h12(h)}${h < 12 ? "a" : "p"}`;

// "10/25"
export const formatShortDate = (date: string) => {
  const [, m, d] = parseDate(date);
  return `${m}/${d}`;
};
