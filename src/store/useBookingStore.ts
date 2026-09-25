import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { TIME_SLOTS } from '@/src/constants/slots';
import { ROOMS } from '@/src/data/rooms';
import { BookingFilters, Reservation, UserSession } from '@/src/types';
import {
  createPassValue,
  isBookedByStudent,
  isSeededSlotBusy,
  makeReservationId,
} from '@/src/utils/booking';
import { isSlotInPast, slotEndDate, slotStartDate } from '@/src/utils/date';

const DEFAULT_FILTERS: BookingFilters = {
  query: '',
  building: 'All',
  minCapacity: null,
  equipment: 'All',
};

const DEMO_SESSION: UserSession = {
  id: 'student-23it123',
  fullName: 'Nguyễn Minh Anh',
  studentId: '23IT123',
  email: 'minhanh23@vku.udn.vn',
};

export type BookingAttempt =
  | { ok: true; reservation: Reservation }
  | { ok: false; error: string };

interface ReservationInput {
  roomId: string;
  dateKey: string;
  slotId: string;
}

interface BookingState {
  session: UserSession | null;
  reservations: Reservation[];
  filters: BookingFilters;
  hasHydrated: boolean;
  setSession: (session: UserSession | null) => void;
  updateFilters: (filters: Partial<BookingFilters>) => void;
  resetFilters: () => void;
  reserveRoom: (input: ReservationInput) => BookingAttempt;
  setNotificationId: (reservationId: string, notificationId?: string) => void;
  cancelBooking: (reservationId: string) => Reservation | undefined;
  setHasHydrated: (hasHydrated: boolean) => void;
}

export const useBookingStore = create<BookingState>()(
  persist(
    (set, get) => ({
      session: DEMO_SESSION,
      reservations: [],
      filters: DEFAULT_FILTERS,
      hasHydrated: false,

      setSession: (session) => set({ session }),

      updateFilters: (filters) =>
        set((state) => ({
          filters: { ...state.filters, ...filters },
        })),

      resetFilters: () => set({ filters: DEFAULT_FILTERS }),

      reserveRoom: ({ roomId, dateKey, slotId }) => {
        const room = ROOMS.find((item) => item.id === roomId);
        const slot = TIME_SLOTS.find((item) => item.id === slotId);
        const session = get().session;

        if (!session) {
          return { ok: false, error: 'Please sign in before making a reservation.' };
        }
        if (!room || !slot) {
          return { ok: false, error: 'This room or time slot is no longer available.' };
        }
        if (isSlotInPast(dateKey, slot)) {
          return { ok: false, error: 'You cannot reserve a time slot that has already started.' };
        }
        if (isSeededSlotBusy(room, dateKey, slotId)) {
          return { ok: false, error: 'This slot was just booked by another group.' };
        }
        if (isBookedByStudent(get().reservations, roomId, dateKey, slotId)) {
          return { ok: false, error: 'You already have a reservation for this room and slot.' };
        }

        const id = makeReservationId();
        const reservation: Reservation = {
          id,
          roomId: room.id,
          roomName: room.name,
          building: room.building,
          floor: room.floor,
          dateKey,
          slotId,
          slotLabel: slot.label,
          startAt: slotStartDate(dateKey, slot).toISOString(),
          endAt: slotEndDate(dateKey, slot).toISOString(),
          qrValue: createPassValue(id, session.studentId),
          createdAt: new Date().toISOString(),
        };

        set((state) => ({
          reservations: [reservation, ...state.reservations],
        }));
        return { ok: true, reservation };
      },

      setNotificationId: (reservationId, notificationId) =>
        set((state) => ({
          reservations: state.reservations.map((reservation) =>
            reservation.id === reservationId
              ? { ...reservation, notificationId }
              : reservation,
          ),
        })),

      cancelBooking: (reservationId) => {
        const reservation = get().reservations.find((item) => item.id === reservationId);
        if (reservation) {
          set((state) => ({
            reservations: state.reservations.filter((item) => item.id !== reservationId),
          }));
        }
        return reservation;
      },

      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
    }),
    {
      name: 'vku-studyspace-booking-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        session: state.session,
        reservations: state.reservations,
        filters: state.filters,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
