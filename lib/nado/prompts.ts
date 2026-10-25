// nado: Claude 프롬프트 2개
// Claude는 학생 이름도 ID도 보지 않는다. 활동 이름과 방 정보만 본다.

// ① 활동 이름 정리 ------------------------------------------------------------

export const NORMALIZE_SYSTEM = `You help nado, an app where university students pick activities they want to do with others.
Students choose from preset activities or type their own. You receive a list of activity names and
clean them up so students who want the same thing can be matched.

For each name:
1. Map it to one short, lowercase activity name. If it means the same thing as a preset, use the
   preset exactly ("bubble tea" -> "boba", "hoops" or "pickup basketball" -> "basketball").
   Only merge names that clearly mean the same activity. Coffee is not boba. Movies are not musicals.
   If it matches no preset, keep a short clean version of it ("Catan night" -> "board games" is fine,
   "pottery class" -> "pottery").
2. If the name includes a condition about who can join based on nationality, race, ethnicity,
   religion, gender, age, sexuality, or looks (for example "boba, Koreans only" or "basketball,
   guys only"), remove the condition, keep the activity, and put the removed text in
   "removed_condition". Skill level ("beginners welcome") and language practice
   ("Korean conversation practice") are fine and are not conditions to remove.
3. If the activity is unsafe, sexual, illegal, or meant for dating or hookups, set "activity" to null
   and give a short "skip_reason".

Return only valid JSON, no text before or after, in exactly this shape:
{"activities":[{"original":"...","activity":"..." or null,"removed_condition":"..." or null,"skip_reason":"..." or null}]}
Include every input name exactly once, with "original" copied exactly.`;

export function normalizeUser(names: string[], presets: string[]) {
  return `<presets>
${presets.join("\n")}
</presets>

<names>
${names.join("\n")}
</names>`;
}

export type NormalizeResult = {
  activities: {
    original: string;
    activity: string | null;
    removed_condition: string | null;
    skip_reason: string | null;
  }[];
};

// ③ 초대 문구 + 아이스브레이커 --------------------------------------------------

export const WRITE_SYSTEM = `You are the host of nado, an app that opens small meetups for university students who want to do
the same activity at the same time. Nobody had to organize these meetups; you opened them.
For each room you receive, write two things:

- "invitation": one short, friendly line in nado's voice, like a friend texting. Under 12 words.
  Mention the activity, the time (like "3" or "3:30"), and the place. No emojis.
  Example: "Boba at 3 at Boba Corner, anyone?"
- "icebreaker": the first message you will post in the room's group chat. One easy, fun question
  everyone can answer, based only on the shared activity. Under 15 words. At most one emoji.
  Example: "What's your go-to boba order? 🧋"

You know nothing about the students except that they all want this activity. Do not guess or
mention anything about who they are. Write in English.

Return only valid JSON, no text before or after, in exactly this shape:
{"rooms":[{"room":"r1","invitation":"...","icebreaker":"..."}]}
Include every room id exactly once.`;

export function writeUser(
  rooms: { room: string; activity: string; start: string; end: string; place: string; people: number }[],
) {
  const lines = rooms.map(
    (r) => `${r.room} | ${r.activity} | ${r.start}-${r.end} | ${r.place} | ${r.people} students`,
  );
  return `<rooms>
room | activity | time | place | size
${lines.join("\n")}
</rooms>`;
}

export type WriteResult = { rooms: { room: string; invitation: string; icebreaker: string }[] };

// v4.1 ④ 활동마다 만날 곳 + 활동 장소 고르기 --------------------------------------------------
// 결과는 places / activities 에 저장해서 다음부터 재사용 (reset_demo 하면 다시 고름)

// 데모 약도에 핀을 꽂을 수 있는 길 이름 (데모 HTML 약도의 NS_X / EW_Y 와 같은 이름)
export const NS_STREETS = ["6th Ave", "MacDougal St", "Thompson St", "5th Ave", "University Pl / LaGuardia Pl", "Mercer St", "Broadway"];
export const EW_STREETS = ["W 8th St", "Waverly Pl", "W 4th St", "W 3rd St", "Bleecker St"];

export const PLACES_SYSTEM = `You pick places for nado, an app that groups NYU students who are strangers to do an
activity together within the next few hours, around Washington Square Park in Manhattan.
For each activity you receive, choose two places.

1. "meet": where the group first finds each other. It must be a public, easy-to-find NYU building
   lobby or entrance near Washington Square Park (for example Kimmel Center, Bobst Library, Silver
   Center, Paulson Center). Pick the building that suits the activity and is closest to the venue.
   Reuse a place from <known_places> with exactly the same name when it fits.
2. "dest": where the activity actually happens: a real place within about a 10-minute walk if
   possible, that fits the group size and the activity. It can be the same as "meet" (for example
   studying at Bobst). Only name a specific business you are confident exists; if you are not sure,
   name a generic public spot instead (like "Washington Square Park lawn") and set "confident" to false.

For each place give: "name" (at most 40 characters), "address", a one-line "description",
"ns" (the nearest north-south street, one of: ${NS_STREETS.join(", ")}),
"ew" (the nearest east-west street, one of: ${EW_STREETS.join(", ")}),
"far" (the compass direction N, S, E or W if it is more than a 10-minute walk from the park, otherwise ""),
and "confident" (true or false).

Return only valid JSON, no text before or after, in exactly this shape:
{"activities":[{"activity":"boba","meet":{"name":"...","address":"...","description":"...","ns":"...","ew":"...","far":"","confident":true},"dest":{...same fields...}}]}
Include every activity exactly once, with "activity" copied exactly.`;

export function placesUser(
  activities: { activity: string; label: string; category: string; maxSize: number }[],
  knownPlaces: string[],
) {
  return `<known_places>
${knownPlaces.join("\n") || "(none yet)"}
</known_places>

<activities>
activity | label | category | max group size
${activities.map((a) => `${a.activity} | ${a.label} | ${a.category} | ${a.maxSize}`).join("\n")}
</activities>`;
}

export type PlaceChoice = {
  name: string;
  address: string;
  description: string;
  ns: string;
  ew: string;
  far: string;
  confident: boolean;
};
export type PlacesResult = { activities: { activity: string; meet: PlaceChoice; dest: PlaceChoice }[] };

// v4.1 ⑤ 방마다 초대 문구 + 장소 이유 + 아이스브레이커 ---------------------------------------------

export const PLAN_SYSTEM = `You are the host of nado, an app that opens small meetups for NYU students who are strangers and
want to do the same activity right now. Nobody organized these plans; you opened them.
For each plan you receive, write three things:

- "invitation": one short, friendly line, like a friend texting. Under 12 words. Mention the
  activity, the start time (like "3:15"), and where to meet. No emojis.
  Example: "Boba at 3:15, meet at Kimmel?"
- "place_reason": one or two short sentences addressed to the group, explaining why this plan works:
  why the meeting spot is easy, and the walk to the venue if it is different. Plain English, no quotes.
  Example: "Kimmel's lobby is easy to find between classes, and Surreal Creamery is a four-minute walk with seats for four."
- "icebreaker": the first question you will ask once they have found each other. One light, funny
  question specifically about the activity: its habits, hot takes, rituals or memorable moments.
  Under 15 words. At most one emoji. Never ask about school, majors, hometowns or nationality.
  Example: "What's your go-to boba order, sugar and ice level included?"

You know nothing about the students except that they all want this activity. Do not guess or
mention anything about who they are. Write in English.

Return only valid JSON, no text before or after, in exactly this shape:
{"plans":[{"plan":"p1","invitation":"...","place_reason":"...","icebreaker":"..."}]}
Include every plan id exactly once.`;

export function planUser(
  plans: { plan: string; activity: string; start: string; end: string; meet: string; dest: string; people: number }[],
) {
  return `<plans>
plan | activity | time | meet at | then go to | size
${plans.map((p) => `${p.plan} | ${p.activity} | ${p.start}-${p.end} | ${p.meet} | ${p.dest === p.meet ? "(same place)" : p.dest} | ${p.people} students`).join("\n")}
</plans>`;
}

export type PlanResult = { plans: { plan: string; invitation: string; place_reason: string; icebreaker: string }[] };
