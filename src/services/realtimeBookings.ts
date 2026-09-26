import { SupabaseClient } from '@supabase/supabase-js';

import { RealtimeStatus, Reservation } from '@/src/types';
import { supabase } from '@/src/services/supabase';

export const REMOTE_BOOKING_DAYS = 7;

interface ReservationRow {
  id: string;
  user_id: string;
  room_id: string;
  room_name: string;
  building: Reservation['building'];
  floor: string;
  date_key: string;
  slot_id: Reservation['slotId'];
  slot_label: string;
  start_at: string;
  end_at: string;
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
    userId: row.user_id,
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
    studentId: '',
    createdAt: row.created_at,
  };
}

function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }
  return supabase;
}

export function isRealtimeReady(): boolean {
  return supabase !== null;
}

export async function fetchActiveReservations(
  fromDate: string,
  toDate: string,
): Promise<Reservation[]> {
  const client = requireSupabase();

  const { data, error } = await client
    .from('reservations')
    .select(
      'id, user_id, room_id, room_name, building, floor, date_key, slot_id, slot_label, start_at, end_at, created_at',
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
  roomId: string,
  dateKey: string,
  slotId: string,
): Promise<Reservation> {
  const client = requireSupabase();

  const { data, error } = await client.rpc('reserve_room', {
    p_room_id: roomId,
    p_date_key: dateKey,
    p_slot_id: slotId,
  });

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error('The server did not return the created reservation.');
  }

  return mapRow(data as ReservationRow);
}

export async function cancelBookingOnServer(reservationId: string): Promise<void> {
  const client = requireSupabase();

  const { error } = await client.rpc('cancel_booking', {
    p_id: reservationId,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export function subscribeToReservationChanges(
  onChange: (payload: ReservationChangePayload) => void,
  onStatus: (status: RealtimeStatus) => void,
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
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        onStatus('connected');
      } else if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') {
        onStatus('error');
      } else if (status === 'CLOSED') {
        onStatus('offline');
      }
    });

  return () => {
    void client.removeChannel(channel);
  };
}
