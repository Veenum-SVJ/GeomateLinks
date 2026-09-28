-- Equipment Management System (EMS) — schema.
-- Same storage convention as every existing module: each record keeps its
-- full JSON payload in a jsonb `data` column; `id` is the primary key and
-- `created_at` exists for ordering. RLS stays enabled with zero policies —
-- only the service_role key (the API functions) can read or write.
--equipment_categories additionally carries `code` + a unique index, the same
-- pattern the CRM/DMS tables use for their codes.

-- ------------------------------------------------------------------ tables

-- `id` is TEXT, matching every existing module table: the stores generate
-- their own ids (newId() — stamp-random) and pass them on every write.
create table if not exists public.equipment (
  id text not null primary key,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.equipment_categories (
  id text not null primary key,
  data jsonb not null default '{}'::jsonb,
  code text,
  created_at timestamptz not null default now()
);

create table if not exists public.equipment_assignments (
  id text not null primary key,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.equipment_reservations (
  id text not null primary key,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.equipment_maintenance (
  id text not null primary key,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.equipment_calibrations (
  id text not null primary key,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.equipment_inspections (
  id text not null primary key,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.equipment_history (
  id text not null primary key,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------------ indexes

-- Store reads sort by created_at; list records fan out over these.
create index if not exists equipment_created_at_idx on public.equipment (created_at desc);
create index if not exists equipment_categories_created_at_idx on public.equipment_categories (created_at asc);
create index if not exists equipment_assignments_created_at_idx on public.equipment_assignments (created_at desc);
create index if not exists equipment_reservations_created_at_idx on public.equipment_reservations (created_at desc);
create index if not exists equipment_maintenance_created_at_idx on public.equipment_maintenance (created_at desc);
create index if not exists equipment_calibrations_created_at_idx on public.equipment_calibrations (created_at desc);
create index if not exists equipment_inspections_created_at_idx on public.equipment_inspections (created_at desc);
create index if not exists equipment_history_created_at_idx on public.equipment_history (created_at desc);

-- Codes: category prefix (GNSS → GML-GNSS-…) and the assignment's internal
-- reference follow the CRM/DMS unique-code convention.
create unique index if not exists equipment_categories_code_key on public.equipment_categories (code);

-- Integrity guards expressed in data (asset numbers are unique across the
-- equipment table, checked in the store too so errors read well).
create unique index if not exists equipment_asset_number_key on public.equipment ((data->>'assetNumber')) where data->>'assetNumber' <> '';

-- ------------------------------------------------------------------ seed

-- The store seeds categories on first read (system categories cannot be
-- deleted); nothing to insert here — see api/_lib/equipmentStore.js.

-- ------------------------------------------------------------------ counters

-- Asset numbers use the shared id_counters (kinds: equipment:<CATEGORY_CODE>)
-- via the existing public.bump_counter function — no counter table changes.
