import { SupabaseClient } from '@supabase/supabase-js';

import { Reservation } from '@/src/types';
import { supabase } from '@/src/services/supabase';

export const REMOTE_BOOKING_DAYS = 7;

interface ReservationRow {
  id: string;
  room_id: string;
  room_name: string;
  building: Reservation['building'];
  floor: string;
  date_key: string;
  slot_id: Reservation['slotId'];
  slot_label: string;
  start_at: string;
  end_at: string;
  student_id: string;
  created_at: string;
}

export interface ReservationChangePayload {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: Reservation | null;
  oldId?: string;
}

function mapRow(row: ReservationRow): Reservation {
  return {
    id: row.id,
    roomId: row.room_id,
    roomName: row.room_name,
    building: row.building,
    floor: row.floor,
    dateKey: row.date_key,
    slotId: row.slot_id,
    slotLabel: row.slot_label,
    startAt: row.start_at,
    endAt: row.end_at,
    qrValue: '',
    studentId: row.student_id,
    createdAt: row.created_at,
  };
}

export function isRealtimeReady(): boolean {
  return supabase !== null;
}

export async function fetchActiveReservations(
  fromDate: string,
  toDate: string,
): Promise<Reservation[]> {
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from('reservations')
    .select(
      'id, room_id, room_name, building, floor, date_key, slot_id, slot_label, start_at, end_at, student_id, created_at',
    )
    .gte('date_key', fromDate)
    .lte('date_key', toDate)
    .order('start_at', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map(mapRow);
}

export async function reserveRoomOnServer(
  reservation: Reservation,
): Promise<Reservation> {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const { data, error } = await supabase.rpc('reserve_room', {
    p_id: reservation.id,
    p_room_id: reservation.roomId,
    p_room_name: reservation.roomName,
    p_building: reservation.building,
    p_floor: reservation.floor,
    p_date_key: reservation.dateKey,
    p_slot_id: reservation.slotId,
    p_slot_label: reservation.slotLabel,
    p_start_at: reservation.startAt,
    p_end_at: reservation.endAt,
    p_student_id: reservation.studentId,
  });

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error('The server did not return the created reservation.');
  }

  return mapRow(data as ReservationRow);
}

export async function cancelBookingOnServer(
  reservationId: string,
  studentId: string,
): Promise<void> {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const { error } = await supabase.rpc('cancel_booking', {
    p_id: reservationId,
    p_student_id: studentId,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export function subscribeToReservationChanges(
  onChange: (payload: ReservationChangePayload) => void,
): () => void {
  if (!supabase) {
    return () => undefined;
  }

  const client: SupabaseClient = supabase;
  const channel = client
    .channel('studyspace-reservations')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'reservations',
      },
      (payload) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          onChange({
            eventType: payload.eventType,
            new: mapRow(payload.new as ReservationRow),
          });
          return;
        }

        onChange({
          eventType: 'DELETE',
          new: null,
          oldId: String((payload.old as { id?: string }).id ?? ''),
        });
      },
    )
    .subscribe();

  return () => {
    void client.removeChannel(channel);
  };
}
