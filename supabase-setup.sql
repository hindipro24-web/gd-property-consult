-- GD Property Consult: idempotent Supabase setup
create extension if not exists pgcrypto;

create table if not exists public.admin_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'admin' check (role in ('super_admin','admin','editor')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.gd_site_settings (
  id integer primary key default 1 check (id = 1),
  site_name text default 'GD Property', site_suffix text default 'CONSULT', tagline text,
  logo_url text, favicon_url text, primary_color text, secondary_color text, dark_color text, light_color text,
  hero_kicker text, hero_title text, hero_highlight text, hero_subtitle text, hero_image_url text,
  hero_primary_label text, hero_primary_url text, hero_secondary_label text, hero_secondary_url text,
  hero_property_id uuid, properties_eyebrow text, properties_heading text, properties_description text,
  market_heading text, market_eyebrow text, market_description text, market_core_text text,
  intelligence_title text, intelligence_status text, intelligence_nodes_text text,
  market_listings_label text, market_listings_value text, market_average_label text,
  market_average_value text, market_top_location_label text, market_top_location_value text,
  market_stats_auto boolean default true, show_intelligence_radar boolean default true,
  services_heading text, about_heading text, about_text_1 text, about_text_2 text, about_image_url text,
  testimonials_heading text, insights_eyebrow text, insights_heading text, insights_description text,
  faq_heading text, cta_heading text, cta_button_label text,
  phone text, whatsapp_number text, whatsapp_message text, email text, business_hours text, address text,
  instagram_url text, facebook_url text, x_url text, linkedin_url text,
  footer_description text, footer_slogan text, seo_title text, seo_description text, seo_keywords text,
  custom_css text, maintenance_mode boolean default false,
  show_properties boolean default true, show_market boolean default true, show_services boolean default true,
  show_emi boolean default true, show_about boolean default true, show_testimonials boolean default true,
  show_blog boolean default true, show_faq boolean default true, show_contact boolean default true,
  updated_at timestamptz not null default now()
);
insert into public.gd_site_settings(id) values (1) on conflict (id) do nothing;

create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(), title text not null, slug text unique,
  property_type text, listing_purpose text, location text, city text, price_label text,
  price_amount numeric, bhk text, area text, status_label text, builder_name text, rera_number text,
  main_image text, gallery_images text[] default '{}', amenities text[] default '{}', configurations jsonb default '[]',
  map_label text, latitude double precision, longitude double precision, map_embed_url text,
  map_description text, show_map boolean default true, description text,
  verified boolean default false, featured boolean default false, published boolean default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(), lead_id text unique not null, full_name text not null,
  mobile text not null, email text, contact_method text, looking_for text, property_type text,
  location text, bhk text, budget text, timeline text, loan_required text, contact_time text,
  property_id uuid, property_name text, property_price text, property_area text,
  requirements text, source text, page_url text, lead_score integer default 0,
  status text default 'NEW', notes text, deleted_at timestamptz, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.testimonials (
  id uuid primary key default gen_random_uuid(), client_name text not null, client_role text,
  project_name text, location text, quote text, poster_image_url text, avatar_url text,
  rating integer default 5, featured boolean default false, published boolean default true,
  sort_order integer default 0, created_at timestamptz not null default now()
);

create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(), title text not null, slug text unique,
  category text, author text, excerpt text, content text, cover_image text, featured boolean default false,
  published boolean default false, published_at timestamptz, created_at timestamptz not null default now()
);

create table if not exists public.media_trash (
  id uuid primary key default gen_random_uuid(), original_path text not null, trash_path text unique not null,
  file_name text, public_url text, deleted_by uuid, deleted_at timestamptz not null default now()
);

create or replace function public.is_active_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.admin_profiles where user_id = auth.uid() and active = true);
$$;

create or replace function public.claim_super_admin()
returns public.admin_profiles language plpgsql security definer set search_path = public as $$
declare result public.admin_profiles;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if exists(select 1 from public.admin_profiles where role='super_admin' and active=true) then
    raise exception 'super admin already exists';
  end if;
  insert into public.admin_profiles(user_id,role,active) values(auth.uid(),'super_admin',true)
  on conflict(user_id) do update set role='super_admin',active=true returning * into result;
  return result;
end; $$;

alter table public.admin_profiles enable row level security;
alter table public.gd_site_settings enable row level security;
alter table public.properties enable row level security;
alter table public.leads enable row level security;
alter table public.testimonials enable row level security;
alter table public.blog_posts enable row level security;
alter table public.media_trash enable row level security;

drop policy if exists "public read settings" on public.gd_site_settings;
create policy "public read settings" on public.gd_site_settings for select using (true);
drop policy if exists "public read properties" on public.properties;
create policy "public read properties" on public.properties for select using (published or public.is_active_admin());
drop policy if exists "public create leads" on public.leads;
create policy "public create leads" on public.leads for insert with check (true);
drop policy if exists "public read testimonials" on public.testimonials;
create policy "public read testimonials" on public.testimonials for select using (published or public.is_active_admin());
drop policy if exists "public read posts" on public.blog_posts;
create policy "public read posts" on public.blog_posts for select using (published or public.is_active_admin());

do $$ declare t text; begin
  foreach t in array array['admin_profiles','gd_site_settings','properties','leads','testimonials','blog_posts','media_trash'] loop
    execute format('drop policy if exists "admin all" on public.%I',t);
    execute format('create policy "admin all" on public.%I for all using (public.is_active_admin()) with check (public.is_active_admin())',t);
  end loop;
end $$;

insert into storage.buckets(id,name,public) values('site-media','site-media',true)
on conflict(id) do update set public=true;
drop policy if exists "public read site media" on storage.objects;
create policy "public read site media" on storage.objects for select using (bucket_id='site-media');
drop policy if exists "admin manage site media" on storage.objects;
create policy "admin manage site media" on storage.objects for all
using (bucket_id='site-media' and public.is_active_admin())
with check (bucket_id='site-media' and public.is_active_admin());

grant execute on function public.claim_super_admin() to authenticated;
grant execute on function public.is_active_admin() to anon, authenticated;
