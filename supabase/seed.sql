-- Optional demo seed data for a fresh Supabase project.
-- Run all migrations first. These rows represent campus schedule occupancy,
-- not a student's booking, so they intentionally have no user_id.

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
  ((current_date + 1)::text || ' ' || slot.starts_at)::timestamp at time zone 'Asia/Ho_Chi_Minh',
  ((current_date + 1)::text || ' ' || slot.ends_at)::timestamp at time zone 'Asia/Ho_Chi_Minh',
  'demo-server'
from (values
  ('b-401', 'Digital Lab B401', 'B', 'Floor 4'),
  ('v-110', 'Innovation Hub V110', 'V', 'Floor 1')
) as room(id, name, building, floor)
cross join (values
  ('morning-1', '07:30 – 09:30', '07:30', '09:30')
) as slot(id, label, starts_at, ends_at)
on conflict (room_id, date_key, slot_id) do nothing;
