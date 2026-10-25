-- nado schema (NYU)
-- 흐름: 바쁜 시간 칠하기 + 관심사(최소 인원) → 지금부터 4시간 안 플랜 → Nado! → 전원 confirm → 방
-- Supabase > SQL Editor > New query 에 전체 붙여넣고 Run, 그다음 migrations/ 와 npm run seed:students
-- ⚠️ 다시 실행하면 기존 테이블과 데이터를 전부 지우고 새로 만듦
--
-- 매칭 코드(lib/nado)가 읽고 쓰는 컬럼:
--   activity_slots(student_id, activity, day_of_week, start_time, end_time, week_start)
--   places(id, name, good_for)
--   rooms(activity, starts_at, place_id, invitation, icebreaker, color, status)
--   room_members(room_id, student_id, status)

begin;

drop table if exists app_clock, messages, room_members, rooms, activity_slots, interests, busy_blocks,
  activities, free_slots, places, students cascade;

-- 1. 학생: NYU 이메일로 가입, 다른 학생에게는 닉네임만 보임
create table students (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  is_judge boolean not null default false,
  check (email is null or is_judge or email ~* '^[a-z0-9._%+-]+@nyu\.edu$'),
  nickname text not null unique,              -- 'Violet Otter'
  is_sample boolean not null default false,   -- 데모용 샘플 학생
  created_at timestamptz not null default now()
);

-- 2. 장소: 캠퍼스 건물(만나는 곳) + 근처 활동 장소
--    good_for 는 open-rooms 의 pickPlace 가 만남 장소를 고를 때 씀 → 캠퍼스 건물에만 넣기
create table places (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,                   -- 'kimmel' (지도 좌표는 lib/places.ts)
  name text not null,                         -- 'Kimmel Center lobby'
  description text,
  address text,
  is_campus boolean not null default false,
  ns_street text,
  ew_street text,
  far text check (far is null or far in ('', 'N', 'S', 'E', 'W')),
  confident boolean,
  good_for text[] not null default '{}'
);

-- 3. 활동 카탈로그: 기본 16개 + 학생이 추가한 것 (최대 인원은 AI가 정함)
create table activities (
  name text primary key,                      -- 'boba' (소문자, matching 에 쓰는 이름)
  label text not null,                        -- 'Boba'
  category text not null check (category in ('Sports','Cafe','Study','Food','Culture','Games','Place','Other')),
  max_size smallint not null check (max_size between 2 and 12),
  min_default smallint not null default 2 check (min_default between 2 and max_size),
  meet_place_id uuid references places(id),  -- 처음 만나는 캠퍼스 건물
  dest_place_id uuid references places(id),  -- 실제 활동 장소 (같을 수도 있음)
  reason text,                                -- AI가 정한 이유
  by_ai boolean not null default false,
  created_by uuid references students(id) on delete set null,
  created_at timestamptz not null default now()
);

-- 4. 바쁜 시간 (매주 반복). 여기 없는 9~23시는 전부 free
--    class = Albert 시간표, fixed = 알바/동아리 등, never = 절대 안 되는 시간
create table busy_blocks (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  kind text not null check (kind in ('class','fixed','never')),
  day_of_week smallint not null check (day_of_week between 0 and 6),  -- 0=일 1=월 ... 6=토
  start_time time not null,
  end_time time not null,
  label text,                                 -- 'CSCI-UA 102 Data Structures'
  check (end_time > start_time)
);

-- 5. 관심사 + 내가 원하는 최소 인원
create table interests (
  student_id uuid not null references students(id) on delete cascade,
  activity text not null references activities(name) on delete cascade,
  min_size smallint not null default 2 check (min_size between 2 and 12),
  primary key (student_id, activity)
);

-- 6. 매칭 입력 스냅샷 (사람이 직접 쓰지 않음)
--    /api/match 가 매분 "free 시간 ∩ 지금~4시간 후 × 관심사" 로 다시 만들어서 읽음
create table activity_slots (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  activity text not null,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  week_start date                             -- 그 주의 일요일. null = 매주 반복
    check (week_start is null or extract(dow from week_start) = 0),
  check (end_time > start_time)
);

-- 7. 방 (플랜). open → confirmed(방 열림) / cancelled(해산)
--    cancelled 방의 멤버는 open-rooms 가 다시 매칭 대상으로 봄 → 해산 후 재매칭
create table rooms (
  id uuid primary key default gen_random_uuid(),
  activity text not null,
  starts_at timestamptz not null,
  ends_at timestamptz check (ends_at is null or ends_at > starts_at),
  place_id uuid references places(id),        -- 만나는 곳 (캠퍼스)
  dest_place_id uuid references places(id),   -- 활동 장소
  place_reason text,
  invitation text,
  icebreaker text,
  color text not null default '#FF8A3D',
  min_size smallint not null default 2 check (min_size between 2 and max_size),
  max_size smallint not null default 6 check (max_size between 2 and 12),
  confirm_by timestamptz check (confirm_by is null or confirm_by < starts_at),
  context_label text,
  status text not null default 'open'
    check (status in ('open', 'confirmed', 'cancelled')),
  created_at timestamptz not null default now()
);

-- 8. 방 멤버: invited → joined(Nado!) → confirmed / cancelled(빠짐) / declined(마감까지 응답 없음)
create table room_members (
  room_id uuid not null references rooms(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  status text not null default 'invited'
    check (status in ('invited', 'joined', 'confirmed', 'cancelled', 'declined')),
  outfit jsonb,                               -- 30분 전 옷차림 힌트. 만난 뒤 지움
  responded_at timestamptz,
  found_at timestamptz,                       -- 이 멤버가 만남을 완료한 시각 (대상별 찾기 기록은 별도 설계)
  primary key (room_id, student_id)
);

-- 채팅/빠른 답장: student_id가 null이면 서버가 생성한 Claude 메시지
create table messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  student_id uuid references students(id) on delete cascade,
  content text not null check (length(btrim(content)) > 0),
  created_at timestamptz not null default now()
);
create index on messages (room_id, created_at);

-- 9. 데모 시계: 두 폰이 같은 "지금"을 보도록 한 줄만 둠 (base null = 실제 시간)
create table app_clock (
  id smallint primary key default 1 check (id = 1),
  base timestamptz,
  set_at timestamptz not null default now(),
  label text
);
insert into app_clock (id) values (1);

create index on busy_blocks (student_id);
create index on activity_slots (activity, day_of_week);
create index on activity_slots (student_id, week_start);
create index on rooms (starts_at);
create index on room_members (student_id);

-- 실시간: 새 플랜 도착, Nado!/confirm, 해산, 데모 시계
alter publication supabase_realtime add table rooms, room_members, messages, app_clock;

-- 보안(RLS): 해커톤 데모용으로 누구나 읽고 쓸 수 있게 열어둠
-- 샘플 데이터만 쓰는 동안만 OK. 실제 학생 받기 전에 꼭 조이기
alter table students       enable row level security;
alter table places         enable row level security;
alter table activities     enable row level security;
alter table busy_blocks    enable row level security;
alter table interests      enable row level security;
alter table activity_slots enable row level security;
alter table rooms          enable row level security;
alter table room_members   enable row level security;
alter table app_clock      enable row level security;
alter table messages       enable row level security;

create policy "demo open access" on students       for all to anon, authenticated using (true) with check (true);
create policy "demo open access" on places         for all to anon, authenticated using (true) with check (true);
create policy "demo open access" on activities     for all to anon, authenticated using (true) with check (true);
create policy "demo open access" on busy_blocks    for all to anon, authenticated using (true) with check (true);
create policy "demo open access" on interests      for all to anon, authenticated using (true) with check (true);
create policy "demo open access" on activity_slots for all to anon, authenticated using (true) with check (true);
create policy "demo open access" on rooms          for all to anon, authenticated using (true) with check (true);
create policy "demo open access" on room_members   for all to anon, authenticated using (true) with check (true);
create policy "demo open access" on app_clock      for all to anon, authenticated using (true) with check (true);

create policy "demo open access" on messages for all to anon, authenticated using (true) with check (true);

commit;
