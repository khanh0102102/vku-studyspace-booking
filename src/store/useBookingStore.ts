import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { TIME_SLOTS } from '@/src/constants/slots';
import { ROOMS } from '@/src/data/rooms';
import {
  cancelBookingOnServer,
  checkInBookingOnServer,
  fetchBookingAvailability,
  fetchMyReservations,
  isRealtimeReady,
  reserveRoomOnServer,
  subscribeToBookingAvailabilityChanges,
  subscribeToReservationChanges,
} from '@/src/services/realtimeBookings';
import {
  BookingAvailability,
  BookingFilters,
  RealtimeStatus,
  Reservation,
  UserSession,
} from '@/src/types';
import { createPassValue, isBookedByStudent, isSeededSlotBusy } from '@/src/utils/booking';
import { getNextSevenDays, shiftDateKey } from '@/src/utils/date';

const DEFAULT_FILTERS: BookingFilters = {
  query: '',
  building: 'All',
  minCapacity: null,
  equipment: 'All',
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
  availabilityReservations: BookingAvailability[];
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
  checkInBooking: (reservationId: string) => Promise<Reservation | undefined>;
  syncAvailability: () => Promise<void>;
  startRealtime: () => () => void;
  setHasHydrated: (hasHydrated: boolean) => void;
}

function withQrValue(reservation: Reservation, studentId: string): Reservation {
  return {
    ...reservation,
    studentId,
    qrValue: createPassValue(reservation.id, studentId),
  };
}

function mergeNotificationIds(
  current: Reservation[],
  remote: Reservation[],
  session: UserSession,
): Reservation[] {
  const notificationIds = new Map(
    current
      .filter(
        (reservation) =>
          reservation.userId === session.id && reservation.notificationId,
      )
      .map((reservation) => [reservation.id, reservation.notificationId]),
  );

  return remote
    .filter((reservation) => reservation.userId === session.id)
    .map((reservation) => ({
      ...withQrValue(reservation, session.studentId),
      notificationId: notificationIds.get(reservation.id),
    }))
    .sort((a, b) => a.startAt.localeCompare(b.startAt));
}

function addAvailability(
  current: BookingAvailability[],
  reservation: Reservation,
): BookingAvailability[] {
  const entry: BookingAvailability = {
    reservationId: reservation.id,
    roomId: reservation.roomId,
    dateKey: reservation.dateKey,
    slotId: reservation.slotId,
    startAt: reservation.startAt,
    endAt: reservation.endAt,
  };

  return [
    entry,
    ...current.filter((item) => item.reservationId !== reservation.id),
  ].sort((a, b) => a.startAt.localeCompare(b.startAt));
}

export const useBookingStore = create<BookingState>()(
  persist(
    (set, get) => ({
      session: null,
      reservations: [],
      availabilityReservations: [],
      filters: DEFAULT_FILTERS,
      hasHydrated: false,
      realtimeStatus: 'offline',
      lastSyncedAt: null,

      setSession: (session) =>
        set((state) => {
          if (state.session?.id === session?.id) {
            return { session };
          }

          return {
            session,
            reservations: [],
            availabilityReservations: [],
            realtimeStatus: session ? 'connecting' : 'offline',
            lastSyncedAt: null,
          };
        }),

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
        if (!isRealtimeReady()) {
          return { ok: false, error: 'Booking backend is not configured.' };
        }
        if (!room || !slot) {
          return { ok: false, error: 'This room or time slot is no longer available.' };
        }
        if (isSeededSlotBusy(room, dateKey, slotId)) {
          return { ok: false, error: 'This slot is unavailable in the current room schedule.' };
        }
        if (isBookedByStudent(get().availabilityReservations, roomId, dateKey, slotId)) {
          return {
            ok: false,
            error: 'This slot is already reserved. Live availability has just updated.',
          };
        }

        try {
          const remoteReservation = await reserveRoomOnServer(roomId, dateKey, slotId);
          const reservation = withQrValue(remoteReservation, session.studentId);

          set((state) => ({
            reservations: [
              reservation,
              ...state.reservations.filter((item) => item.id !== reservation.id),
            ].sort((a, b) => a.startAt.localeCompare(b.startAt)),
            availabilityReservations: addAvailability(
              state.availabilityReservations,
              reservation,
            ),
          }));

          return { ok: true, reservation };
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : 'Could not reach the booking server.';
          return { ok: false, error: message };
        }
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
        const reservation = get().reservations.find(
          (item) => item.id === reservationId,
        );
        const session = get().session;

        if (!reservation || !session) {
          return undefined;
        }

        const cancelled = withQrValue(
          await cancelBookingOnServer(reservationId),
          session.studentId,
        );

        set((state) => ({
          reservations: state.reservations.map((item) =>
            item.id === cancelled.id
              ? {
                  ...item,
                  ...cancelled,
                  notificationId: reservation.notificationId,
                }
              : item,
          ),
          availabilityReservations: state.availabilityReservations.filter(
            (item) => item.reservationId !== reservationId,
          ),
        }));

        return cancelled;
      },

      checkInBooking: async (reservationId) => {
        const reservation = get().reservations.find(
          (item) => item.id === reservationId,
        );
        const session = get().session;

        if (!reservation || !session) {
          return undefined;
        }

        const checkedIn = withQrValue(
          await checkInBookingOnServer(reservationId),
          session.studentId,
        );

        set((state) => ({
          reservations: state.reservations.map((item) =>
            item.id === checkedIn.id
              ? {
                  ...item,
                  ...checkedIn,
                  notificationId: reservation.notificationId,
                }
              : item,
          ),
        }));

        return checkedIn;
      },

      syncAvailability: async () => {
        if (!isRealtimeReady() || !get().session) {
          set({ realtimeStatus: 'error' });
          throw new Error('Authentication backend is not ready.');
        }

        const dates = getNextSevenDays();
        const session = get().session as UserSession;
        const fromDate = shiftDateKey(dates[0].key, -30);
        const toDate = dates[dates.length - 1].key;

        const [availability, ownReservations] = await Promise.all([
          fetchBookingAvailability(dates[0].key, dates[dates.length - 1].key),
          fetchMyReservations(fromDate, toDate),
        ]);

        set({
          availabilityReservations: availability,
          reservations: mergeNotificationIds(
            get().reservations,
            ownReservations,
            session,
          ),
          lastSyncedAt: new Date().toISOString(),
          realtimeStatus: 'connected',
        });
      },

      startRealtime: () => {
        let stopped = false;
        let reservationChannelStatus: RealtimeStatus = 'connecting';
        let availabilityChannelStatus: RealtimeStatus = 'connecting';

        if (!isRealtimeReady() || !get().session) {
          set({ realtimeStatus: 'error' });
          return () => undefined;
        }

        set({ realtimeStatus: 'connecting' });

        const updateCombinedStatus = () => {
          if (stopped) return;
          if (
            reservationChannelStatus === 'connected' &&
            availabilityChannelStatus === 'connected'
          ) {
            set({ realtimeStatus: 'connected' });
            return;
          }

          if (
            reservationChannelStatus === 'error' ||
            availabilityChannelStatus === 'error'
          ) {
            set({ realtimeStatus: 'error' });
            return;
          }

          set({ realtimeStatus: 'connecting' });
        };

        const unsubscribeReservations = subscribeToReservationChanges(
          (change) => {
            if (stopped) return;

            if (change.eventType === 'DELETE') {
              if (!change.oldId) return;

              set((state) => ({
                reservations: state.reservations.filter(
                  (reservation) => reservation.id !== change.oldId,
                ),
                lastSyncedAt: new Date().toISOString(),
              }));
              return;
            }

            const incoming = change.new;
            const session = get().session;
            if (!incoming || !session || incoming.userId !== session.id) {
              return;
            }

            const existing = get().reservations.find(
              (item) => item.id === incoming.id,
            );

            set((state) => ({
              reservations: [
                {
                  ...withQrValue(incoming, session.studentId),
                  notificationId: existing?.notificationId,
                },
                ...state.reservations.filter(
                  (item) => item.id !== incoming.id,
                ),
              ].sort((a, b) => a.startAt.localeCompare(b.startAt)),
              lastSyncedAt: new Date().toISOString(),
            }));
          },
          (status) => {
            reservationChannelStatus = status;
            updateCombinedStatus();
          },
        );

        const unsubscribeAvailability = subscribeToBookingAvailabilityChanges(
          (change) => {
            if (stopped) return;

            if (change.eventType === 'DELETE') {
              if (!change.oldReservationId) return;

              set((state) => ({
                availabilityReservations: state.availabilityReservations.filter(
                  (item) => item.reservationId !== change.oldReservationId,
                ),
                lastSyncedAt: new Date().toISOString(),
              }));
              return;
            }

            if (!change.new) return;

            set((state) => ({
              availabilityReservations: [
                change.new!,
                ...state.availabilityReservations.filter(
                  (item) => item.reservationId !== change.new!.reservationId,
                ),
              ].sort((a, b) => a.startAt.localeCompare(b.startAt)),
              lastSyncedAt: new Date().toISOString(),
            }));
          },
          (status) => {
            availabilityChannelStatus = status;
            updateCombinedStatus();
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
          unsubscribeReservations();
          unsubscribeAvailability();
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
