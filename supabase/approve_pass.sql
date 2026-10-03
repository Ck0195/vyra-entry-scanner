alter table public.guests add column if not exists checked_in_at timestamptz;

create or replace function public.pp_approve_pass(p_pass_id text)
returns table(result text,message text,pass_id text,guest_name text,pass_type text,checked_in_at timestamptz)
language plpgsql security definer set search_path=public
as $$
declare g public.guests%rowtype; pid text;
begin
 pid:=upper(trim(p_pass_id));
 select * into g from public.guests where upper(trim(guests.pass_id))=pid limit 1 for update;
 if not found then
  return query select 'invalid'::text,'This Pass ID does not exist.'::text,pid,null::text,null::text,null::timestamptz; return;
 end if;
 if g.checked_in_at is not null or lower(coalesce(g.status,''))='checked_in' then
  return query select 'already'::text,'This pass has already been checked in.'::text,g.pass_id,g.name,g.pass_type,g.checked_in_at; return;
 end if;
 if lower(coalesce(g.status,'valid'))='revoked' then
  return query select 'invalid'::text,'This pass has been revoked.'::text,g.pass_id,g.name,g.pass_type,g.checked_in_at; return;
 end if;
 update public.guests set checked_in_at=now(),status='checked_in' where id=g.id;
 return query select 'approved'::text,'Entry approved.'::text,g.pass_id,g.name,g.pass_type,now();
end $$;

revoke all on function public.pp_approve_pass(text) from public;
grant execute on function public.pp_approve_pass(text) to anon,authenticated;