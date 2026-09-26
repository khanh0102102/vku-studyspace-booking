-- Optional demo seed data for a fresh Supabase project.
-- Run the migration first. This inserts future example bookings so that
-- a second device can immediately see unavailable slots before making new ones.
-- Remove or adjust these rows when demonstrating a completely empty schedule.

insert into public.reservations (
  id, room_id, room_name, building, floor, date_key, slot_id, slot_label,
  start_at, end_at, student_id
)
select
  'DEMO-' || room.id || '-' || to_char(current_date + 1, 'YYYYMMDD') || '-' || slot.id,
  room.id,
  room.name,
  room.building,
  room.floor,
  current_date + 1,
  slot.id,
  slot.label,
  make_timestamptz(
    extract(year from current_date + 1)::integer,
    extract(month from current_date + 1)::integer,
    extract(day from current_date + 1)::integer,
    split_part(slot.starts_at, ':', 1)::integer,
    split_part(slot.starts_at, ':', 2)::integer,
    0,
    'Asia/Ho_Chi_Minh'
  ),
  make_timestamptz(
    extract(year from current_date + 1)::integer,
    extract(month from current_date + 1)::integer,
    extract(day from current_date + 1)::integer,
    split_part(slot.ends_at, ':', 1)::integer,
    split_part(slot.ends_at, ':', 2)::integer,
    0,
    'Asia/Ho_Chi_Minh'
  ),
  'demo-server'
from (values
  ('b-401', 'Digital Lab B401', 'B', 'Floor 4'),
  ('v-110', 'Innovation Hub V110', 'V', 'Floor 1')
) as room(id, name, building, floor)
cross join (values
  ('morning-1', '07:30 – 09:30', '07:30', '09:30')
) as slot(id, label, starts_at, ends_at)
on conflict (room_id, date_key, slot_id) where status = 'confirmed' do nothing;
