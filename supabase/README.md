# Supabase (schema v4.1)

The team project `nado` is already set up with everything below. Don't re-run these on it unless you mean to reset the demo.

## Setting up an empty project, in order

1. `schema.sql`: tables (drops everything first)
2. `migrations/20261025_match_helpers.sql`, `20261025_match_timer.sql`, `20261025_match_every_minute.sql`: DB functions (safe to re-run)
3. `npm run seed:students`: the 16 preset activities and 800 virtual NYU students (schedules + interests), from `scripts/generate-students.ts`

`places` starts empty on purpose: Claude picks the meeting spot and venue for each activity when a plan opens, and saves them there.

## DB functions (call with `supabase.rpc`)

| Function | What it does |
|---|---|
| `app_now()` | "Now", following the demo clock in `app_clock` |
| `build_activity_slots(p_now?, p_hours = 4)` | Rebuilds `activity_slots`: each student's free time (campus time, 9–23h) in the next 4 hours × their interests, minus their busy blocks and rooms they're already in. Returns the row count. |
| `reset_demo()` | Between judges: deletes rooms, chat, judge accounts, AI-added activities and Claude-picked places. Keeps the 800 samples and 16 presets. |
| `claim_match_minute()` | True only for the first call in each minute, so the timer and every open phone don't match twice at once. |
| `start_match_timer(url, secret)` / `stop_match_timer()` | Turns the matching timer on or off: every minute, on the minute (pg_cron → `GET /api/match`). Run in the SQL Editor after deploying. Not callable from the app. |

Computing free time in the database avoids the API's 1,000-row response limit (busy_blocks has ~10k rows).

## Sample students

- Deterministic: re-running `npm run seed:students` gives the same 800 students with the same ids. It replaces only `is_sample = true` rows.
- `--sql out/` writes a pasteable `campus.sql` instead (add `--parts 4` to split it).

RLS is wide open for the demo. Tighten it before real students sign up.
