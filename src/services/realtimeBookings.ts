import { SupabaseClient } from '@supabase/supabase-js';

import { BookingAvailability, RealtimeStatus, Reservation } from '@/src/types';
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
  student_id: string;
  created_at: string;
  status: Reservation['status'];
  cancelled_at: string | null;
  checked_in_at: string | null;
}

interface AvailabilityRow {
  reservation_id: string;
  room_id: string;
  date_key: string;
  slot_id: Reservation['slotId'];
  start_at: string;
  end_at: string;
}

export interface ReservationChangePayload {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: Reservation | null;
  oldId?: string;
}

export interface AvailabilityChangePayload {
  eventType: 'INSERT' | 'DELETE';
  new: BookingAvailability | null;
  oldReservationId?: string;
}

function mapReservationRow(row: ReservationRow): Reservation {
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
    studentId: row.student_id,
    createdAt: row.created_at,
    status: row.status,
    ...(row.cancelled_at ? { cancelledAt: row.cancelled_at } : {}),
    ...(row.checked_in_at ? { checkedInAt: row.checked_in_at } : {}),
  };
}

function mapAvailabilityRow(row: AvailabilityRow): BookingAvailability {
  return {
    reservationId: row.reservation_id,
    roomId: row.room_id,
    dateKey: row.date_key,
    slotId: row.slot_id,
    startAt: row.start_at,
    endAt: row.end_at,
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

export async function fetchMyReservations(
  fromDate: string,
  toDate: string,
): Promise<Reservation[]> {
  const client = requireSupabase();

  const { data, error } = await client
    .from('reservations')
    .select(
      'id, user_id, room_id, room_name, building, floor, date_key, slot_id, slot_label, start_at, end_at, student_id, created_at, status, cancelled_at, checked_in_at',
    )
    .gte('date_key', fromDate)
    .lte('date_key', toDate)
    .order('start_at', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => mapReservationRow(row as ReservationRow));
}

export async function fetchBookingAvailability(
  fromDate: string,
  toDate: string,
): Promise<BookingAvailability[]> {
  const client = requireSupabase();

  const { data, error } = await client
    .from('booking_occupancy')
    .select('reservation_id, room_id, date_key, slot_id, start_at, end_at')
    .gte('date_key', fromDate)
    .lte('date_key', toDate)
    .gt('end_at', new Date().toISOString())
    .order('start_at', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => mapAvailabilityRow(row as AvailabilityRow));
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

  return mapReservationRow(data as ReservationRow);
}

export async function cancelBookingOnServer(reservationId: string): Promise<Reservation> {
  const client = requireSupabase();

  const { data, error } = await client.rpc('cancel_booking', {
    p_id: reservationId,
  });

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error('The server did not return the cancelled reservation.');
  }

  return mapReservationRow(data as ReservationRow);
}

export async function checkInBookingOnServer(reservationId: string): Promise<Reservation> {
  const client = requireSupabase();

  const { data, error } = await client.rpc('check_in_booking', {
    p_id: reservationId,
  });

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error('The server did not return the checked-in reservation.');
  }

  return mapReservationRow(data as ReservationRow);
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
    .channel('studyspace-user-bookings')
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
            new: mapReservationRow(payload.new as ReservationRow),
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

export function subscribeToBookingAvailabilityChanges(
  onChange: (payload: AvailabilityChangePayload) => void,
  onStatus: (status: RealtimeStatus) => void,
): () => void {
  if (!supabase) {
    return () => undefined;
  }

  const client: SupabaseClient = supabase;
  const channel = client
    .channel('studyspace-booking-availability')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'booking_occupancy',
      },
      (payload) => {
        onChange({
          eventType: 'INSERT',
          new: mapAvailabilityRow(payload.new as AvailabilityRow),
        });
      },
    )
    .on(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: 'booking_occupancy',
      },
      (payload) => {
        onChange({
          eventType: 'DELETE',
          new: null,
          oldReservationId: String((payload.old as { reservation_id?: string }).reservation_id ?? ''),
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
