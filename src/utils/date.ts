import { TIME_SLOTS } from '@/src/constants/slots';
import { TimeSlot } from '@/src/types';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export interface DateOption {
  key: string;
  dayName: string;
  dayNumber: string;
  isToday: boolean;
}

export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return year + '-' + month + '-' + day;
}

export function dateFromKey(key: string): Date {
  const parts = key.split('-').map(Number);
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

export function shiftDateKey(dateKey: string, days: number): string {
  const date = dateFromKey(dateKey);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

export function getNextSevenDays(now = new Date()): DateOption[] {
  const todayKey = toDateKey(now);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now);
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() + index);
    return {
      key: toDateKey(date),
      dayName: index === 0 ? 'Today' : DAY_NAMES[date.getDay()],
      dayNumber: String(date.getDate()),
      isToday: toDateKey(date) === todayKey,
    };
  });
}

export function slotStartDate(dateKey: string, slot: TimeSlot): Date {
  const parts = dateKey.split('-').map(Number);
  const time = slot.startsAt.split(':').map(Number);
  return new Date(parts[0], parts[1] - 1, parts[2], time[0], time[1], 0, 0);
}

export function slotEndDate(dateKey: string, slot: TimeSlot): Date {
  const parts = dateKey.split('-').map(Number);
  const time = slot.endsAt.split(':').map(Number);
  return new Date(parts[0], parts[1] - 1, parts[2], time[0], time[1], 0, 0);
}

export function isSlotInPast(dateKey: string, slot: TimeSlot, now = new Date()): boolean {
  return slotStartDate(dateKey, slot).getTime() <= now.getTime();
}

export function slotById(id: string): TimeSlot | undefined {
  return TIME_SLOTS.find((slot) => slot.id === id);
}

export function prettyDate(dateKey: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(dateFromKey(dateKey));
}
