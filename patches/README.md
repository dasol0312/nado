# Sample-data patch

sample-students.patch adds supabase/seed.sql to a checkout where that file is
missing. Apply with git apply patches/sample-students.patch. The generated SQL
is also present at supabase/seed.sql; do not apply the patch if it already exists.

Prerequisite: schema v4.1 and the Place category migration. Never rerun the
destructive schema.sql just to refresh samples.

The SQL runs in one transaction, refreshes only the 800 deterministic sample
students' schedules/interests/matching snapshots, and preserves student rows,
real users, rooms, memberships, messages, existing activity sizes and AI places.
It inserts missing activity catalog entries, including three synthetic Place
interests (not verified business listings). Existing sample nicknames are kept;
new sample nickname collisions get a deterministic suffix.

Synthetic data: 3–5 non-overlapping course patterns per student, some recitations,
evening classes, work/clubs/internships, and recurring unavailable hours.
Each sample has 2–3 distinct interests with valid group minimums.
These distributions are demo assumptions, not measured NYU enrollment data.

Regenerate:
    node --import tsx scripts/generate-students.ts --sql /tmp/nado-campus
Copy campus.sql to supabase/seed.sql and regenerate the new-file Git patch.

For the existing hosted database:
    npm run seed:students
This uses REST batches rather than one SQL transaction, so avoid matching during
the refresh. It saves a restricted-permission backup in the OS temporary folder
before replacing target data and verifies the written counts. If interrupted,
inspect the backup and rerun; do not reset the database.
