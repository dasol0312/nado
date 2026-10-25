-- Remove the retired public demo-reset RPC without changing any stored data.
-- Apply after the other 20261025 helper migrations on existing projects.
begin;
drop function if exists public.reset_demo();
commit;
