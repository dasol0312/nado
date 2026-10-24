-- nado sample data v3 (Cal Hacks 13.0 demo)
-- schema.sql 실행한 다음, SQL Editor > New query 에 전체 붙여넣고 Run
-- 다시 실행하면 샘플 데이터를 전부 지우고 새로 넣음 (테스트하며 생긴 방, 메시지도 지워짐)

truncate messages, room_members, rooms, activity_slots, students, places cascade;

-- 만날 장소 (실제 캠퍼스 장소 이름으로 바꿔도 돼)
insert into places (name, description, good_for) values
  ('Student Union lobby',       'Big open lobby by the main entrance',          array['boba', 'coffee', 'board games', 'study']),
  ('Boba Corner',               'Bubble tea shop next to the Student Union',    array['boba', 'dessert']),
  ('Rec Center courts',         'Indoor courts, pickup games most evenings',    array['basketball', 'volleyball']),
  ('Library front steps',       'Easy to spot, right outside the main library', array['study', 'coffee']),
  ('Main Quad fountain',        'Central quad, good meeting point for trips',   array['hiking', 'photography', 'baseball']),
  ('Campus Theater box office', 'Meet here before heading to a show',           array['musicals', 'movies', 'karaoke']);

-- 샘플 학생 24명
insert into students (name) values
  ('Maya Chen'),
  ('Diego Ramirez'),
  ('Aisha Khan'),
  ('Lucas Martin'),
  ('Isabella Moreno'),
  ('Jamal Carter'),
  ('Kenji Watanabe'),
  ('Ethan Brooks'),
  ('Sofia Rossi'),
  ('Hannah Kim'),
  ('Olivia Nguyen'),
  ('Priya Patel'),
  ('Noah Fischer'),
  ('Emma Johansson'),
  ('Carlos Silva'),
  ('Liam O''Brien'),
  ('Zoe Dubois'),
  ('Ryan Park'),
  ('Tomás Garcia'),
  ('Mina Lee'),
  ('Grace Wu'),
  ('Arjun Mehta'),
  ('Oliver Smith'),
  ('Fatima Ali');

-- 각 학생이 드래그로 칠한 결과 (0=일 1=월 2=화 3=수 4=목 5=금 6=토)
-- 요일 배열은 요일마다 한 줄로 풀어서 저장됨
-- 💡 Aisha는 활동 이름을 'bubble tea', Sofia는 'pickup basketball'로 직접 입력했다고 가정
--    → Claude가 boba / basketball 과 같은 활동으로 묶는 걸 데모에서 보여주기
insert into activity_slots (student_id, activity, day_of_week, start_time, end_time)
select s.id, v.activity, d, v.start_t::time, v.end_t::time
from (values
  -- 🧋 boba: 토·일 오후에 많이 겹침 → 데모 메인 장면
  ('Maya Chen',       'boba',              array[0,6],       '14:00', '18:00'),
  ('Maya Chen',       'boba',              array[1,2,3,4,5], '15:00', '17:00'),
  ('Diego Ramirez',   'boba',              array[0,6],       '13:00', '17:00'),
  ('Diego Ramirez',   'board games',       array[5],         '19:00', '22:00'),
  ('Aisha Khan',      'bubble tea',        array[0,3],       '12:00', '16:00'),
  ('Lucas Martin',    'boba',              array[0,6],       '15:00', '19:00'),
  ('Lucas Martin',    'photography',       array[6],         '09:00', '12:00'),
  ('Isabella Moreno', 'board games',       array[5],         '19:00', '23:00'),
  ('Isabella Moreno', 'boba',              array[0],         '13:00', '16:00'),
  -- 🏀 basketball: 월·수 밤
  ('Jamal Carter',    'basketball',        array[1,3],       '21:00', '23:00'),
  ('Jamal Carter',    'basketball',        array[6],         '10:00', '13:00'),
  ('Kenji Watanabe',  'basketball',        array[1,3],       '20:00', '22:00'),
  ('Kenji Watanabe',  'ramen',             array[5],         '19:00', '21:00'),
  ('Ethan Brooks',    'basketball',        array[1,3,5],     '21:00', '23:00'),
  ('Ethan Brooks',    'ramen',             array[5],         '20:00', '22:00'),
  ('Sofia Rossi',     'pickup basketball', array[3],         '20:00', '22:00'),
  ('Sofia Rossi',     'pickup basketball', array[6],         '10:00', '12:00'),
  ('Sofia Rossi',     'volleyball',        array[2],         '18:00', '20:00'),
  -- 🎭 musicals: 금·토 밤, 일 낮공연
  ('Hannah Kim',      'musicals',          array[5,6],       '19:00', '23:00'),
  ('Hannah Kim',      'karaoke',           array[4],         '20:00', '23:00'),
  ('Olivia Nguyen',   'musicals',          array[6],         '18:00', '22:00'),
  ('Olivia Nguyen',   'musicals',          array[0],         '13:00', '17:00'),
  ('Priya Patel',     'musicals',          array[5],         '19:00', '23:00'),
  ('Priya Patel',     'musicals',          array[0],         '13:00', '17:00'),
  ('Priya Patel',     'movies',            array[2],         '19:00', '22:00'),
  -- 🥾 hiking: 주말 아침
  ('Noah Fischer',    'hiking',            array[0,6],       '07:00', '12:00'),
  ('Noah Fischer',    'photography',       array[0],         '07:00', '10:00'),
  ('Emma Johansson',  'hiking',            array[0],         '08:00', '13:00'),
  ('Carlos Silva',    'hiking',            array[0,6],       '06:00', '10:00'),
  -- ☕ study: 평일 오전
  ('Liam O''Brien',   'study',             array[1,2,3,4,5], '10:00', '13:00'),
  ('Liam O''Brien',   'coffee',            array[1,2,3,4,5], '09:00', '10:00'),
  ('Zoe Dubois',      'study',             array[1,2,3,4],   '11:00', '14:00'),
  -- ⚾ baseball
  ('Ryan Park',       'baseball',          array[5],         '18:00', '22:00'),
  ('Ryan Park',       'baseball',          array[0],         '12:00', '16:00'),
  ('Tomás Garcia',    'baseball',          array[0],         '12:00', '17:00'),
  -- 🎤 karaoke / k-pop dance
  ('Mina Lee',        'karaoke',           array[4,6],       '20:00', '23:00'),
  ('Mina Lee',        'k-pop dance',       array[2],         '19:00', '21:00'),
  ('Grace Wu',        'karaoke',           array[4,6],       '20:00', '23:00'),
  ('Arjun Mehta',     'karaoke',           array[6],         '20:00', '23:00'),
  ('Arjun Mehta',     'k-pop dance',       array[2],         '19:00', '21:00'),
  -- 🎲 board games
  ('Oliver Smith',    'board games',       array[5],         '19:00', '23:00'),
  ('Oliver Smith',    'board games',       array[0],         '14:00', '18:00'),
  ('Fatima Ali',      'board games',       array[5],         '18:00', '21:00')
) as v(name, activity, days, start_t, end_t)
join students s on s.name = v.name
cross join lateral unnest(v.days) as d;