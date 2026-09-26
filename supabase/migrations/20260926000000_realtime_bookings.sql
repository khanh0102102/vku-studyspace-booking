-- VKU StudySpace — Supabase realtime booking backend
-- Run this migration in the Supabase SQL Editor before starting the Expo app.

create table if not exists public.reservations (
  id text primary key,
  room_id text not null,
  room_name text not null,
  building text not null check (building in ('A', 'B', 'C', 'V')),
  floor text not null,
  date_key date not null,
  slot_id text not null check (
    slot_id in ('morning-1', 'morning-2', 'afternoon-1', 'afternoon-2')
  ),
  slot_label text not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  student_id text not null,
  created_at timestamptz not null default now(),
  constraint reservations_time_order check (start_at < end_at)
);

create unique index if not exists reservations_active_slot_uq
  on public.reservations (room_id, date_key, slot_id);

create index if not exists reservations_date_idx
  on public.reservations (date_key);

create index if not exists reservations_student_idx
  on public.reservations (student_id);

create index if not exists reservations_start_at_idx
  on public.reservations (start_at);

create or replace function public.validate_reservation_input(
  p_date_key date,
  p_slot_id text,
  p_start_at timestamptz,
  p_end_at timestamptz
)
returns void
language plpgsql
as $$
begin
  if p_date_key < (timezone('Asia/Ho_Chi_Minh', now())::date) or p_date_key > (timezone('Asia/Ho_Chi_Minh', now())::date + 6) then
    raise exception 'Booking date must be within the next 7 calendar days'
      using errcode = '22023';
  end if;

  if p_slot_id not in ('morning-1', 'morning-2', 'afternoon-1', 'afternoon-2') then
    raise exception 'Invalid VKU time slot'
      using errcode = '22023';
  end if;

  if p_start_at >= p_end_at then
    raise exception 'Booking end time must be after the start time'
      using errcode = '22023';
  end if;

  if p_start_at <= now() then
    raise exception 'This time slot has already started'
      using errcode = '22023';
  end if;
end;
$$;

create or replace function public.reserve_room(
  p_id text,
  p_room_id text,
  p_room_name text,
  p_building text,
  p_floor text,
  p_date_key date,
  p_slot_id text,
  p_slot_label text,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_student_id text
)
returns public.reservations
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted public.reservations;
begin
  perform public.validate_reservation_input(p_date_key, p_slot_id, p_start_at, p_end_at);

  if p_building not in ('A', 'B', 'C', 'V') then
    raise exception 'Invalid VKU building'
      using errcode = '22023';
  end if;

  if nullif(trim(p_room_id), '') is null
     or nullif(trim(p_room_name), '') is null
     or nullif(trim(p_student_id), '') is null then
    raise exception 'Room and student identifiers are required'
      using errcode = '22023';
  end if;

  insert into public.reservations (
    id,
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
    p_id,
    p_room_id,
    p_room_name,
    p_building,
    p_floor,
    p_date_key,
    p_slot_id,
    p_slot_label,
    p_start_at,
    p_end_at,
    trim(p_student_id)
  )
  returning * into inserted;

  return inserted;
exception
  when unique_violation then
    raise exception 'This room and time slot was just booked by another student'
      using errcode = '23505';
end;
$$;

create or replace function public.cancel_booking(
  p_id text,
  p_student_id text
)
returns public.reservations
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted public.reservations;
begin
  delete from public.reservations
   where id = p_id
     and student_id = trim(p_student_id)
  returning * into deleted;

  if deleted.id is null then
    raise exception 'Reservation was not found or does not belong to this student'
      using errcode = '42501';
  end if;

  return deleted;
end;
$$;

grant usage on schema public to anon, authenticated;
grant select on public.reservations to anon, authenticated;
grant execute on function public.reserve_room(
  text, text, text, text, text, date, text, text, timestamptz, timestamptz, text
) to anon, authenticated;
grant execute on function public.cancel_booking(text, text) to anon, authenticated;

alter table public.reservations enable row level security;

drop policy if exists "Public can read active reservations" on public.reservations;
create policy "Public can read active reservations"
  on public.reservations
  for select
  to anon, authenticated
  using (true);

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
