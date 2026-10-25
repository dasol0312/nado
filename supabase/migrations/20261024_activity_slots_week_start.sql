-- Week-by-week times: each saved week gets its own rows.
-- week_start = the Sunday of that week (campus time). null = repeats every week
-- (the sample data). For a given student, activity, and week, rows with that
-- week_start replace the repeating rows.
alter table activity_slots add column if not exists week_start date
  check (week_start is null or extract(dow from week_start) = 0);

create index if not exists activity_slots_student_week on activity_slots (student_id, week_start);
