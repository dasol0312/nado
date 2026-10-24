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

.env.local is ignored by Git. Configure variables separately in hosting settings.
Rotate the API keys after the hackathon.

## How it fits together

1. Pick an activity (boba, basketball, or type your own)
2. Paint a weekly time grid, like When2meet (repeats every week)
3. Claude opens rooms for students with the same activity and overlapping times
4. Invited students tap nado! to join (quick-reply buttons instead of free chat)
5. At meetup time, everyone's screen shows the same color

Time overlap is computed in code (lib/nado/). Claude sees only activity names
and room information, never student names or IDs. In the demo, the
"Let Claude open rooms" button calls the room-opening API.

## Directory responsibilities

- app/: App Router pages, layouts, and API route handlers.
- components/: reusable UI.
- lib/nado/: matching and room-opening logic from the AI teammate (Yerin).
  See lib/nado/README.md for usage.
- lib/supabase/: browser and server Supabase client factories. The server
  client passes session cookies; full auth/session refresh is not implemented.
- types/database.ts: row types matching supabase/schema.sql.
- public/: static assets.
- supabase/: SQL source files and future migrations.
- docs/: developer coordination notes.

Add feature pages when implementing them. Do not add empty routes or pages
just to reserve directory names.

## Database

Schema v3 and sample data are already installed in the team's Supabase project.
Tables: students, activity_slots, places, rooms, room_members, messages.
Weekly activity times use campus local time (America/Los_Angeles); day 0 is
Sunday. Room starts_at is an absolute timestamp. A null messages.student_id
represents a Claude message.

supabase/schema.sql and supabase/seed.sql contain the scripts supplied by the
team for the existing demo setup.
Do not run them against the team's Supabase project: schema.sql drops all
tables and seed.sql truncates all data. Run them only to set up a new, empty
Supabase project (schema.sql first, then seed.sql).

**Demo security warning:** current RLS policies permit anonymous reads and writes
to all six tables. These policies are unsafe for real users or public production
use. Selecting a demo student is not authentication. Before production, implement
authentication, ownership and room membership policies; protect message access
and privileged room creation.

## API

- POST /api/open-rooms: opens rooms with lib/nado (the "Let Claude open rooms"
  button). Saves rooms and invited members; see app/api/open-rooms/README.md.

Keep route handlers focused on request validation and responses; put shared
logic in lib/. Browser Realtime subscriptions (invitation cards, nado! taps)
can use the Supabase browser client.

## Checks

```sh
npm run typecheck
npm run lint
npm run build
# Matching logic only (no keys needed):
npx tsx lib/nado/matching.test.ts
# Full run with real Claude:
npx tsx --env-file=.env.local lib/nado/try-claude.ts
```
