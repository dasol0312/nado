-- nado: add the "Place" interest category (a spot itself as the interest, e.g. Washington Square Park).
-- Safe to re-run. Run once in Supabase > SQL Editor on the team project; no data is changed.
alter table activities drop constraint if exists activities_category_check;
alter table activities add constraint activities_category_check
  check (category in ('Sports','Cafe','Study','Food','Culture','Games','Place','Other'));
