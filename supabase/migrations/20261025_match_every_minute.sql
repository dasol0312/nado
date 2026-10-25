-- nado: 매칭을 1분마다, 매 분 정각(:00초)에
--
-- 1. 타이머: pg_cron '* * * * *' → 매 분 00초에 GET /api/match
--    (켜기/끄기는 그대로: select start_match_timer('https://<주소>/api/match', '<CRON_SECRET>'); / select stop_match_timer();)
-- 2. 한 분에 한 번만: 타이머, 열려 있는 폰들, 데모 버튼이 같은 분에 동시에 불러도
--    claim_match_minute() 가 처음 부른 하나만 true 를 돌려줌 → 같은 사람이 두 방에 들어가는 일을 막음
--    ("Check again now" 버튼은 force 로 이 확인을 건너뜀)

create table if not exists match_runs (
  minute timestamptz primary key,          -- 실제 시간 기준, 분 단위로 자른 값
  ran_at timestamptz not null default now()
);
alter table match_runs enable row level security;  -- 정책 없음: 아래 함수로만 씀

create or replace function claim_match_minute() returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_claimed int;
begin
  insert into match_runs (minute) values (date_trunc('minute', now())) on conflict do nothing;
  get diagnostics v_claimed = row_count;
  delete from match_runs where minute < now() - interval '1 day';
  return v_claimed = 1;
end;
$$;
grant execute on function claim_match_minute() to anon, authenticated;

create or replace function start_match_timer(p_url text, p_secret text default null)
returns bigint
language plpgsql security definer set search_path = public, cron, net as $$
begin
  perform cron.unschedule(jobid) from cron.job where jobname = 'nado-match';
  return cron.schedule(
    'nado-match',
    '* * * * *',
    format(
      $job$select net.http_get(url := %L, headers := %L::jsonb, timeout_milliseconds := 60000)$job$,
      p_url,
      case when p_secret is null then '{}' else json_build_object('Authorization', 'Bearer ' || p_secret)::text end
    )
  );
end;
$$;
revoke all on function start_match_timer(text, text) from public, anon, authenticated;
