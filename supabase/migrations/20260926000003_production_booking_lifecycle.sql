-- VKU StudySpace — production booking lifecycle and privacy model
-- Private reservation records stay owner-only.
-- Public booking occupancy exposes only room/date/slot data required for realtime availability.

alter table public.reservations
  add column if not exists status text not null default 'confirmed',
  add column if not exists cancelled_at timestamptz,
  add column if not exists checked_in_at timestamptz;

update public.reservations
   set status = 'confirmed'
 where status is null;

alter table public.reservations
  drop constraint if exists reservations_status_check;

alter table public.reservations
  add constraint reservations_status_check
  check (status in ('confirmed', 'checked_in', 'cancelled'));

drop index if exists public.reservations_active_slot_uq;
drop index if exists public.reservations_user_slot_uq;

create unique index if not exists reservations_active_slot_uq
  on public.reservations (room_id, date_key, slot_id)
  where status in ('confirmed', 'checked_in');

create unique index if not exists reservations_user_slot_uq
  on public.reservations (user_id, date_key, slot_id)
  where user_id is not null and status in ('confirmed', 'checked_in');

create index if not exists reservations_status_start_idx
  on public.reservations (status, start_at);

create table if not exists public.booking_occupancy (
  reservation_id text primary key references public.reservations(id) on delete cascade,
  room_id text not null,
  date_key date not null,
  slot_id text not null check (
    slot_id in ('morning-1', 'morning-2', 'afternoon-1', 'afternoon-2')
  ),
  start_at timestamptz not null,
  end_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint booking_occupancy_time_order check (start_at < end_at)
);

create unique index if not exists booking_occupancy_room_slot_uq
  on public.booking_occupancy (room_id, date_key, slot_id);

create index if not exists booking_occupancy_date_idx
  on public.booking_occupancy (date_key);

create index if not exists booking_occupancy_end_at_idx
  on public.booking_occupancy (end_at);

alter table public.booking_occupancy enable row level security;

revoke all on public.booking_occupancy from anon;
grant select on public.booking_occupancy to authenticated;

drop policy if exists "Authenticated users can read booking occupancy" on public.booking_occupancy;
create policy "Authenticated users can read booking occupancy"
  on public.booking_occupancy
  for select
  to authenticated
  using (true);

-- Rebuild occupancy from reservations that are still active.
insert into public.booking_occupancy (
  reservation_id, room_id, date_key, slot_id, start_at, end_at
)
select
  id, room_id, date_key, slot_id, start_at, end_at
from public.reservations
where status in ('confirmed', 'checked_in')
on conflict (room_id, date_key, slot_id) do nothing;

-- Reservation visibility is now owner-only. Realtime availability uses booking_occupancy.
drop policy if exists "Authenticated users can read active reservations" on public.reservations;
drop policy if exists "Users can read their own reservations" on public.reservations;
create policy "Users can read their own reservations"
  on public.reservations
  for select
  to authenticated
  using (auth.uid() = user_id);

revoke select on public.reservations from anon, authenticated;
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
  student_id,
  created_at,
  status,
  cancelled_at,
  checked_in_at
) on public.reservations to authenticated;

revoke insert, update, delete on public.reservations from anon, authenticated;
revoke insert, update, delete on public.booking_occupancy from anon, authenticated;

drop function if exists public.reserve_room(text, date, text);
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
  v_reservation public.reservations;
  v_today date := timezone('Asia/Ho_Chi_Minh', now())::date;
begin
  if v_user_id is null then
    raise exception 'You must be signed in to reserve a room'
      using errcode = '42501';
  end if;

  select *
    into v_room
    from public.rooms
   where id = trim(p_room_id)
     and active = true;

  if not found then
    raise exception 'This room is not available'
      using errcode = '22023';
  end if;

  select student_id
    into v_student_id
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

  v_start_at :=
    ((p_date_key::text || ' ' || v_start_time::text)::timestamp
      at time zone 'Asia/Ho_Chi_Minh');

  v_end_at :=
    ((p_date_key::text || ' ' || v_end_time::text)::timestamp
      at time zone 'Asia/Ho_Chi_Minh');

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
    student_id,
    status
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
    v_student_id,
    'confirmed'
  )
  returning * into v_reservation;

  insert into public.booking_occupancy (
    reservation_id,
    room_id,
    date_key,
    slot_id,
    start_at,
    end_at
  )
  values (
    v_reservation.id,
    v_reservation.room_id,
    v_reservation.date_key,
    v_reservation.slot_id,
    v_reservation.start_at,
    v_reservation.end_at
  );

  return v_reservation;
exception
  when unique_violation then
    raise exception 'This room or your selected time slot was just booked'
      using errcode = '23505';
end;
$$;

drop function if exists public.cancel_booking(text);
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
  v_reservation public.reservations;
begin
  if v_user_id is null then
    raise exception 'You must be signed in to cancel a reservation'
      using errcode = '42501';
  end if;

  update public.reservations
     set status = 'cancelled',
         cancelled_at = now()
   where id = p_id
     and user_id = v_user_id
     and status = 'confirmed'
     and start_at > now()
  returning * into v_reservation;

  if v_reservation.id is null then
    raise exception 'Reservation was not found, is not yours, or can no longer be cancelled'
      using errcode = '42501';
  end if;

  delete from public.booking_occupancy
   where reservation_id = v_reservation.id;

  return v_reservation;
end;
$$;

drop function if exists public.check_in_booking(text);
create or replace function public.check_in_booking(
  p_id text
)
returns public.reservations
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_reservation public.reservations;
begin
  if v_user_id is null then
    raise exception 'You must be signed in to check in'
      using errcode = '42501';
  end if;

  update public.reservations
     set status = 'checked_in',
         checked_in_at = now()
   where id = p_id
     and user_id = v_user_id
     and status = 'confirmed'
     and now() >= start_at - interval '30 minutes'
     and now() < end_at
  returning * into v_reservation;

  if v_reservation.id is null then
    raise exception 'Check-in is only available from 30 minutes before the booking until it ends'
      using errcode = '22023';
  end if;

  return v_reservation;
end;
$$;

revoke all on function public.reserve_room(text, date, text) from public, anon;
revoke all on function public.cancel_booking(text) from public, anon;
revoke all on function public.check_in_booking(text) from public, anon;

grant execute on function public.reserve_room(text, date, text) to authenticated;
grant execute on function public.cancel_booking(text) to authenticated;
grant execute on function public.check_in_booking(text) to authenticated;

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
      and c.relname = 'booking_occupancy'
  ) then
    execute 'alter publication supabase_realtime add table public.booking_occupancy';
  end if;

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
