import { TIME_SLOTS } from '@/src/constants/slots';
import { Room, Reservation, TimeSlot } from '@/src/types';
import { dateFromKey, isSlotInPast, slotById, slotEndDate, slotStartDate, toDateKey } from './date';

export function isSeededSlotBusy(room: Room, dateKey: string, slotId: string): boolean {
  const weekday = dateFromKey(dateKey).getDay();
  return room.busyRules.some(
    (rule) => rule.weekdays.includes(weekday) && rule.slotIds.includes(slotId),
  );
}

export function isBookedByStudent(
  reservations: Reservation[],
  roomId: string,
  dateKey: string,
  slotId: string,
): boolean {
  return reservations.some(
    (reservation) =>
      reservation.roomId === roomId &&
      reservation.dateKey === dateKey &&
      reservation.slotId === slotId,
  );
}

export function isSlotUnavailable(
  room: Room,
  reservations: Reservation[],
  dateKey: string,
  slot: TimeSlot,
  now = new Date(),
): boolean {
  return (
    isSlotInPast(dateKey, slot, now) ||
    isSeededSlotBusy(room, dateKey, slot.id) ||
    isBookedByStudent(reservations, room.id, dateKey, slot.id)
  );
}

export function isRoomOccupiedNow(room: Room, reservations: Reservation[], now = new Date()): boolean {
  const dateKey = toDateKey(now);
  const activeSlot = TIME_SLOTS.find((slot) => {
    const start = slotStartDate(dateKey, slot).getTime();
    const end = slotEndDate(dateKey, slot).getTime();
    return now.getTime() >= start && now.getTime() < end;
  });

  if (!activeSlot) {
    return false;
  }

  return (
    isSeededSlotBusy(room, dateKey, activeSlot.id) ||
    isBookedByStudent(reservations, room.id, dateKey, activeSlot.id)
  );
}

export function createPassValue(reservationId: string, studentId: string): string {
  return 'VKU|STUDYSPACE|' + reservationId + '|' + studentId;
}

export function makeReservationId(): string {
  return 'BK-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
}

export function isReservationPast(reservation: Reservation, now = new Date()): boolean {
  const slot = slotById(reservation.slotId);
  return !slot || slotEndDate(reservation.dateKey, slot).getTime() <= now.getTime();
}
