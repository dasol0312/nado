# Supabase SQL sources

Schema v4 for the NYU flow: busy hours + interests → plans in the next 4 hours →
Nado! → everyone confirms → room. Tables: students, places, activities,
busy_blocks, interests, activity_slots, rooms, room_members, messages, app_clock.

Setting up an empty project, in the SQL Editor:

1. Run `schema.sql` (drops and recreates every table)
2. Run `seed.sql` (12 places around Washington Square, 16 activities, 46 sample students)

Both delete existing data, so don't run them on a project people are using.

`seed.sql` is generated. Change activities in `lib/catalog.ts` and places in
`lib/places.ts`, then run `npx tsx scripts/generate-seed.ts`. With
`--env-file=.env.local ... --push` the script loads the same data through the
API instead of the SQL Editor (it deletes everything first).

`activity_slots` is no longer written by people: `/api/match` rebuilds it each
run as "free time in the next 4 hours × interests", and `/api/open-rooms`
(lib/nado) reads it as before. A dissolved room is `status = 'cancelled'`, which
puts its members back into matching.

The current RLS policies allow anonymous reads and writes for the demo. They
are unsafe for real users.
