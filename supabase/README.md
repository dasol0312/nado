# Supabase SQL sources

Schema v3 and sample data are already installed remotely, as reported by the
team. The tables are students, activity_slots, places, rooms, room_members,
and messages.

schema.sql and seed.sql contain the scripts supplied by the team.
They are source copies of the existing demo setup. Do not run them against
the team's project: schema.sql drops all tables and seed.sql truncates all
data. Run them only on a new, empty Supabase project (schema.sql, then seed.sql).

The current RLS policies allow broad anonymous reads and writes for the demo.
They are unsafe for real users or public production use.

See ../docs/DEVELOPMENT.md for client setup, API boundaries, and security work.
Keep migrations/ for future reviewed database changes.
