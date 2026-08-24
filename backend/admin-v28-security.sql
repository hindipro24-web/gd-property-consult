-- GD Property Admin V28 production security migration
-- Run once in Supabase SQL Editor before sharing non-super-admin accounts.

create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from public.admin_profiles
    where user_id = auth.uid() and role = 'super_admin' and active = true
  );
$$;

drop policy if exists "admin all" on public.leads;
drop policy if exists "super admin read leads" on public.leads;
drop policy if exists "super admin update leads" on public.leads;
drop policy if exists "super admin delete leads" on public.leads;
create policy "super admin read leads" on public.leads for select using (public.is_super_admin());
create policy "super admin update leads" on public.leads for update using (public.is_super_admin()) with check (public.is_super_admin());
create policy "super admin delete leads" on public.leads for delete using (public.is_super_admin());

create or replace function public.protect_advanced_site_settings()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if public.is_active_admin() and not public.is_super_admin() and (
    new.seo_title is distinct from old.seo_title or
    new.seo_description is distinct from old.seo_description or
    new.seo_keywords is distinct from old.seo_keywords or
    new.custom_css is distinct from old.custom_css or
    new.maintenance_mode is distinct from old.maintenance_mode
  ) then
    raise exception 'Only the super admin can change SEO, custom CSS or maintenance mode';
  end if;
  return new;
end; $$;

drop trigger if exists protect_advanced_site_settings_trigger on public.gd_site_settings;
create trigger protect_advanced_site_settings_trigger
before update on public.gd_site_settings
for each row execute function public.protect_advanced_site_settings();

grant execute on function public.is_super_admin() to authenticated;
