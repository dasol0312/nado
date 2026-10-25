-- nado v4.1 DB helpers (schema.sql 다음에 한 번 실행. 다시 실행해도 안전)
--
-- app_now()                  데모 시계까지 반영한 "지금"
-- build_activity_slots()     free 시간 ∩ 지금~4시간 × 관심사 → activity_slots 다시 만들기
--
-- 왜 DB 함수로?  Supabase API 는 한 번에 최대 1000줄만 돌려줘서, 800명 busy_blocks(약 8천 줄)를
-- 브라우저/서버로 가져와 계산하면 조용히 잘림. 여기서 계산하면 rpc 한 번으로 끝남.
--   const { data: count } = await sb.rpc("build_activity_slots")            // 지금(데모 시계 기준)
--   await sb.rpc("build_activity_slots", { p_now: "2026-10-26T14:00:00-04:00" })

-- 데모 시계: base 가 있으면 base 에서부터 실제 시간만큼 흘러감, 없으면 진짜 지금
create or replace function app_now() returns timestamptz
language sql stable set search_path = public as $$
  select coalesce(
    (select base + (now() - set_at) from app_clock where id = 1 and base is not null),
    now()
  )
$$;

-- 캠퍼스(뉴욕) 시간 기준으로, p_now 부터 p_hours 시간 안(9~21시로 자름)의 빈 시간을
-- 학생의 관심사마다 한 줄씩 activity_slots 에 넣음. 60분 미만 빈 시간은 버림.
-- 빼는 것: 그 요일 busy_blocks(class/fixed/never) + 그날 이미 들어가 있는 방 시간
-- 반환: 넣은 줄 수
create or replace function build_activity_slots(p_now timestamptz default null, p_hours int default 4)
returns integer
language plpgsql set search_path = public as $$
declare
  v_tz constant text := 'America/New_York';
  v_local timestamp := coalesce(p_now, app_now()) at time zone v_tz;
  v_date date := v_local::date;
  v_dow smallint := extract(dow from v_local)::smallint;
  v_now_min int := extract(hour from v_local)::int * 60 + extract(minute from v_local)::int;
  v_from int := greatest(v_now_min, 9 * 60);
  v_to int := least(v_now_min + p_hours * 60, 21 * 60);
  v_count int;
begin
  delete from activity_slots where true;
  if v_to - v_from < 60 then
    return 0;
  end if;

  insert into activity_slots (student_id, activity, day_of_week, start_time, end_time, week_start)
  with busy as (
    select b.student_id,
           int4range((extract(epoch from b.start_time) / 60)::int, (extract(epoch from b.end_time) / 60)::int) as r
    from busy_blocks b
    where b.day_of_week = v_dow
    union all
    select m.student_id,
           int4range(
             greatest(0, (extract(epoch from (r.starts_at at time zone v_tz) - v_date::timestamp) / 60)::int),
             least(1440, (extract(epoch from (coalesce(r.ends_at, r.starts_at + interval '1 hour') at time zone v_tz)
                                         - v_date::timestamp) / 60)::int))
    from rooms r
    join room_members m on m.room_id = r.id
    where r.status <> 'cancelled'
      and m.status in ('invited', 'joined', 'confirmed')
      and (r.starts_at at time zone v_tz)::date = v_date
  ), free as (
    select i.student_id,
           unnest(int4multirange(int4range(v_from, v_to))
                  - coalesce(range_agg(b.r), '{}'::int4multirange)) as f
    from (select distinct student_id from interests) i
    left join busy b on b.student_id = i.student_id
    group by i.student_id
  )
  select f.student_id, i.activity, v_dow,
         make_time(lower(f.f) / 60, lower(f.f) % 60, 0),
         make_time(upper(f.f) / 60, upper(f.f) % 60, 0),
         v_date - extract(dow from v_date)::int
  from free f
  join interests i on i.student_id = f.student_id
  where upper(f.f) - lower(f.f) >= 60;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function app_now(), build_activity_slots(timestamptz, int) to anon, authenticated;
