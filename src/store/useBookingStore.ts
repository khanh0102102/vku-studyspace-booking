import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { TIME_SLOTS } from '@/src/constants/slots';
import { ROOMS } from '@/src/data/rooms';
import {
  cancelBookingOnServer,
  fetchActiveReservations,
  isRealtimeReady,
  reserveRoomOnServer,
  subscribeToReservationChanges,
} from '@/src/services/realtimeBookings';
import {
  BookingFilters,
  RealtimeStatus,
  Reservation,
  UserSession,
} from '@/src/types';
import {
  createPassValue,
  isBookedByStudent,
  isSeededSlotBusy,
  isSlotUnavailable,
  makeReservationId,
} from '@/src/utils/booking';
import {
  getNextSevenDays,
  isSlotInPast,
  slotEndDate,
  slotStartDate,
  toDateKey,
} from '@/src/utils/date';

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
  availabilityReservations: Reservation[];
  filters: BookingFilters;
  hasHydrated: boolean;
  realtimeStatus: RealtimeStatus;
  lastSyncedAt: string | null;
  setSession: (session: UserSession | null) => void;
  updateFilters: (filters: Partial<BookingFilters>) => void;
  resetFilters: () => void;
  reserveRoom: (input: ReservationInput) => Promise<BookingAttempt>;
  setNotificationId: (reservationId: string, notificationId?: string) => void;
  cancelBooking: (reservationId: string) => Promise<Reservation | undefined>;
  syncAvailability: () => Promise<void>;
  startRealtime: () => () => void;
  setHasHydrated: (hasHydrated: boolean) => void;
}

function withQrValue(reservation: Reservation): Reservation {
  return {
    ...reservation,
    qrValue: reservation.qrValue || createPassValue(reservation.id, reservation.studentId),
  };
}

function mergeUserReservations(
  current: Reservation[],
  remote: Reservation[],
  studentId: string,
): Reservation[] {
  const notificationIds = new Map(
    current
      .filter((reservation) => reservation.studentId === studentId && reservation.notificationId)
      .map((reservation) => [reservation.id, reservation.notificationId]),
  );

  return remote
    .filter((reservation) => reservation.studentId === studentId)
    .map((reservation) => ({
      ...withQrValue(reservation),
      notificationId: notificationIds.get(reservation.id),
    }))
    .sort((a, b) => a.startAt.localeCompare(b.startAt));
}

export const useBookingStore = create<BookingState>()(
  persist(
    (set, get) => ({
      session: DEMO_SESSION,
      reservations: [],
      availabilityReservations: [],
      filters: DEFAULT_FILTERS,
      hasHydrated: false,
      realtimeStatus: 'offline',
      lastSyncedAt: null,

      setSession: (session) => set({ session }),

      updateFilters: (filters) =>
        set((state) => ({
          filters: { ...state.filters, ...filters },
        })),

      resetFilters: () => set({ filters: DEFAULT_FILTERS }),

      reserveRoom: async ({ roomId, dateKey, slotId }) => {
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

        const availability = get().availabilityReservations;
        if (isSeededSlotBusy(room, dateKey, slotId)) {
          return { ok: false, error: 'This slot is unavailable in the current room schedule.' };
        }
        if (isBookedByStudent(availability, roomId, dateKey, slotId)) {
          return { ok: false, error: 'This slot is already reserved. Live availability has just updated.' };
        }

        const id = makeReservationId();
        const localReservation: Reservation = {
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
          studentId: session.studentId,
          createdAt: new Date().toISOString(),
        };

        if (isRealtimeReady()) {
          try {
            const remoteReservation = await reserveRoomOnServer(localReservation);
            const reservation = withQrValue(remoteReservation);
            set((state) => ({
              reservations: [
                reservation,
                ...state.reservations.filter((item) => item.id !== reservation.id),
              ],
              availabilityReservations: [
                reservation,
                ...state.availabilityReservations.filter((item) => item.id !== reservation.id),
              ],
            }));
            return { ok: true, reservation };
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Could not reach the booking server.';
            return { ok: false, error: message };
          }
        }

        set((state) => ({
          reservations: [localReservation, ...state.reservations],
          availabilityReservations: [localReservation, ...state.availabilityReservations],
        }));
        return { ok: true, reservation: localReservation };
      },

      setNotificationId: (reservationId, notificationId) =>
        set((state) => ({
          reservations: state.reservations.map((reservation) =>
            reservation.id === reservationId
              ? { ...reservation, notificationId }
              : reservation,
          ),
        })),

      cancelBooking: async (reservationId) => {
        const reservation = get().reservations.find((item) => item.id === reservationId);
        if (!reservation) {
          return undefined;
        }

        const session = get().session;
        if (isRealtimeReady() && session) {
          await cancelBookingOnServer(reservationId, session.studentId);
        }

        set((state) => ({
          reservations: state.reservations.filter((item) => item.id !== reservationId),
          availabilityReservations: state.availabilityReservations.filter(
            (item) => item.id !== reservationId,
          ),
        }));
        return reservation;
      },

      syncAvailability: async () => {
        if (!isRealtimeReady()) {
          set((state) => ({
            realtimeStatus: 'offline',
            availabilityReservations: state.reservations,
          }));
          return;
        }

        set({ realtimeStatus: 'connecting' });

        const dates = getNextSevenDays();
        const fromDate = dates[0].key;
        const toDate = dates[dates.length - 1].key;
        const remote = await fetchActiveReservations(fromDate, toDate);
        const session = get().session;
        const reservations = session
          ? mergeUserReservations(get().reservations, remote, session.studentId)
          : [];
        set({
          availabilityReservations: remote,
          reservations,
          lastSyncedAt: new Date().toISOString(),
        });
      },

      startRealtime: () => {
        let stopped = false;

        if (!isRealtimeReady()) {
          set((state) => ({
            realtimeStatus: 'offline',
            availabilityReservations: state.reservations,
          }));
          return () => undefined;
        }

        set({ realtimeStatus: 'connecting' });

        const unsubscribe = subscribeToReservationChanges(
          (change) => {
            if (stopped || !change.new && change.eventType !== 'DELETE') {
              return;
            }

            if (change.eventType === 'DELETE') {
              const deletedId = change.oldId;
              if (!deletedId) {
                return;
              }
              set((state) => ({
                availabilityReservations: state.availabilityReservations.filter(
                  (reservation) => reservation.id !== deletedId,
                ),
                reservations: state.reservations.filter(
                  (reservation) => reservation.id !== deletedId,
                ),
                lastSyncedAt: new Date().toISOString(),
              }));
              return;
            }

            const incoming = withQrValue(change.new!);
            const session = get().session;
            set((state) => ({
              availabilityReservations: [
                incoming,
                ...state.availabilityReservations.filter((item) => item.id !== incoming.id),
              ].sort((a, b) => a.startAt.localeCompare(b.startAt)),
              reservations:
                session && incoming.studentId === session.studentId
                  ? [
                      incoming,
                      ...state.reservations
                        .filter((item) => item.id !== incoming.id)
                        .map((item) => ({ ...item })),
                    ].sort((a, b) => a.startAt.localeCompare(b.startAt))
                  : state.reservations,
              lastSyncedAt: new Date().toISOString(),
            }));
          },
          (status) => {
            if (!stopped) {
              set({ realtimeStatus: status });
            }
          },
        );

        void get()
          .syncAvailability()
          .catch(() => {
            if (!stopped) {
              set({ realtimeStatus: 'error' });
            }
          });

        return () => {
          stopped = true;
          unsubscribe();
          set({ realtimeStatus: 'offline' });
        };
      },

      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
    }),
    {
      name: 'vku-studyspace-booking-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        session: state.session,
        reservations: state.reservations,
        availabilityReservations: state.availabilityReservations,
        filters: state.filters,
        lastSyncedAt: state.lastSyncedAt,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
