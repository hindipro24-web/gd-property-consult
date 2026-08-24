-- GD Property Admin V32: Sales Manager automation foundation
-- Run once in Supabase SQL Editor. Safe to re-run.

alter table public.admin_profiles add column if not exists full_name text;
alter table public.admin_profiles add column if not exists email text;
alter table public.admin_profiles add column if not exists phone text;
alter table public.admin_profiles add column if not exists team_role text default 'Sales agent';

alter table public.leads add column if not exists assigned_to uuid references public.admin_profiles(user_id) on delete set null;
alter table public.leads add column if not exists follow_up_at timestamptz;
alter table public.leads add column if not exists next_action text;
alter table public.leads add column if not exists last_contacted_at timestamptz;

create index if not exists leads_assigned_to_idx on public.leads(assigned_to);
create index if not exists leads_follow_up_at_idx on public.leads(follow_up_at) where deleted_at is null;

create table if not exists public.automation_rules (
  id uuid primary key default gen_random_uuid(),
  rule_key text unique not null,
  name text not null,
  description text,
  channel text not null check (channel in ('email','whatsapp','internal')),
  template_name text,
  enabled boolean not null default true,
  delay_minutes integer not null default 0 check (delay_minutes >= 0),
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.automation_jobs (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete cascade,
  rule_key text not null,
  channel text not null check (channel in ('email','whatsapp','internal')),
  recipient text,
  template_name text,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued','processing','sent','failed','cancelled')),
  scheduled_for timestamptz not null default now(),
  attempts integer not null default 0,
  last_error text,
  provider_response jsonb,
  dedupe_key text unique,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists automation_jobs_queue_idx on public.automation_jobs(status,scheduled_for);
create index if not exists automation_jobs_lead_idx on public.automation_jobs(lead_id,created_at desc);

insert into public.automation_rules(rule_key,name,description,channel,template_name,enabled,delay_minutes,sort_order)
values
  ('new_lead_agent_email','New lead owner alert','Email the assigned sales owner immediately','email','gd_new_lead_agent',true,0,10),
  ('new_lead_customer_whatsapp','Instant WhatsApp acknowledgement','Confirm the enquiry with an approved WhatsApp template','whatsapp','gd_lead_received',false,0,20),
  ('follow_up_reminder','Follow-up SLA reminder','Email the owner when a scheduled follow-up becomes due','email','gd_follow_up_due',true,0,30),
  ('visit_confirmation','Site visit confirmation','Send an approved visit confirmation template to the customer','whatsapp','gd_visit_confirmed',false,0,40)
on conflict(rule_key) do update set
  name=excluded.name,
  description=excluded.description,
  channel=excluded.channel,
  template_name=excluded.template_name,
  sort_order=excluded.sort_order,
  updated_at=now();

alter table public.automation_rules enable row level security;
alter table public.automation_jobs enable row level security;

drop policy if exists "super admin manage automation rules" on public.automation_rules;
create policy "super admin manage automation rules" on public.automation_rules
for all using (public.is_super_admin()) with check (public.is_super_admin());

drop policy if exists "super admin manage automation jobs" on public.automation_jobs;
create policy "super admin manage automation jobs" on public.automation_jobs
for all using (public.is_super_admin()) with check (public.is_super_admin());

create or replace function public.v32_agent_email(p_user_id uuid)
returns text language sql stable security definer set search_path=public as $$
  select coalesce(ap.email,au.email)
  from public.admin_profiles ap
  left join auth.users au on au.id=ap.user_id
  where ap.user_id=p_user_id and ap.active=true
  limit 1;
$$;

create or replace function public.v32_prepare_lead()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.assigned_to is null then
    select ap.user_id into new.assigned_to
    from public.admin_profiles ap
    left join public.leads l on l.assigned_to=ap.user_id and l.deleted_at is null and coalesce(l.status,'NEW') not in ('WON','LOST')
    where ap.active=true and ap.role in ('super_admin','admin')
    group by ap.user_id,ap.created_at
    order by count(l.id),ap.created_at
    limit 1;
  end if;
  if new.follow_up_at is null then new.follow_up_at=now()+interval '15 minutes'; end if;
  if nullif(trim(coalesce(new.next_action,'')),'') is null then new.next_action='Call within 15 minutes'; end if;
  return new;
end;
$$;

drop trigger if exists v32_prepare_lead_trigger on public.leads;
create trigger v32_prepare_lead_trigger before insert on public.leads
for each row execute function public.v32_prepare_lead();

create or replace function public.v32_queue_job(
  p_lead_id uuid,
  p_rule_key text,
  p_recipient text,
  p_scheduled_for timestamptz,
  p_dedupe_key text
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_rule public.automation_rules%rowtype; v_id uuid;
begin
  select * into v_rule from public.automation_rules where rule_key=p_rule_key and enabled=true;
  if not found or nullif(trim(coalesce(p_recipient,'')),'') is null then return null; end if;
  insert into public.automation_jobs(lead_id,rule_key,channel,recipient,template_name,scheduled_for,dedupe_key,payload)
  select l.id,v_rule.rule_key,v_rule.channel,p_recipient,v_rule.template_name,
    coalesce(p_scheduled_for,now())+(v_rule.delay_minutes||' minutes')::interval,p_dedupe_key,
    jsonb_build_object(
      'lead_id',l.id,'lead_reference',l.lead_id,'full_name',l.full_name,'mobile',l.mobile,'email',l.email,
      'property_name',l.property_name,'location',l.location,'status',l.status,'next_action',l.next_action,
      'follow_up_at',l.follow_up_at,'assigned_to',l.assigned_to
    )
  from public.leads l where l.id=p_lead_id
  on conflict(dedupe_key) do nothing returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.v32_enqueue_lead_automation()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_owner_email text; v_followup_key text;
begin
  v_owner_email=public.v32_agent_email(new.assigned_to);
  if tg_op='INSERT' then
    perform public.v32_queue_job(new.id,'new_lead_agent_email',v_owner_email,now(),new.id||':new-lead-email');
    perform public.v32_queue_job(new.id,'new_lead_customer_whatsapp',new.mobile,now(),new.id||':new-lead-whatsapp');
  end if;
  if new.follow_up_at is not null and (tg_op='INSERT' or new.follow_up_at is distinct from old.follow_up_at) then
    v_followup_key=new.id||':followup:'||extract(epoch from new.follow_up_at)::bigint;
    perform public.v32_queue_job(new.id,'follow_up_reminder',v_owner_email,new.follow_up_at,v_followup_key);
  end if;
  if new.status='VISIT BOOKED' and (tg_op='INSERT' or new.status is distinct from old.status) then
    perform public.v32_queue_job(new.id,'visit_confirmation',new.mobile,now(),new.id||':visit-confirmation');
  end if;
  return new;
end;
$$;

drop trigger if exists v32_enqueue_lead_automation_trigger on public.leads;
create trigger v32_enqueue_lead_automation_trigger after insert or update of status,follow_up_at,assigned_to on public.leads
for each row execute function public.v32_enqueue_lead_automation();

create or replace function public.claim_automation_jobs(p_limit integer default 20)
returns setof public.automation_jobs language plpgsql security definer set search_path=public as $$
begin
  update public.automation_jobs
  set status='queued',last_error='Worker timeout; automatically requeued',updated_at=now()
  where status='processing' and updated_at<now()-interval '10 minutes' and attempts<5;
  update public.automation_jobs
  set status='failed',last_error=coalesce(last_error,'Maximum delivery attempts reached'),updated_at=now()
  where status in ('queued','processing') and attempts>=5;
  return query
  with claimed as (
    select id from public.automation_jobs
    where status='queued' and scheduled_for<=now() and attempts<5
    order by scheduled_for for update skip locked limit greatest(1,least(p_limit,100))
  )
  update public.automation_jobs j set status='processing',attempts=j.attempts+1,updated_at=now()
  from claimed where j.id=claimed.id returning j.*;
end;
$$;

create or replace function public.complete_automation_job(
  p_job_id uuid,
  p_success boolean,
  p_response jsonb default '{}'::jsonb,
  p_error text default null
) returns void language plpgsql security definer set search_path=public as $$
begin
  update public.automation_jobs set
    status=case when p_success then 'sent' else 'failed' end,
    provider_response=p_response,
    last_error=case when p_success then null else left(coalesce(p_error,'Provider request failed'),1000) end,
    processed_at=case when p_success then now() else processed_at end,
    updated_at=now()
  where id=p_job_id and status='processing';
end;
$$;

revoke all on function public.v32_agent_email(uuid) from public,anon,authenticated;
revoke all on function public.v32_queue_job(uuid,text,text,timestamptz,text) from public,anon,authenticated;
revoke all on function public.claim_automation_jobs(integer) from public,anon,authenticated;
revoke all on function public.complete_automation_job(uuid,boolean,jsonb,text) from public,anon,authenticated;
grant execute on function public.claim_automation_jobs(integer) to service_role;
grant execute on function public.complete_automation_job(uuid,boolean,jsonb,text) to service_role;
grant select,update on public.automation_jobs to service_role;

notify pgrst,'reload schema';
