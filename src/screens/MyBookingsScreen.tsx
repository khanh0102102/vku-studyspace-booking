import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BookingPassModal } from '@/src/components/BookingPassModal';
import { colors, shadows } from '@/src/constants/theme';
import { cancelBookingReminder } from '@/src/services/notifications';
import { useBookingStore } from '@/src/store/useBookingStore';
import { Reservation, RootStackParamList } from '@/src/types';
import { isReservationPast } from '@/src/utils/booking';
import { prettyDate } from '@/src/utils/date';

type Props = NativeStackScreenProps<RootStackParamList, 'MyBookings'>;

interface BookingCardProps {
  reservation: Reservation;
  onOpenPass: (reservation: Reservation) => void;
  onCancel: (reservation: Reservation) => void;
}

const BookingCard = React.memo(function BookingCard({
  reservation,
  onOpenPass,
  onCancel,
}: BookingCardProps) {
  const past = isReservationPast(reservation);
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.roomIcon}>
          <Ionicons color={colors.primary} name="business-outline" size={22} />
        </View>
        <View style={styles.cardTitle}>
          <Text numberOfLines={1} style={styles.roomName}>{reservation.roomName}</Text>
          <Text style={styles.roomMeta}>{'Building ' + reservation.building + ' · ' + reservation.floor}</Text>
        </View>
        <View style={[styles.status, past ? styles.pastStatus : styles.confirmedStatus]}>
          <Text style={[styles.statusText, past ? styles.pastText : styles.confirmedText]}>
            {past ? 'Past' : 'Confirmed'}
          </Text>
        </View>
      </View>

      <View style={styles.bookingTime}>
        <Ionicons color={colors.muted} name="calendar-outline" size={17} />
        <Text style={styles.bookingText}>{prettyDate(reservation.dateKey)}</Text>
        <View style={styles.timeSeparator} />
        <Ionicons color={colors.muted} name="time-outline" size={17} />
        <Text style={styles.bookingText}>{reservation.slotLabel}</Text>
      </View>

      <View style={styles.divider} />
      <View style={styles.actions}>
        <Pressable
          onPress={() => onOpenPass(reservation)}
          style={({ pressed }) => [styles.passButton, pressed && styles.pressed]}
        >
          <Ionicons color={colors.primary} name="qr-code-outline" size={18} />
          <Text style={styles.passText}>Show QR pass</Text>
        </Pressable>
        {!past && (
          <Pressable
            onPress={() => onCancel(reservation)}
            style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
});

export function MyBookingsScreen({ navigation }: Props) {
  const reservations = useBookingStore((state) => state.reservations);
  const cancelBooking = useBookingStore((state) => state.cancelBooking);
  const [passReservation, setPassReservation] = React.useState<Reservation | null>(null);

  const orderedReservations = React.useMemo(
    () =>
      [...reservations].sort(
        (first, second) =>
          new Date(first.startAt).getTime() - new Date(second.startAt).getTime(),
      ),
    [reservations],
  );

  const openPass = React.useCallback((reservation: Reservation) => {
    setPassReservation(reservation);
  }, []);

  const cancelSelectedBooking = React.useCallback(
    (reservation: Reservation) => {
      Alert.alert(
        'Cancel reservation?',
        'Your reserved slot will become available for other students.',
        [
          { text: 'Keep booking', style: 'cancel' },
          {
            text: 'Cancel reservation',
            style: 'destructive',
            onPress: () => {
              void (async () => {
                await cancelBookingReminder(reservation.notificationId);
                cancelBooking(reservation.id);
              })();
            },
          },
        ],
      );
    },
    [cancelBooking],
  );

  const renderBooking = React.useCallback(
    ({ item }: { item: Reservation }) => (
      <BookingCard
        onCancel={cancelSelectedBooking}
        onOpenPass={openPass}
        reservation={item}
      />
    ),
    [cancelSelectedBooking, openPass],
  );

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="Go back"
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}
        >
          <Ionicons color={colors.ink} name="arrow-back" size={22} />
        </Pressable>
        <View>
          <Text style={styles.heading}>My bookings</Text>
          <Text style={styles.subtitle}>Your study room reservation passes</Text>
        </View>
      </View>

      <FlatList
        contentContainerStyle={[
          styles.list,
          orderedReservations.length === 0 && styles.emptyList,
        ]}
        data={orderedReservations}
        keyExtractor={(reservation) => reservation.id}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons color={colors.primary} name="calendar-outline" size={35} />
            </View>
            <Text style={styles.emptyTitle}>No reservations yet</Text>
            <Text style={styles.emptyText}>
              Choose a room and a free time slot to create your first booking.
            </Text>
            <Pressable onPress={() => navigation.navigate('Discover')} style={styles.findButton}>
              <Text style={styles.findButtonText}>Find a study room</Text>
            </Pressable>
          </View>
        }
        renderItem={renderBooking}
        showsVerticalScrollIndicator={false}
      />

      <BookingPassModal onClose={() => setPassReservation(null)} reservation={passReservation} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.page,
    flex: 1,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  back: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 19,
    height: 39,
    justifyContent: 'center',
    width: 39,
  },
  heading: {
    color: colors.ink,
    fontSize: 21,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 2,
  },
  list: {
    padding: 18,
    paddingTop: 6,
  },
  emptyList: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 17,
    marginBottom: 13,
    padding: 15,
    ...shadows.card,
  },
  cardTop: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  roomIcon: {
    alignItems: 'center',
    backgroundColor: colors.chip,
    borderRadius: 13,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  cardTitle: {
    flex: 1,
    marginLeft: 10,
  },
  roomName: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '800',
  },
  roomMeta: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 3,
  },
  status: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  confirmedStatus: {
    backgroundColor: colors.successSoft,
  },
  pastStatus: {
    backgroundColor: '#EDF0F5',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '900',
  },
  confirmedText: {
    color: colors.success,
  },
  pastText: {
    color: colors.muted,
  },
  bookingTime: {
    alignItems: 'center',
    flexDirection: 'row',
    marginTop: 16,
  },
  bookingText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 4,
  },
  timeSeparator: {
    backgroundColor: colors.border,
    height: 17,
    marginHorizontal: 10,
    width: 1,
  },
  divider: {
    backgroundColor: colors.border,
    height: 1,
    marginTop: 15,
  },
  actions: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  passButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
  },
  passText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '800',
  },
  cancelButton: {
    backgroundColor: colors.dangerSoft,
    borderRadius: 9,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  cancelText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '800',
  },
  empty: {
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  emptyIcon: {
    alignItems: 'center',
    backgroundColor: colors.chip,
    borderRadius: 30,
    height: 62,
    justifyContent: 'center',
    width: 62,
  },
  emptyTitle: {
    color: colors.ink,
    fontSize: 19,
    fontWeight: '800',
    marginTop: 14,
  },
  emptyText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 7,
    textAlign: 'center',
  },
  findButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    marginTop: 21,
    paddingHorizontal: 17,
    paddingVertical: 13,
  },
  findButtonText: {
    color: colors.surface,
    fontSize: 14,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.72,
  },
});
