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

### Matching (`POST /api/match`)

1. `lib/match/snapshot.ts`: free time in the next 4 hours × interests →
   `activity_slots` (this week's rows)
2. `app/api/open-rooms` + `lib/nado` (Yerin's code, unchanged): Claude cleans
   activity names, code finds overlaps, Claude writes invitations and icebreakers
3. `lib/match/rules.ts`: drop members whose minimum is bigger than the group,
   cap at the activity's max, set the meeting spot and the confirm deadline

`lib/match/rules.ts` also decides when a room opens or dissolves (`settle`).
Claude sees only activity names and room information, never names or IDs.

### Claude features still to connect

`lib/ai.ts` has four functions that return null today, so the app uses
fallbacks. Each one should call a new file in `lib/nado/`. Inputs, outputs,
error codes and prompts: docs/HANDOFF-yerin.md.

| lib/ai.ts | Used by | Fallback |
|---|---|---|
| `readAlbertSchedule(image)` | POST /api/schedule/read | error message; paint classes as Fixed |
| `thinkAboutInterest(q)` | POST /api/activities | Other, max 4, meets at Kimmel |
| `explainPlace(q)` | settleRoom (room opens) | rule-based sentence |
| `nextIcebreaker(q)` | POST /api/rooms/[id]/icebreaker | question bank in `lib/catalog.ts` |

Known limits from lib/nado (details and suggested changes in docs/HANDOFF-yerin.md):
`/api/open-rooms` skips students who already have a plan that day, so a second
plan or a rematch after a dissolve only appears for students with no other plan
that day. Plans start 30+ minutes out on :00/:30, last 60-120 minutes, max 6
people, and aren't scored by time of day or capped at 3 per student.

## Directory responsibilities

- app/: pages and API route handlers.
  - `/login` (NYU email + code, or Judge mode). New students land on `/profile`
  - `(tabs)/`: `/matches`, `/groups`, `/profile` share the tab bar and run
    matching in the background (every 5 minutes)
  - `/rooms/[roomId]`: meeting spot map, group, 30-minute reminder
  - `/rooms/[roomId]/find`: outfit hints, glow screen, icebreaker
- components/: UI by screen (shell, auth, schedule, interests, matches, groups,
  room, find, demo). `shell/AppProvider.tsx` holds the signed-in student, the
  demo clock, my plans (live through Realtime), banners and toasts.
- lib/: shared logic. `catalog.ts` (activities), `places.ts` (map spots),
  `time.ts` (campus time, America/New_York), `match/` (matching), `server/`
  (server-only helpers, session cookie), `ai.ts` (Claude seam).
- lib/nado/: room-opening logic from the AI teammate (Yerin). Don't edit here
  without them; see lib/nado/README.md.
- proxy.ts: sends signed-out visitors to /login (pages check the cookie again).
- types/database.ts: row types matching supabase/schema.sql.
- supabase/: schema, generated seed. See supabase/README.md.
- scripts/generate-seed.ts: writes supabase/seed.sql.

## Database

Tables: students, places, activities, busy_blocks, interests, activity_slots,
rooms, room_members, messages, app_clock. Weekly times use campus local time;
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
- POST /api/match: find plans in the next 4 hours
- POST /api/rooms/[roomId]/join | confirm | cancel
- POST /api/rooms/[roomId]/reply `{ reply: "here" | "late" | "cant" }`: quick replies (no free-text chat)
- PUT/DELETE /api/rooms/[roomId]/outfit `{ outfit: { color, top, shoes, hair } }`
- POST /api/rooms/[roomId]/icebreaker `{ previous }`
- Demo: PUT /api/demo/clock `{ preset }`, POST /api/demo/quick-setup,
  POST /api/demo/sample-confirm `{ roomId }`, POST /api/demo/cancel-member
  `{ roomId }`, POST /api/demo/reset

The browser reads with the Supabase client and listens with Realtime. The glow
screen and "found you" are Realtime broadcasts on `find-<roomId>`.

## Checks

```sh
npm run typecheck
npm run lint
npm run build
npx tsx lib/match/rules.test.ts      # group-size rules, snapshot, room life cycle
npx tsx lib/nado/matching.test.ts    # lib/nado matching (no keys needed)
npx tsx --env-file=.env.local lib/nado/try-claude.ts   # real Claude
```
