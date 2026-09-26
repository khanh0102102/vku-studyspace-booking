-- VKU StudySpace — production authentication and server-authoritative booking rules
-- Apply after the existing realtime booking migrations.

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(trim(full_name)) >= 2),
  student_id text not null unique check (char_length(trim(student_id)) >= 3),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

revoke all on public.profiles from anon;
grant usage on schema public to authenticated;
grant select, update on public.profiles to authenticated;

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_email text := lower(coalesce(new.email, ''));
  normalized_name text := trim(coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  normalized_student_id text := upper(trim(coalesce(new.raw_user_meta_data ->> 'student_id', '')));
begin
  if normalized_email !~ '^[^@[:space:]]+@vku[.]udn[.]vn$' then
    raise exception 'Only @vku.udn.vn student accounts are allowed'
      using errcode = '22023';
  end if;

  if char_length(normalized_name) < 2 or char_length(normalized_student_id) < 3 then
    raise exception 'Full name and student ID are required'
      using errcode = '22023';
  end if;

  insert into public.profiles (user_id, full_name, student_id)
  values (new.id, normalized_name, normalized_student_id)
  on conflict (user_id) do update
    set full_name = excluded.full_name,
        student_id = excluded.student_id,
        updated_at = now();

  -- Preserve the existing demo/test reservations made before Auth was introduced.
  update public.reservations
     set user_id = new.id
   where user_id is null
     and upper(trim(student_id)) = normalized_student_id;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

alter table public.reservations
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists reservations_user_idx
  on public.reservations (user_id);

create unique index if not exists reservations_user_slot_uq
  on public.reservations (user_id, date_key, slot_id)
  where user_id is not null;

-- Existing rows are retained as legacy/test availability until a matching profile is created.

create table if not exists public.rooms (
  id text primary key,
  name text not null,
  building text not null check (building in ('A', 'B', 'C', 'V')),
  floor text not null,
  capacity integer not null check (capacity between 2 and 20),
  equipment text[] not null default '{}',
  image_url text not null,
  description text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.room_busy_rules (
  room_id text not null references public.rooms(id) on delete cascade,
  weekday integer not null check (weekday between 0 and 6),
  slot_id text not null check (
    slot_id in ('morning-1', 'morning-2', 'afternoon-1', 'afternoon-2')
  ),
  primary key (room_id, weekday, slot_id)
);

alter table public.rooms enable row level security;
alter table public.room_busy_rules enable row level security;

grant select on public.rooms, public.room_busy_rules to authenticated;

drop policy if exists "Authenticated users can read active rooms" on public.rooms;
create policy "Authenticated users can read active rooms"
  on public.rooms
  for select
  to authenticated
  using (active = true);

drop policy if exists "Authenticated users can read room schedules" on public.room_busy_rules;
create policy "Authenticated users can read room schedules"
  on public.room_busy_rules
  for select
  to authenticated
  using (true);

insert into public.rooms (id, name, building, floor, capacity, equipment, image_url, description)
values
  ('a-201', 'Focus Room A201', 'A', 'Floor 2', 4, array['Whiteboard', 'AC'], 'https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=900&q=80', 'Quiet four-seat room for focused pair work and discussion.'),
  ('a-305', 'Collaboration Lab A305', 'A', 'Floor 3', 12, array['Projector', 'Whiteboard', 'AC'], 'https://images.unsplash.com/photo-1517502884422-41eaead166d4?auto=format&fit=crop&w=900&q=80', 'Flexible teamwork room with a projector for presentations.'),
  ('b-102', 'Study Pod B102', 'B', 'Floor 1', 2, array['Whiteboard', 'AC'], 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=80', 'A compact, private pod for a study buddy session.'),
  ('b-401', 'Digital Lab B401', 'B', 'Floor 4', 20, array['High-spec PC', 'Projector', 'AC'], 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=900&q=80', 'High-performance PCs for programming, rendering and group labs.'),
  ('c-204', 'Seminar Room C204', 'C', 'Floor 2', 16, array['Projector', 'Whiteboard', 'AC'], 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=900&q=80', 'Bright seminar room with a full presentation setup.'),
  ('c-501', 'Quiet Corner C501', 'C', 'Floor 5', 6, array['Whiteboard', 'AC'], 'https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=900&q=80', 'A calm study room for small groups working without distractions.'),
  ('v-110', 'Innovation Hub V110', 'V', 'Floor 1', 10, array['High-spec PC', 'Projector', 'Whiteboard', 'AC'], 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=900&q=80', 'An idea-friendly hub for workshops, prototypes and presentations.'),
  ('v-307', 'Design Studio V307', 'V', 'Floor 3', 8, array['High-spec PC', 'Whiteboard', 'AC'], 'https://images.unsplash.com/photo-1497366412874-3415097a27e7?auto=format&fit=crop&w=900&q=80', 'A hands-on studio with powerful computers for design work.')
on conflict (id) do update set
  name = excluded.name,
  building = excluded.building,
  floor = excluded.floor,
  capacity = excluded.capacity,
  equipment = excluded.equipment,
  image_url = excluded.image_url,
  description = excluded.description,
  active = true;

insert into public.room_busy_rules (room_id, weekday, slot_id)
values
  ('a-201', 1, 'morning-1'),
  ('a-201', 3, 'morning-1'),
  ('a-201', 5, 'morning-1'),
  ('a-305', 2, 'afternoon-1'),
  ('a-305', 2, 'afternoon-2'),
  ('a-305', 4, 'afternoon-1'),
  ('a-305', 4, 'afternoon-2'),
  ('b-102', 1, 'morning-2'),
  ('b-102', 2, 'morning-2'),
  ('b-102', 3, 'morning-2'),
  ('b-102', 4, 'morning-2'),
  ('b-102', 5, 'morning-2'),
  ('b-401', 1, 'afternoon-1'),
  ('b-401', 3, 'afternoon-1'),
  ('c-204', 2, 'morning-1'),
  ('c-204', 2, 'morning-2'),
  ('c-204', 5, 'morning-1'),
  ('c-204', 5, 'morning-2'),
  ('c-501', 3, 'afternoon-2'),
  ('v-110', 1, 'morning-1'),
  ('v-110', 1, 'afternoon-2'),
  ('v-110', 4, 'morning-1'),
  ('v-110', 4, 'afternoon-2'),
  ('v-307', 2, 'afternoon-1'),
  ('v-307', 3, 'afternoon-1'),
  ('v-307', 5, 'afternoon-1')
on conflict (room_id, weekday, slot_id) do nothing;

drop function if exists public.reserve_room(text, text, text, text, text, date, text, text, timestamptz, timestamptz, text);
drop function if exists public.cancel_booking(text, text);

create or replace function public.reserve_room(
  p_room_id text,
  p_date_key date,
  p_slot_id text
)
returns public.reservations
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_student_id text;
  v_room public.rooms;
  v_start_time time;
  v_end_time time;
  v_start_at timestamptz;
  v_end_at timestamptz;
  inserted public.reservations;
  v_today date := timezone('Asia/Ho_Chi_Minh', now())::date;
begin
  if v_user_id is null then
    raise exception 'You must be signed in to reserve a room'
      using errcode = '42501';
  end if;

  select * into v_room
    from public.rooms
   where id = trim(p_room_id)
     and active = true;

  if not found then
    raise exception 'This room is not available'
      using errcode = '22023';
  end if;

  select student_id into v_student_id
    from public.profiles
   where user_id = v_user_id;

  if v_student_id is null then
    raise exception 'Student profile is missing'
      using errcode = '42501';
  end if;

  if p_date_key < v_today or p_date_key > v_today + 6 then
    raise exception 'Booking date must be within the next 7 calendar days'
      using errcode = '22023';
  end if;

  case p_slot_id
    when 'morning-1' then
      v_start_time := '07:30';
      v_end_time := '09:30';
    when 'morning-2' then
      v_start_time := '09:30';
      v_end_time := '11:30';
    when 'afternoon-1' then
      v_start_time := '13:00';
      v_end_time := '15:00';
    when 'afternoon-2' then
      v_start_time := '15:00';
      v_end_time := '17:00';
    else
      raise exception 'Invalid VKU time slot'
        using errcode = '22023';
  end case;

  v_start_at := ((p_date_key::text || ' ' || v_start_time::text)::timestamp at time zone 'Asia/Ho_Chi_Minh');
  v_end_at := ((p_date_key::text || ' ' || v_end_time::text)::timestamp at time zone 'Asia/Ho_Chi_Minh');

  if v_start_at <= now() then
    raise exception 'This time slot has already started'
      using errcode = '22023';
  end if;

  if exists (
    select 1
      from public.room_busy_rules
     where room_id = v_room.id
       and weekday = extract(dow from p_date_key)::int
       and slot_id = p_slot_id
  ) then
    raise exception 'This slot is unavailable in the room schedule'
      using errcode = '22023';
  end if;

  insert into public.reservations (
    id,
    user_id,
    room_id,
    room_name,
    building,
    floor,
    date_key,
    slot_id,
    slot_label,
    start_at,
    end_at,
    student_id
  )
  values (
    gen_random_uuid()::text,
    v_user_id,
    v_room.id,
    v_room.name,
    v_room.building,
    v_room.floor,
    p_date_key,
    p_slot_id,
    to_char(v_start_time, 'HH24:MI') || ' – ' || to_char(v_end_time, 'HH24:MI'),
    v_start_at,
    v_end_at,
    v_student_id
  )
  returning * into inserted;

  return inserted;
exception
  when unique_violation then
    raise exception 'This room or your selected time slot was just booked'
      using errcode = '23505';
end;
$$;

create or replace function public.cancel_booking(
  p_id text
)
returns public.reservations
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  deleted public.reservations;
begin
  if v_user_id is null then
    raise exception 'You must be signed in to cancel a reservation'
      using errcode = '42501';
  end if;

  delete from public.reservations
   where id = p_id
     and user_id = v_user_id
     and start_at > now()
  returning * into deleted;

  if deleted.id is null then
    raise exception 'Reservation was not found, is not yours, or has already started'
      using errcode = '42501';
  end if;

  return deleted;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.reserve_room(text, date, text) from public, anon;
revoke all on function public.cancel_booking(text) from public, anon;

grant execute on function public.reserve_room(text, date, text) to authenticated;
grant execute on function public.cancel_booking(text) to authenticated;

alter table public.reservations enable row level security;

revoke select on public.reservations from anon;
revoke select on public.reservations from authenticated;

grant select (
  id,
  user_id,
  room_id,
  room_name,
  building,
  floor,
  date_key,
  slot_id,
  slot_label,
  start_at,
  end_at,
  created_at
) on public.reservations to authenticated;

drop policy if exists "Public can read active reservations" on public.reservations;
drop policy if exists "Authenticated users can read active reservations" on public.reservations;
create policy "Authenticated users can read active reservations"
  on public.reservations
  for select
  to authenticated
  using (true);

revoke insert, update, delete on public.reservations from anon, authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_rel pr
    join pg_publication p on p.oid = pr.prpubid
    join pg_class c on c.oid = pr.prrelid
    join pg_namespace n on n.oid = c.relnamespace
    where p.pubname = 'supabase_realtime'
      and n.nspname = 'public'
      and c.relname = 'reservations'
  ) then
    execute 'alter publication supabase_realtime add table public.reservations';
  end if;
end
$$;
