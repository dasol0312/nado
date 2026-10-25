-- nado seed v4.1 (Cal Hacks 13.0 demo, NYU)
-- schema.sql → migrations/20261025_match_helpers.sql → 이 파일 → npm run seed:students
-- ⚠️ 다시 실행하면 모든 데이터(심사위원 계정, 방, 메시지 포함)를 지움
--
-- 여기서는 비우기 + 기본 활동 16개만 넣음
--   - 가상 학생 800명은 scripts/generate-students.ts 가 만듦
--   - places 는 비워둠: 플랜이 열릴 때 Claude가 활동에 맞춰 고른 장소가 그때 저장됨
--   - 활동 16개의 원본은 lib/activities.ts (generate-students 도 같은 목록을 upsert 함)

begin;

truncate messages, room_members, rooms, activity_slots, interests, busy_blocks,
  activities, students, places cascade;
update app_clock set base = null, set_at = now(), label = null where id = 1;

insert into activities (name, label, category, max_size, min_default) values
  ('soccer',      'Soccer',        'Sports',  10, 4),
  ('basketball',  'Basketball',    'Sports',  10, 4),
  ('running',     'Running',       'Sports',   6, 2),
  ('climbing',    'Climbing',      'Sports',   4, 2),
  ('boba',        'Boba',          'Cafe',     4, 2),
  ('coffee',      'Coffee',        'Cafe',     4, 2),
  ('bakery',      'Bakery run',    'Cafe',     4, 2),
  ('study',       'Study session', 'Study',    5, 2),
  ('homework',    'Problem sets',  'Study',    4, 2),
  ('ramen',       'Ramen',         'Food',     4, 2),
  ('pizza',       'Pizza',         'Food',     6, 2),
  ('korean food', 'Korean food',   'Food',     6, 3),
  ('museum',      'Museum trip',   'Culture',  5, 2),
  ('movie',       'Movie night',   'Culture',  5, 2),
  ('board games', 'Board games',   'Games',    6, 3),
  ('chess',       'Chess',         'Games',    4, 2);

commit;
