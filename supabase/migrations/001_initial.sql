-- Sprint task planner schema
-- Run this in your Supabase SQL editor or via supabase db push

create table if not exists sprints (
  id         text primary key,
  name       text not null,
  start_date text not null,
  end_date   text not null,
  created_at timestamptz default now()
);

create table if not exists tasks (
  id         text primary key,
  sprint_id  text references sprints(id) on delete cascade,
  ticket     text not null default '',
  title      text not null,
  created_at timestamptz default now()
);

create table if not exists blocks (
  id        text primary key,
  task_id   text references tasks(id) on delete cascade,
  role      text not null check (role in ('FE', 'BE', 'MO')),
  mandays   numeric(5,2) not null,
  start_day numeric(5,2) not null default 0,
  created_at timestamptz default now()
);

-- Permissive RLS for internal tool (no auth).
-- Tighten with user-based policies when you add auth.
alter table sprints enable row level security;
alter table tasks   enable row level security;
alter table blocks  enable row level security;

create policy "public_all" on sprints for all using (true) with check (true);
create policy "public_all" on tasks   for all using (true) with check (true);
create policy "public_all" on blocks  for all using (true) with check (true);
