-- nado schema v3 (Cal Hacks 13.0 demo)
-- 앱 화면: 활동 고르기 → When2meet처럼 주간 시간표 드래그 (매주 반복)
-- 칠한 칸이 그대로 activity_slots 줄이 됨
-- Supabase > SQL Editor > New query 에 전체 붙여넣고 Run
-- ⚠️ 다시 실행하면 기존 테이블과 데이터를 전부 지우고 새로 만듦

drop table if exists messages, room_members, rooms, activity_slots, free_slots, places, students cascade;

-- 1. 학생 프로필
create table students (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_sample boolean not null default true,   -- 데모용 샘플 학생 표시
  created_at timestamptz not null default now()
);

-- 2. 하고 싶은 활동 + 요일 + 시간 (매주 반복)
--    드래그로 칠한 "농구 월·수 21~23시" → 월요일 한 줄, 수요일 한 줄
--    시각은 캠퍼스 현지 시간 (데모: 샌프란시스코)
create table activity_slots (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  activity text not null,                    -- 고른 활동: 'basketball', 'boba'
  day_of_week smallint not null check (day_of_week between 0 and 6),  -- 0=일 1=월 ... 6=토
  start_time time not null,                  -- 21:00
  end_time time not null,                    -- 23:00
  check (end_time > start_time)
);

-- 3. 만날 장소 목록 (데모용으로 미리 넣어둠)
create table places (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  good_for text[] not null default '{}'      -- ['boba', 'coffee', 'study']
);

-- 4. 방: Claude가 스스로 여는 모임 (실제 날짜·시각이 정해진 한 번의 만남)
create table rooms (
  id uuid primary key default gen_random_uuid(),
  activity text not null,                    -- 'boba'
  starts_at timestamptz not null,            -- 이번 주 일요일 15:00
  place_id uuid references places(id),
  invitation text,                           -- "Boba at 3, anyone?"
  icebreaker text,                           -- "What's your go-to order?"
  color text not null default '#FF8A3D',     -- Color Match 화면 색
  status text not null default 'open'
    check (status in ('open', 'confirmed', 'cancelled')),
  created_at timestamptz not null default now()
);

-- 5. 방 참여자: 초대받음(invited) → nado!(joined) / 거절(declined)
--    joined 인 사람만 톡방에 들어감
create table room_members (
  room_id uuid not null references rooms(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  status text not null default 'invited'
    check (status in ('invited', 'joined', 'declined')),
  responded_at timestamptz,
  primary key (room_id, student_id)
);

-- 6. 톡방 메시지 (student_id 비어 있으면 Claude가 보낸 메시지)
create table messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  student_id uuid references students(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

create index on activity_slots (activity, day_of_week);
create index on room_members (student_id);
create index on messages (room_id, created_at);

-- 실시간: 초대 도착, nado! 누르기, 톡방 메시지가 바로바로 뜨게
alter publication supabase_realtime add table rooms, room_members, messages;

-- 보안(RLS): 해커톤 데모용으로 누구나 읽고 쓸 수 있게 열어둠
-- 샘플 데이터만 쓰는 동안만 OK. 실제 학생 받기 전에 꼭 조이기
alter table students       enable row level security;
alter table activity_slots enable row level security;
alter table places         enable row level security;
alter table rooms          enable row level security;
alter table room_members   enable row level security;
alter table messages       enable row level security;

create policy "demo open access" on students       for all to anon, authenticated using (true) with check (true);
create policy "demo open access" on activity_slots for all to anon, authenticated using (true) with check (true);
create policy "demo open access" on places         for all to anon, authenticated using (true) with check (true);
create policy "demo open access" on rooms          for all to anon, authenticated using (true) with check (true);
create policy "demo open access" on room_members   for all to anon, authenticated using (true) with check (true);
create policy "demo open access" on messages       for all to anon, authenticated using (true) with check (true);
