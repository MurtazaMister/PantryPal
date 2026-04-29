-- PantryPal minimal tables for guest persistence + custom units
create extension if not exists "pgcrypto";

create table if not exists public.guest_users (
  id uuid primary key default gen_random_uuid(),
  device_install_id text not null unique,
  guest_user_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_guest_users_guest_user_id on public.guest_users (guest_user_id);

create table if not exists public.custom_units (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  unit_name text not null,
  normalized_unit text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, normalized_unit)
);

create index if not exists idx_custom_units_user_id on public.custom_units (user_id);
