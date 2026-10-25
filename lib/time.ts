// Campus local time helpers. Slots and dates are in campus time.
// Dates are "YYYY-MM-DD" strings; weeks start on Sunday.
export const CAMPUS_TZ = "America/New_York"; // NYU

export const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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

// Today's campus date and "HH:MM"
export function campusToday(from = new Date()) {
  return campusParts(from);
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

// "Sun 3:00 PM" in campus time
export function formatCampusTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: CAMPUS_TZ,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// "Oct 25"
export const formatDate = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric" });

// "10/25"
export const formatShortDate = (date: string) => {
  const [, m, d] = parseDate(date);
  return `${m}/${d}`;
};

// 15 -> "3 PM", 0 or 24 -> "12 AM"
export function formatHour(h: number) {
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12} ${h % 24 < 12 ? "AM" : "PM"}`;
}

export const toHHMM = (h: number) => `${pad(h)}:00`;
