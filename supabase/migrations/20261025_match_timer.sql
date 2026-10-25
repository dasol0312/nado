-- nado: 매칭 타이머 (Supabase pg_cron → GET /api/match). 지금은 1분마다: 20261025_match_every_minute.sql
-- Vercel 무료 플랜은 cron이 하루 한 번까지라서, 타이머는 DB 쪽에 둔다.
--
-- 이 파일은 함수만 만든다. 배포 후 SQL Editor에서 한 번:
--   select start_match_timer('https://<vercel-주소>/api/match', '<CRON_SECRET 값>');
-- 끄기:
--   select stop_match_timer();
-- 실행 기록 보기:
--   select * from cron.job_run_details order by start_time desc limit 10;

create extension if not exists pg_cron;
create extension if not exists pg_net;

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

create or replace function stop_match_timer()
returns void
language sql security definer set search_path = public, cron as $$
  select cron.unschedule(jobid) from cron.job where jobname = 'nado-match';
$$;

-- 앱(anon)에서는 못 부르게: SQL Editor(관리자)에서만
revoke all on function start_match_timer(text, text) from public, anon, authenticated;
revoke all on function stop_match_timer() from public, anon, authenticated;
