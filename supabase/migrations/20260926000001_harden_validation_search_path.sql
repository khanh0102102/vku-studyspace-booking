-- Harden the validation helper used by SECURITY DEFINER booking functions.
create or replace function public.validate_reservation_input(
  p_date_key date,
  p_slot_id text,
  p_start_at timestamptz,
  p_end_at timestamptz
) returns void
language plpgsql
set search_path = public
as $$
begin
  if p_date_key < (timezone('Asia/Ho_Chi_Minh', now())::date)
     or p_date_key > (timezone('Asia/Ho_Chi_Minh', now())::date + 6) then
    raise exception 'Booking date must be within the next 7 calendar days' using errcode = '22023';
  end if;
  if p_slot_id not in ('morning-1', 'morning-2', 'afternoon-1', 'afternoon-2') then
    raise exception 'Invalid VKU time slot' using errcode = '22023';
  end if;
  if p_start_at >= p_end_at then
    raise exception 'Booking end time must be after the start time' using errcode = '22023';
  end if;
  if p_start_at <= now() then
    raise exception 'This time slot has already started' using errcode = '22023';
  end if;
end;
$$;
