# Development

## Local setup

Use Node.js 22 or newer, then run:

```sh
npm ci
# Only if .env.local does not already exist:
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000. Preserve existing .env.local values.

Environment variables (get the keys by private message, never in GitHub or public channels):
- NEXT_PUBLIC_SUPABASE_URL: Supabase project URL.
- NEXT_PUBLIC_SUPABASE_ANON_KEY: public client key, subject to RLS.
- ANTHROPIC_API_KEY: server-only secret. Never prefix it with NEXT_PUBLIC_
  and never expose it through browser code, logs, or API responses.
- ANTHROPIC_WORKSPACE_ID: Anthropic workspace for the API key.
- CRON_SECRET (optional): the 1-minute matching timer sends it to GET /api/match.
- NADO_SESSION_SECRET: signs the login cookie. Required in production.
- NADO_EMAIL_OTP: `1` emails real codes through Supabase Auth. Empty = demo
  mode (no email, any 6 digits work).
- NADO_DEMO: `0` turns off the demo routes.

.env.local is ignored by Git. Configure variables separately in hosting settings.
Rotate the API keys after the hackathon.

## How it fits together

1. Sign in with an @nyu.edu email and a 6-digit code
2. Paint busy hours (classes from an Albert screenshot, fixed commitments, never
   free). Everything else from 9 AM to 11 PM is free. Repeats every week
3. Pick interests and the smallest group you'd enjoy for each. The AI sets the
   largest group for each activity
4. Matching finds plans starting in the next 4 hours and pushes them
5. Nado! → everyone confirms → the room opens with a campus meeting spot and
   the hour goes on your schedule
6. If cancellations drop a group below its minimum, it dissolves and that hour
   is matched again
7. 30 minutes before: outfit hints to find each other, a bright yellow screen if
   you give up, then an activity icebreaker

### Matching (`/api/match`, `lib/server/match.ts`)

Runs every minute on the minute (Supabase pg_cron → GET; once per minute via claim_match_minute), on "Check again now", after a
profile change, when a room opens, and after a group dissolves (POST).

1. DB function `build_activity_slots()`: everyone's free time in the next 4 hours
   × their interests, minus busy blocks and rooms they're in → `activity_slots`
   (computed in the DB because the API returns at most 1,000 rows)
2. Claude (`lib/nado/plan.ts`) picks a meeting spot and venue for activities
   that don't have one yet, saved in `places`
3. `lib/nado/matching.ts`: each student's minimum, the activity's maximum,
   start 20+ minutes out (also right when classes end), only rooms with a real
   student in them
4. Claude writes the invitation, place reason and first icebreaker; rooms and
   invited members are saved and reach phones through Realtime

After that, `lib/match/rules.ts` (`settle`, used by `lib/server/rooms.ts`)
opens a room when everyone has confirmed (or the confirm deadline passes with
enough people) and dissolves it when it falls below its minimum. A dissolved
room is `status = 'cancelled'`, which frees that hour for the next match.

Claude sees only activity names and plan information, never names or IDs.

### Claude features still to connect

`lib/ai.ts` has three functions that return null today, so the app uses
fallbacks. Each one should call a new file in `lib/nado/`. Inputs, outputs,
error codes and prompts: docs/HANDOFF-yerin.md.

| lib/ai.ts | Used by | Fallback |
|---|---|---|
| `readAlbertSchedule(image)` | POST /api/schedule/read | error message; paint classes as Fixed |
| `thinkAboutInterest(q)` | POST /api/activities | Other, max 4 |
| `nextIcebreaker(q)` | POST /api/rooms/[id]/icebreaker | question bank in `lib/catalog.ts` |

## Directory responsibilities

- app/: pages and API route handlers.
  - `/login` (NYU email + code, or Judge mode). New students land on `/profile`
  - `(tabs)/`: `/matches`, `/groups`, `/profile` share the tab bar and run
    matching in the background (every minute, on the minute)
  - `/rooms/[roomId]`: meeting spot map, group, 30-minute reminder
  - `/rooms/[roomId]/find`: outfit hints, glow screen, icebreaker
- components/: UI by screen (shell, auth, schedule, interests, matches, groups,
  room, find, demo). `shell/AppProvider.tsx` holds the signed-in student, the
  demo clock, my plans (live through Realtime), banners and toasts.
- lib/: shared logic. `activities.ts` (the 16 presets), `catalog.ts` (categories,
  icebreaker bank), `places.ts` (map landmarks), `time.ts` (campus time,
  America/New_York), `match/rules.ts` (room life cycle), `server/` (server-only:
  matching run, rooms, session cookie), `ai.ts` (Claude seam).
- lib/nado/: room-opening logic from the AI teammate (Yerin). Don't edit here
  without them; see lib/nado/README.md.
- proxy.ts: sends signed-out visitors to /login (pages check the cookie again).
- types/database.ts: row types matching supabase/schema.sql.
- supabase/: schema, DB functions (migrations/), seed. See supabase/README.md.
- scripts/generate-students.ts: the 800 sample students (`npm run seed:students`).

## Database

Tables: students, places, activities, busy_blocks, interests, activity_slots,
rooms, room_members, messages, app_clock. The team project already has 800
sample students; don't re-run schema.sql on it. Weekly times use campus local time;
day 0 is Sunday. Room starts_at is an absolute timestamp. `app_clock` is the
shared demo clock, so both phones agree on "now".

**Demo security warning:** RLS policies permit anonymous reads and writes to
every table, and the login cookie only says which student this browser is.
Before real users: Supabase Auth sessions, ownership and membership policies.

## API

All routes except auth and demo need the session cookie.

- POST /api/auth/start `{ email, judge? }`, POST /api/auth/verify `{ email, code, judge? }`
  (Judge mode: any non-NYU email, no code sent),
  POST /api/auth/signout
- PUT /api/profile/schedule `{ blocks: [{ kind, day, start, end, label? }] }`
- PUT /api/profile/interests `{ interests: [{ activity, min }] }`
- POST /api/schedule/read (form data `image`) → `{ classes }`
- POST /api/activities `{ name, rethink? }`: add a custom interest (or ask Claude again)
- POST /api/match `{ now?, dryRun? }`: find plans in the next 4 hours (GET is for the timer)
- POST /api/rooms/[roomId]/join | confirm | cancel
- POST /api/rooms/[roomId]/reply `{ reply: "here" | "late" | "cant" }`: quick replies (no free-text chat)
- PUT/DELETE /api/rooms/[roomId]/outfit `{ outfit: { color, top, shoes, hair } }`
- POST /api/rooms/[roomId]/icebreaker `{ previous }`
- Demo: PUT /api/demo/clock `{ preset }`, POST /api/demo/quick-setup,
  POST /api/demo/sample-confirm `{ roomId }`, POST /api/demo/cancel-member
  `{ roomId }`, POST /api/demo/reset (calls `reset_demo()`: deletes rooms,
  judge/real accounts and Claude-picked places; keeps the 800 samples)

The browser reads with the Supabase client and listens with Realtime. The glow
screen and "found you" are Realtime broadcasts on `find-<roomId>`.

## Checks

```sh
npm run typecheck
npm run lint
npm run build
npx tsx lib/match/rules.test.ts      # room life cycle (open / dissolve)
npx tsx lib/nado/matching.test.ts    # lib/nado matching (no keys needed)
npx tsx --env-file=.env.local lib/nado/try-claude.ts   # real Claude
```
