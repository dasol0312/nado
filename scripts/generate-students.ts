// Virtual NYU campus: generates the sample students the judge gets matched with.
//
//   npm run seed:students                 write 800 students to Supabase (.env.local keys)
//   npm run seed:students -- --count 300  fewer students
//   npm run seed:students -- --sql out    write out/campus.sql instead (paste into the SQL Editor)
//                                         add --parts 4 to split it into smaller files
//   npm run seed:students -- --dry        only print what would be generated
//
// What it writes
//   activities   16 presets + 3 synthetic Place interests (insert missing; keep existing AI metadata)
//   students     'Coral Owl'-style nicknames, is_sample = true, no email
//   busy_blocks  class:  3–5 courses (major + core), NYU-style 75-min MW/TR blocks, some MWF 50-min,
//                        Friday recitations for STEM, evening seminars/labs
//                fixed:  part-time job (2 shifts), club (1 evening), internship (2 weekdays)
//                never:  Sunday sleep-in, early nights, commuters, Saturdays away, Friday nights
//   interests    2–3 per student with each student's own minimum group size, tilted by major
//
// Deterministic: every random choice comes from md5(n + salt), so the same command always
// produces the same campus, with the same student ids. Re-running refreshes generated sample schedules/preferences without deleting
// student rows, room memberships, or messages; real sign-ups are left alone.
// Requires schema v4.1 plus the Place category migration. Uses a service key if set,
// otherwise the publishable/legacy anon key
// (works only while the demo RLS policies are open).

import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createClient } from "@supabase/supabase-js";
import { ACTIVITY_CATALOG, type PresetActivity } from "../lib/activities";

// Synthetic place interests model students entering their own favorite hangout.
// These are sample preferences, not new built-in app presets or verified venues.
const SAMPLE_CATALOG: PresetActivity[] = [
  ...ACTIVITY_CATALOG,
  { name: "washington square park", label: "Washington Square Park", category: "Place", maxSize: 6, minDefault: 2 },
  { name: "bobst library", label: "Bobst Library", category: "Place", maxSize: 4, minDefault: 2 },
  { name: "high line", label: "High Line", category: "Place", maxSize: 6, minDefault: 2 },
];

// ---------- deterministic randomness ----------

const md5 = (s: string) => createHash("md5").update(s).digest("hex");
/** A fixed "random" number in [0, 1) for this student and purpose */
const rnd = (n: number, salt: string) => parseInt(md5(`${n}:${salt}`).slice(0, 8), 16) / 2 ** 32;
const pick = <T>(items: readonly T[], r: number) => items[Math.floor(r * items.length)];
/** Weighted sampling without replacement (exponential race) */
function sample<T>(items: readonly T[], k: number, n: number, salt: string, key: (t: T) => string, weight: (t: T) => number) {
  return items
    .map((t) => ({ t, score: -Math.log(1 - rnd(n, `${salt}:${key(t)}`)) / weight(t) }))
    .sort((a, b) => a.score - b.score || key(a.t).localeCompare(key(b.t)))
    .slice(0, k)
    .map((x) => x.t);
}
const uuidFrom = (s: string) => {
  const h = md5(s);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
};

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const toHHMM = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

// ---------- campus data ----------

type Major = {
  key: string;
  weight: number;
  courses: string[];
  evening?: string; // evening seminar or lab
  stem: boolean;    // has Friday recitations
  boost: string[];  // activities this major likes a bit more
};

const MAJORS: Major[] = [
  { key: "cs", weight: 14, stem: true, boost: ["board games", "chess", "boba", "homework"],
    evening: "CSCI-UA 480 Special Topics Seminar",
    courses: ["CSCI-UA 101 Intro to Computer Science", "CSCI-UA 102 Data Structures", "CSCI-UA 201 Computer Systems Organization",
      "CSCI-UA 202 Operating Systems", "CSCI-UA 310 Basic Algorithms", "MATH-UA 120 Discrete Mathematics"] },
  { key: "math", weight: 6, stem: true, boost: ["chess", "homework", "study", "coffee"],
    courses: ["MATH-UA 121 Calculus I", "MATH-UA 122 Calculus II", "MATH-UA 123 Calculus III", "MATH-UA 140 Linear Algebra",
      "MATH-UA 235 Probability and Statistics", "MATH-UA 325 Analysis"] },
  { key: "econ", weight: 12, stem: true, boost: ["coffee", "basketball", "study"],
    courses: ["ECON-UA 1 Intro to Macroeconomics", "ECON-UA 2 Intro to Microeconomics", "ECON-UA 10 Intermediate Microeconomics",
      "ECON-UA 12 Intermediate Macroeconomics", "ECON-UA 18 Statistics", "ECON-UA 266 Econometrics"] },
  { key: "stern", weight: 14, stem: false, boost: ["coffee", "korean food", "basketball"],
    evening: "MULT-UB 100 Business and Its Publics",
    courses: ["ACCT-UB 1 Principles of Financial Accounting", "MKTG-UB 1 Introduction to Marketing", "FINC-UB 2 Foundations of Finance",
      "STAT-UB 103 Statistics for Business Control", "ECON-UB 1 Microeconomics", "MGMT-UB 1 Management and Organizations"] },
  { key: "psych", weight: 9, stem: false, boost: ["museum", "coffee", "bakery"],
    evening: "PSYCH-UA 300 Advanced Seminar",
    courses: ["PSYCH-UA 1 Intro to Psychology", "PSYCH-UA 10 Statistics for the Behavioral Sciences", "PSYCH-UA 25 Research Methods",
      "PSYCH-UA 29 Cognitive Neuroscience", "PSYCH-UA 32 Social Psychology"] },
  { key: "bio", weight: 9, stem: true, boost: ["study", "running", "ramen"],
    evening: "CHEM-UA 126 General Chemistry Lab",
    courses: ["BIOL-UA 11 Principles of Biology I", "BIOL-UA 12 Principles of Biology II", "CHEM-UA 125 General Chemistry I",
      "CHEM-UA 225 Organic Chemistry I", "PHYS-UA 11 General Physics I"] },
  { key: "film", weight: 8, stem: false, boost: ["movie", "museum", "pizza"],
    evening: "FMTV-UT 1101 Production Workshop",
    courses: ["FMTV-UT 1001 Sight and Sound: Filmmaking", "CINE-UT 10 Language of Film", "CINE-UT 15 Film History",
      "DRLIT-UA 101 Introduction to Theatre Studies", "FMTV-UT 1015 Screenwriting"] },
  { key: "politics", weight: 6, stem: false, boost: ["coffee", "museum", "soccer"],
    evening: "POL-UA 990 Senior Seminar",
    courses: ["POL-UA 100 Political Theory", "POL-UA 300 Comparative Politics", "POL-UA 500 International Politics",
      "POL-UA 800 Power and Politics in America"] },
  { key: "ds", weight: 6, stem: true, boost: ["boba", "board games", "homework"],
    courses: ["DS-UA 111 Data Science for Everyone", "DS-UA 112 Principles of Data Science", "DS-UA 201 Causal Inference",
      "MATH-UA 140 Linear Algebra", "CSCI-UA 101 Intro to Computer Science"] },
  { key: "mcc", weight: 6, stem: false, boost: ["movie", "boba", "bakery"],
    evening: "MCC-UE 1999 Media Seminar",
    courses: ["MCC-UE 1 Introduction to Media Studies", "MCC-UE 14 Media, Culture and Communication", "MCC-UE 1014 Digital Media",
      "MCC-UE 1306 Media and Globalization"] },
  { key: "gls", weight: 5, stem: false, boost: ["museum", "korean food", "running"],
    courses: ["GLS-UF 101 Global Works and Society", "GLS-UF 201 Cultural Foundations", "GLS-UF 301 Social Foundations",
      "GLS-UF 401 Global Topics"] },
  { key: "undeclared", weight: 5, stem: false, boost: ["pizza", "boba", "soccer"],
    courses: ["CORE-UA 300 Quantitative Reasoning", "PSYCH-UA 1 Intro to Psychology", "ECON-UA 2 Intro to Microeconomics",
      "CINE-UT 10 Language of Film"] },
];

const CORE = ["EXPOS-UA 1 Writing as Inquiry", "CORE-UA 400 Texts and Ideas", "CORE-UA 500 Cultures and Contexts",
  "CORE-UA 700 Expressive Culture", "CORE-UA 200 Physical Science", "CORE-UA 100 Societies and the Social Sciences",
  "KORE-UA 1 Elementary Korean I", "SPAN-UA 1 Elementary Spanish I", "ARTH-UA 10 History of Western Art"];

// NYU 75-minute blocks; lunchtime is busiest
const CLASS_STARTS = ["08:00", "09:30", "11:00", "12:30", "14:00", "15:30", "16:55"];
const CLASS_START_WEIGHT = [0.25, 1.0, 1.3, 1.3, 1.25, 1.05, 0.55];

// How popular each preset is across campus
const POPULARITY: Record<string, number> = {
  boba: 1.4, coffee: 1.3, study: 1.3, pizza: 1.0, ramen: 1.0, movie: 0.9, homework: 0.9, basketball: 0.8,
  "korean food": 0.8, soccer: 0.7, running: 0.7, museum: 0.7, "board games": 0.6, bakery: 0.6, climbing: 0.4, chess: 0.4,
};

const JOBS = ["Café shift", "Campus job: Bobst front desk", "Tutoring", "Retail shift", "Dining hall shift", "Babysitting"];
const SHIFTS: [number, string, string][] = [
  [5, "16:00", "21:00"], [6, "10:00", "16:00"], [6, "12:00", "18:00"], [0, "11:00", "17:00"], [0, "13:00", "19:00"],
  [1, "18:30", "22:00"], [2, "18:30", "22:00"], [3, "18:30", "22:00"], [4, "18:30", "22:00"], [5, "12:00", "16:00"],
];
const CLUBS = ["Korean Student Association", "Dance team practice", "Model UN", "Tech@NYU meeting", "A cappella rehearsal",
  "Photography club", "Outdoors club", "Robotics club", "Chinese Students and Scholars Association", "Student government"];

// 40 × 40 = 1600 nicknames; samples use 800 of them, the rest are left for judges
const ADJ = ["Violet", "Yellow", "Green", "Blue", "Orange", "Pink", "Silver", "Coral", "Mint", "Lavender",
  "Sky", "Amber", "Golden", "Crimson", "Teal", "Indigo", "Ruby", "Jade", "Peach", "Lemon",
  "Olive", "Cobalt", "Scarlet", "Ivory", "Plum", "Sage", "Rose", "Copper", "Azure", "Honey",
  "Maple", "Cherry", "Cocoa", "Pearl", "Navy", "Lime", "Sunny", "Misty", "Cosmic", "Rusty"];
const ANIMALS = ["Otter", "Penguin", "Hedgehog", "Raccoon", "Squirrel", "Owl", "Panda", "Fox", "Cat", "Rabbit",
  "Alpaca", "Koala", "Hamster", "Duck", "Seal", "Beaver", "Badger", "Lynx", "Heron", "Robin",
  "Sparrow", "Dolphin", "Turtle", "Gecko", "Llama", "Moose", "Bison", "Puffin", "Lemur", "Ferret",
  "Walrus", "Falcon", "Pelican", "Chipmunk", "Mole", "Quokka", "Capybara", "Wombat", "Narwhal", "Tiger"];
const NICKNAME_COUNT = ADJ.length * ANIMALS.length;
/** Nickname number i (0..1599); multiplying by 613 spreads neighbors across the list */
const nicknameAt = (i: number) => {
  const j = (i * 613) % NICKNAME_COUNT;
  return `${ADJ[Math.floor(j / ANIMALS.length)]} ${ANIMALS[j % ANIMALS.length]}`;
};

// ---------- one student ----------

type Kind = "class" | "fixed" | "never";
type Block = { kind: Kind; day: number; start: string; end: string; label: string }; // day 0 = Sunday
type SampleStudent = {
  n: number;
  id: string;
  nickname: string;
  major: string;
  blocks: Block[];
  interests: { activity: string; minSize: number }[];
};

function generateStudent(n: number): SampleStudent {
  const totalWeight = MAJORS.reduce((s, m) => s + m.weight, 0);
  let acc = 0;
  const rMajor = rnd(n, "major") * totalWeight;
  const major = MAJORS.find((m) => (acc += m.weight) > rMajor) ?? MAJORS[MAJORS.length - 1];

  const rc = rnd(n, "ncourses");
  const nCourses = rc < 0.15 ? 3 : rc < 0.75 ? 4 : 5;
  const ri = rnd(n, "ninterests");
  const nInterests = ri < 0.4 ? 2 : 3; // Current app limit: 3

  const blocks: Block[] = [];

  // Classes: courses (major ×3 weight, core ×1) paired with distinct time slots (7 MW + 7 TR)
  const pool = [...major.courses.map((label) => ({ label, w: 3 })), ...CORE.map((label) => ({ label, w: 1 }))];
  const courses = sample(pool, nCourses, n, "course", (c) => c.label, (c) => c.w);
  const slots = sample([...Array(14).keys()], nCourses, n, "slot", String, (k) => CLASS_START_WEIGHT[k % 7]);
  const mwfSlots = new Set<number>();
  courses.forEach((c, i) => {
    const tr = slots[i] >= 7;
    const t = slots[i] % 7;
    const mwf = !tr && rnd(n, `mwf:${c.label}`) < 0.25;
    if (mwf) mwfSlots.add(t);
    const start = CLASS_STARTS[t];
    const end = toHHMM(toMin(start) + (mwf ? 50 : 75));
    for (const day of tr ? [2, 4] : mwf ? [1, 3, 5] : [1, 3]) blocks.push({ kind: "class", day, start, end, label: c.label });
  });

  // Friday recitation for STEM majors (60%), not on top of their MWF classes
  const majorCourse = courses.filter((c) => major.courses.includes(c.label)).map((c) => c.label).sort()[0];
  if (major.stem && majorCourse && rnd(n, "recitation") < 0.6) {
    const t = [1, 2, 3, 4, 5].filter((x) => !mwfSlots.has(x)).sort((a, b) => rnd(n, `rec:${a}`) - rnd(n, `rec:${b}`))[0];
    const start = CLASS_STARTS[t];
    const code = majorCourse.split(" ").slice(0, 2).join(" ");
    blocks.push({ kind: "class", day: 5, start, end: toHHMM(toMin(start) + 75), label: `${code} Recitation` });
  }

  // Evening seminar or lab (30% of majors that have one), Mon–Thu
  if (major.evening && rnd(n, "evening") < 0.3) {
    blocks.push({ kind: "class", day: 1 + Math.floor(rnd(n, "eveday") * 4), start: "18:30", end: "21:00", label: major.evening });
  }

  // Part-time job (35%): two shifts
  if (rnd(n, "job") < 0.35) {
    const job = pick(JOBS, rnd(n, "jobtype"));
    for (const [day, start, end] of sample(SHIFTS, 2, n, "shift", (s) => s.join(), () => 1)) {
      blocks.push({ kind: "fixed", day, start, end, label: job });
    }
  }

  // Club (40%): one weeknight
  if (rnd(n, "club") < 0.4) {
    const early = rnd(n, "clubtime") < 0.5;
    blocks.push({ kind: "fixed", day: 1 + Math.floor(rnd(n, "clubday") * 4), start: early ? "19:00" : "20:00",
      end: early ? "20:30" : "21:30", label: pick(CLUBS, rnd(n, "clubname")) });
  }

  // Internship (12%): two weekdays, morning or afternoon
  if (rnd(n, "intern") < 0.12) {
    const morning = rnd(n, "internam") < 0.5;
    for (const day of sample([1, 2, 3, 4, 5], 2, n, "internday", String, () => 1)) {
      blocks.push({ kind: "fixed", day, start: morning ? "09:00" : "13:00", end: morning ? "13:00" : "17:30", label: "Internship" });
    }
  }

  // Never free
  if (rnd(n, "sleepin") < 0.35) blocks.push({ kind: "never", day: 0, start: "09:00", end: "12:00", label: "Sleeping in" });
  if (rnd(n, "nosat") < 0.1) blocks.push({ kind: "never", day: 6, start: "09:00", end: "23:00", label: "Away on Saturdays" });
  if (rnd(n, "frinight") < 0.12) blocks.push({ kind: "never", day: 5, start: "18:00", end: "23:00", label: "Friday night plans" });
  if (rnd(n, "early") < 0.25) {
    for (const day of [0, 1, 2, 3, 4]) blocks.push({ kind: "never", day, start: "22:00", end: "23:00", label: "Early night" });
  }
  if (rnd(n, "commute") < 0.18) {
    for (const day of [1, 2, 3, 4, 5]) blocks.push({ kind: "never", day, start: "20:00", end: "23:00", label: "Commute home" });
  }

  // Classes win: drop any fixed/never block that overlaps a class
  const classes = blocks.filter((b) => b.kind === "class");
  const kept = blocks.filter(
    (b) => b.kind === "class" ||
      !classes.some((c) => c.day === b.day && toMin(b.start) < toMin(c.end) && toMin(c.start) < toMin(b.end)),
  );

  // Interests and each student's minimum group size
  const interests = sample(SAMPLE_CATALOG, nInterests, n, "interest", (a) => a.name,
    (a) => (POPULARITY[a.name] ?? 0.5) * (major.boost.includes(a.name) ? 2.2 : 1),
  ).map((a) => {
    const r = rnd(n, `min:${a.name}`);
    return { activity: a.name, minSize: r < 0.6 ? a.minDefault : r < 0.85 ? Math.min(a.maxSize, a.minDefault + 1) : 2 };
  });

  return { n, id: uuidFrom(`nado-sample-${n}`), nickname: nicknameAt(n - 1), major: major.key, blocks: kept, interests };
}

// ---------- output ----------

const catalogRows = () =>
  SAMPLE_CATALOG.map((a) => ({ name: a.name, label: a.label, category: a.category, max_size: a.maxSize, min_default: a.minDefault }));
const studentRows = (s: SampleStudent[]) => s.map((x) => ({ id: x.id, nickname: x.nickname, is_sample: true, is_judge: false, email: null }));
const blockRows = (s: SampleStudent[]) =>
  s.flatMap((x) => x.blocks.map((b) => ({ student_id: x.id, kind: b.kind, day_of_week: b.day, start_time: b.start, end_time: b.end, label: b.label })));
const interestRows = (s: SampleStudent[]) =>
  s.flatMap((x) => x.interests.map((i) => ({ student_id: x.id, activity: i.activity, min_size: i.minSize })));

function printStats(students: SampleStudent[]) {
  const blocks = students.flatMap((s) => s.blocks);
  const byKind = (k: Kind) => blocks.filter((b) => b.kind === k).length;
  const interests = students.flatMap((s) => s.interests);
  const counts = new Map<string, number>();
  for (const i of interests) counts.set(i.activity, (counts.get(i.activity) ?? 0) + 1);
  const top = [...counts].sort((a, b) => b[1] - a[1]);
  console.log(`students     ${students.length}`);
  console.log(`busy_blocks  ${blocks.length} (class ${byKind("class")}, fixed ${byKind("fixed")}, never ${byKind("never")})`);
  console.log(`interests    ${interests.length}: ${top.map(([a, c]) => `${a} ${c}`).join(", ")}`);
}

const sqlText = (v: string) => `'${v.replaceAll("'", "''")}'`;

// SQL mode packs the campus into one compact JSON payload (≈200 KB for 800 students, small enough
// to paste into the SQL Editor). Student ids are md5('nado-sample-' || n)::uuid, same as uuidFrom.
// Blocks with the same kind, time and label are merged across days:
// "<kind><days> HH:MM HH:MM <label index>", e.g. "c13 09:30 10:45 7" = class Mon+Wed 9:30–10:45.
function packBlocks(blocks: Block[], labelIndex: Map<string, number>) {
  const merged = new Map<string, number[]>();
  for (const b of blocks) {
    const key = `${b.kind[0]}|${b.start}|${b.end}|${labelIndex.get(b.label)}`;
    merged.set(key, [...(merged.get(key) ?? []), b.day]);
  }
  return [...merged].map(([key, days]) => {
    const [k, start, end, label] = key.split("|");
    return `${k}${days.sort().join("")} ${start} ${end} ${label}`;
  });
}

function campusSql(students: SampleStudent[], first: boolean) {
  const labels = [...new Set(students.flatMap((s) => s.blocks.map((b) => b.label)))];
  const labelIndex = new Map(labels.map((l, i) => [l, i]));
  const payload = {
    l: labels,
    s: students.map((s) => [
      s.n,
      s.nickname,
      packBlocks(s.blocks, labelIndex),
      s.interests.map((i) => `${i.minSize} ${i.activity}`),
    ]),
  };
  const catalog = catalogRows()
    .map((a) => `  (${sqlText(a.name)}, ${sqlText(a.label)}, ${sqlText(a.category)}, ${a.max_size}, ${a.min_default})`)
    .join(",\n");
  return `-- nado sample students (generated by scripts/generate-students.ts — edit the script, not this file)
begin;
${first ? `
insert into activities (name, label, category, max_size, min_default) values
${catalog}
on conflict (name) do nothing; -- Preserve existing AI metadata and sizes.
` : ""}
create temp table campus_payload on commit drop as select $campus$${JSON.stringify(payload)}$campus$::jsonb as j;

create temp table campus_students on commit drop as
select md5('nado-sample-' || (e->>0))::uuid as id, e->>1 as nickname, e->2 as blocks, e->3 as interests
from campus_payload, jsonb_array_elements(j->'s') e;

-- Refuse to overwrite any real account whose ID collides with a sample ID.
do $$ begin
  if exists (select 1 from campus_students c join students s on s.id = c.id where not s.is_sample) then
    raise exception 'Sample ID collides with a real account';
  end if;
end $$;

-- Avoid collisions with nicknames belonging to accounts outside this payload.
update campus_students c set nickname = c.nickname || ' sample-' || c.id::text
where exists (select 1 from students s where s.nickname = c.nickname and s.id <> c.id
              and not exists (select 1 from campus_students other where other.id = s.id));

insert into students (id, nickname, is_sample, is_judge)
select id, nickname, true, false from campus_students
on conflict (id) do update set is_judge = false; -- Keep existing identity/nickname and memberships.

delete from busy_blocks where student_id in (select id from campus_students);
delete from interests where student_id in (select id from campus_students);
delete from activity_slots where student_id in (select id from campus_students);

insert into busy_blocks (student_id, kind, day_of_week, start_time, end_time, label)
select s.id,
       case left(b, 1) when 'c' then 'class' when 'f' then 'fixed' else 'never' end,
       d::smallint, split_part(b, ' ', 2)::time, split_part(b, ' ', 3)::time,
       (select j->'l'->>(split_part(b, ' ', 4)::int) from campus_payload)
from campus_students s, jsonb_array_elements_text(s.blocks) b,
     regexp_split_to_table(substr(split_part(b, ' ', 1), 2), '') d;

insert into interests (student_id, activity, min_size)
select s.id, a.name, least(split_part(i, ' ', 1)::smallint, a.max_size)
from campus_students s cross join lateral jsonb_array_elements_text(s.interests) i
join activities a on a.name = substr(i, strpos(i, ' ') + 1);

commit;
`;
}

function writeSql(dir: string, students: SampleStudent[], parts: number) {
  mkdirSync(dir, { recursive: true });
  const size = Math.ceil(students.length / parts);
  const files: string[] = [];
  for (let p = 0; p * size < students.length; p++) {
    const file = parts === 1 ? "campus.sql" : `campus-${p + 1}.sql`;
    writeFileSync(join(dir, file), campusSql(students.slice(p * size, (p + 1) * size), p === 0));
    files.push(file);
  }
  console.log(`wrote ${files.join(", ")} to ${dir}/ (run in that order)`);
}

async function writeSupabase(students: SampleStudent[]) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Set the Supabase URL and key in .env.local first.");
  const sb = createClient(url, key, { auth: { persistSession: false } });
  const check = (label: string, error: { message: string } | null) => {
    if (error) throw new Error(label + ": " + error.message);
  };
  const targetIds = students.map((s) => s.id);
  const read = async (table: string) => {
    const all: Record<string, unknown>[] = [];
    for (let i = 0; i < targetIds.length; i += 100) {
      for (let offset = 0; ; offset += 500) {
        let query = sb.from(table).select(table === "students" ? "id,nickname,is_sample,is_judge" : "*")
          .in(table === "students" ? "id" : "student_id", targetIds.slice(i, i + 100));
        query = table === "interests" ? query.order("student_id").order("activity") : query.order("id");
        const r = await query.range(offset, offset + 499);
        check(table, r.error);
        all.push(...((r.data ?? []) as unknown as Record<string, unknown>[]));
        if ((r.data?.length ?? 0) < 500) break;
      }
    }
    return all;
  };
  // Preflight the changed schema before any mutation; never expose credentials.
  for (const [table, columns] of [
    ["students", "id,is_sample,is_judge,nickname"],
    ["activities", "name,category,max_size"],
    ["busy_blocks", "student_id,kind,day_of_week,start_time,end_time,label"],
    ["interests", "student_id,activity,min_size"],
  ]) {
    const r = await sb.from(table).select(columns)
      .in(table === "activities" ? "name" : table === "students" ? "id" : "student_id",
        table === "activities" ? SAMPLE_CATALOG.map((a) => a.name) : targetIds.slice(0, 100)).limit(1);
    check("schema preflight " + table, r.error);
  }
  const existing = await read("students");
  const ids = new Set(students.map((s) => s.id));
  if (existing.some((s) => ids.has(String(s.id)) && !s.is_sample)) throw new Error("Sample ID collides with a real account.");
  const used = new Set(existing.map((s) => String(s.nickname)));
  for (let i = 0; i < students.length; i += 100) {
    const collisions = await sb.from("students").select("id,nickname")
      .in("nickname", students.slice(i, i + 100).map((s) => s.nickname));
    check("nickname collision check", collisions.error);
    (collisions.data ?? []).forEach((s) => used.add(s.nickname));
  }
  for (const s of students) {
    const old = existing.find((r) => r.id === s.id);
    if (old) s.nickname = String(old.nickname);
    else if (used.has(s.nickname)) s.nickname += " sample-" + s.id;
    used.add(s.nickname);
  }
  // Back up target rows locally before replacing dependent preferences/schedules.
  const backup: Record<string, Record<string, unknown>[]> = {};
  for (const table of ["students", "busy_blocks", "interests", "activity_slots"]) {
    const rows = table === "students" ? existing : await read(table);
    backup[table] = rows.filter((r) => ids.has(String(table === "students" ? r.id : r.student_id)));
  }
  const backupPath = join(tmpdir(), "nado-sample-backup-" + Date.now() + ".json");
  writeFileSync(backupPath, JSON.stringify(backup), { mode: 0o600 });
  console.log("Target sample backup saved:", backupPath);
  const cat = await sb.from("activities").upsert(catalogRows(), { onConflict: "name", ignoreDuplicates: true });
  check("activities", cat.error);
  const catalog = await sb.from("activities").select("name,max_size").in("name", SAMPLE_CATALOG.map((a) => a.name));
  check("activities read", catalog.error);
  const maxima = new Map((catalog.data ?? []).map((a) => [a.name as string, a.max_size as number]));
  const insert = async (table: string, rows: Record<string, unknown>[], upsert = false) => {
    for (let i = 0; i < rows.length; i += 200) {
      const batch = rows.slice(i, i + 200);
      const r = upsert ? await sb.from(table).upsert(batch, { onConflict: "id" }) : await sb.from(table).insert(batch);
      check(table, r.error);
    }
  };
  // Do not delete students: deleting them cascades room_members and messages.
  await insert("students", studentRows(students), true);
  for (const table of ["busy_blocks", "interests", "activity_slots"]) {
    for (let i = 0; i < targetIds.length; i += 100) {
      const r = await sb.from(table).delete().in("student_id", targetIds.slice(i, i + 100));
      check("replace " + table, r.error);
    }
  }
  await insert("busy_blocks", blockRows(students));
  await insert("interests", interestRows(students).map((r) => ({
    ...r, min_size: Math.min(r.min_size, maxima.get(r.activity) ?? r.min_size),
  })));
  // Verify exact target data through paginated reads, not Supabase's 1,000-row default.
  const actualStudents = (await read("students")).filter((r) => ids.has(String(r.id)));
  const actualBlocks = (await read("busy_blocks")).filter((r) => ids.has(String(r.student_id)));
  let interestCount = 0;
  for (let i = 0; i < targetIds.length; i += 100) {
    const counts = await sb.from("interests").select("student_id", { count: "exact", head: true }).in("student_id", targetIds.slice(i, i + 100));
    check("verify interests", counts.error);
    interestCount += counts.count ?? 0;
  }
  if (actualStudents.length !== students.length || actualBlocks.length !== blockRows(students).length ||
      interestCount !== interestRows(students).length) throw new Error("Post-write sample counts differ; inspect the backup before retrying.");
  console.log("Supabase verified:", actualStudents.length, "students,", actualBlocks.length, "busy blocks,", interestCount, "interests.");
}

async function main() {
  const args = process.argv.slice(2);
  const opt = (name: string) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const count = Number(opt("--count") ?? 800);
  if (!Number.isInteger(count) || count < 1 || count > NICKNAME_COUNT / 2) throw new Error(`--count must be 1–${NICKNAME_COUNT / 2}`);

  const students = Array.from({ length: count }, (_, i) => generateStudent(i + 1));
  printStats(students);
  if (args.includes("--dry")) return;
  const dir = opt("--sql");
  if (dir) writeSql(dir, students, Number(opt("--parts") ?? 1));
  else await writeSupabase(students);
}

main().catch((e) => {
  console.error((e as Error).message);
  process.exit(1);
});
