import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import {
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BookingPassModal } from '@/src/components/BookingPassModal';
import { TIME_SLOTS } from '@/src/constants/slots';
import { colors, shadows } from '@/src/constants/theme';
import { ROOMS } from '@/src/data/rooms';
import { scheduleBookingReminder } from '@/src/services/notifications';
import { useBookingStore } from '@/src/store/useBookingStore';
import { Reservation, RootStackParamList, TimeSlot } from '@/src/types';
import {
  isSeededSlotBusy,
  isSlotUnavailable,
} from '@/src/utils/booking';
import { getNextSevenDays, isSlotInPast } from '@/src/utils/date';

type Props = NativeStackScreenProps<RootStackParamList, 'RoomDetails'>;

export function RoomDetailsScreen({ navigation, route }: Props) {
  const room = ROOMS.find((item) => item.id === route.params.roomId);
  const availabilityReservations = useBookingStore((state) => state.availabilityReservations);
  const ownReservations = useBookingStore((state) => state.reservations);
  const reserveRoom = useBookingStore((state) => state.reserveRoom);
  const checkInBooking = useBookingStore((state) => state.checkInBooking);
  const setNotificationId = useBookingStore((state) => state.setNotificationId);
  const dateOptions = React.useMemo(() => getNextSevenDays(), []);
  const [selectedDate, setSelectedDate] = React.useState(dateOptions[0].key);
  const [selectedSlotId, setSelectedSlotId] = React.useState<string | null>(null);
  const [passReservation, setPassReservation] = React.useState<Reservation | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  if (!room) {
    return (
      <SafeAreaView style={styles.notFound}>
        <Text style={styles.notFoundText}>This room could not be found.</Text>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>Go back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const selectedSlot = TIME_SLOTS.find((item) => item.id === selectedSlotId);
  const canBook =
    Boolean(selectedSlot) &&
    !isSlotUnavailable(room, availabilityReservations, selectedDate, selectedSlot as TimeSlot);

  const chooseDate = (dateKey: string) => {
    setSelectedDate(dateKey);
    setSelectedSlotId(null);
  };

  const reserveSelectedSlot = async () => {
    if (!selectedSlot || !canBook || submitting) {
      return;
    }

    setSubmitting(true);
    const attempt = await reserveRoom({
      roomId: room.id,
      dateKey: selectedDate,
      slotId: selectedSlot.id,
    });

    if (!attempt.ok) {
      setSubmitting(false);
      Alert.alert('Could not reserve this slot', attempt.error);
      return;
    }

    const notificationId = await scheduleBookingReminder(attempt.reservation);
    if (notificationId) {
      setNotificationId(attempt.reservation.id, notificationId);
      attempt.reservation.notificationId = notificationId;
    }
    setSubmitting(false);
    setPassReservation(attempt.reservation);
    Alert.alert(
      'Room reserved',
      Platform.OS === 'web'
        ? 'Your booking pass is ready. Local reminders are available in the Android and iOS app.'
        : notificationId
          ? 'Your booking pass is ready. A local reminder is set for 15 minutes before check-in.'
          : 'Your booking pass is ready. Enable device notifications to receive the 15-minute reminder.',
    );
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Image source={{ uri: room.imageUrl }} style={styles.heroImage} />
          <Pressable
            accessibilityLabel="Go back"
            onPress={() => navigation.goBack()}
            style={({ pressed }) => [styles.backCircle, pressed && styles.pressed]}
          >
            <Ionicons color={colors.ink} name="arrow-back" size={22} />
          </Pressable>
        </View>

        <View style={styles.info}>
          <View style={styles.nameLine}>
            <Text style={styles.name}>{room.name}</Text>
            <View style={styles.capacityBadge}>
              <Ionicons color={colors.primaryDark} name="people-outline" size={15} />
              <Text style={styles.capacityText}>{room.capacity}</Text>
            </View>
          </View>
          <View style={styles.locationLine}>
            <Ionicons color={colors.muted} name="location-outline" size={17} />
            <Text style={styles.location}>{'Building ' + room.building + ' · ' + room.floor}</Text>
          </View>
          <Text style={styles.description}>{room.description}</Text>
          <View style={styles.equipmentList}>
            {room.equipment.map((item) => (
              <View key={item} style={styles.equipment}>
                <Text style={styles.equipmentText}>{item}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeading}>
            <View>
              <Text style={styles.sectionTitle}>Pick a date</Text>
              <Text style={styles.sectionHint}>Bookings open for the next 7 days</Text>
            </View>
          </View>
          <ScrollView
            contentContainerStyle={styles.days}
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            {dateOptions.map((date) => {
              const selected = selectedDate === date.key;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  key={date.key}
                  onPress={() => chooseDate(date.key)}
                  style={({ pressed }) => [styles.day, selected && styles.daySelected, pressed && styles.pressed]}
                >
                  <Text style={[styles.dayName, selected && styles.daySelectedText]}>{date.dayName}</Text>
                  <Text style={[styles.dayNumber, selected && styles.daySelectedText]}>{date.dayNumber}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Choose a 2-hour time slot</Text>
          <Text style={styles.sectionHint}>Booked and past times are disabled in real time.</Text>
          <View style={styles.legend}>
            <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
            <Text style={styles.legendText}>Selected</Text>
            <View style={[styles.legendDot, { backgroundColor: '#D9E0EC' }]} />
            <Text style={styles.legendText}>Unavailable</Text>
          </View>

          <View style={styles.slots}>
            {TIME_SLOTS.map((slot) => {
              const past = isSlotInPast(selectedDate, slot);
              const seededBusy = isSeededSlotBusy(room, selectedDate, slot.id);
              const myBooking = ownReservations.some(
                (reservation) =>
                  reservation.roomId === room.id &&
                  reservation.dateKey === selectedDate &&
                  reservation.slotId === slot.id &&
                  reservation.status !== 'cancelled',
              );
              const unavailable = isSlotUnavailable(
                room,
                availabilityReservations,
                selectedDate,
                slot,
              );
              const selected = selectedSlotId === slot.id;
              const availabilityText = past
                ? 'Past'
                : myBooking
                  ? 'Your booking'
                  : seededBusy
                    ? 'Scheduled unavailable'
                    : 'Available';

              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ disabled: unavailable, selected }}
                  disabled={unavailable}
                  key={slot.id}
                  onPress={() => setSelectedSlotId(slot.id)}
                  style={({ pressed }) => [
                    styles.slot,
                    selected && styles.slotSelected,
                    unavailable && styles.slotDisabled,
                    pressed && !unavailable && styles.pressed,
                  ]}
                >
                  <View>
                    <Text style={[styles.slotTime, selected && styles.slotSelectedText, unavailable && styles.slotDisabledText]}>{slot.label}</Text>
                    <Text style={[styles.slotStatus, selected && styles.slotSelectedText, unavailable && styles.slotDisabledText]}>{availabilityText}</Text>
                  </View>
                  <Ionicons
                    color={selected ? colors.surface : unavailable ? '#9EA8B9' : colors.primary}
                    name={selected ? 'checkmark-circle' : unavailable ? 'close-circle-outline' : 'ellipse-outline'}
                    size={23}
                  />
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <View>
          <Text style={styles.footerCaption}>SELECTED SLOT</Text>
          <Text numberOfLines={1} style={styles.footerSlot}>
            {selectedSlot ? selectedSlot.label : 'Choose a time'}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          disabled={!canBook || submitting}
          onPress={() => void reserveSelectedSlot()}
          style={({ pressed }) => [
            styles.reserveButton,
            (!canBook || submitting) && styles.reserveDisabled,
            pressed && canBook && styles.pressed,
          ]}
        >
          <Text style={styles.reserveText}>{submitting ? 'Reserving…' : 'Reserve'}</Text>
          <Ionicons color={colors.surface} name="arrow-forward" size={18} />
        </Pressable>
      </View>

      <BookingPassModal
        onCheckIn={async (reservationId) => checkInBooking(reservationId)}
        onClose={() => setPassReservation(null)}
        reservation={passReservation}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.page,
    flex: 1,
  },
  content: {
    paddingBottom: 116,
  },
  hero: {
    height: 232,
  },
  heroImage: {
    backgroundColor: '#DDE5F3',
    height: '100%',
    width: '100%',
  },
  backCircle: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 21,
    height: 42,
    justifyContent: 'center',
    left: 17,
    position: 'absolute',
    top: 14,
    width: 42,
    ...shadows.card,
  },
  info: {
    backgroundColor: colors.surface,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    padding: 19,
  },
  nameLine: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
  },
  name: {
    color: colors.ink,
    flex: 1,
    fontSize: 22,
    fontWeight: '800',
  },
  capacityBadge: {
    alignItems: 'center',
    backgroundColor: colors.chip,
    borderRadius: 12,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  capacityText: {
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: '800',
  },
  locationLine: {
    alignItems: 'center',
    flexDirection: 'row',
    marginTop: 7,
  },
  location: {
    color: colors.muted,
    fontSize: 13,
    marginLeft: 4,
  },
  description: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 14,
  },
  equipmentList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginTop: 14,
  },
  equipment: {
    backgroundColor: colors.chip,
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  equipmentText: {
    color: colors.primaryDark,
    fontSize: 11,
    fontWeight: '700',
  },
  section: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    marginHorizontal: 17,
    marginTop: 17,
    padding: 17,
    ...shadows.card,
  },
  sectionHeading: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '800',
  },
  sectionHint: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 4,
  },
  days: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 15,
  },
  day: {
    alignItems: 'center',
    backgroundColor: colors.page,
    borderColor: colors.border,
    borderRadius: 13,
    borderWidth: 1,
    height: 66,
    justifyContent: 'center',
    width: 58,
  },
  daySelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dayName: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
  },
  dayNumber: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '900',
    marginTop: 2,
  },
  daySelectedText: {
    color: colors.surface,
  },
  legend: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
    marginTop: 13,
  },
  legendDot: {
    borderRadius: 4,
    height: 8,
    marginLeft: 5,
    width: 8,
  },
  legendText: {
    color: colors.muted,
    fontSize: 11,
  },
  slots: {
    gap: 10,
    marginTop: 14,
  },
  slot: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.primary,
    borderRadius: 13,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 62,
    paddingHorizontal: 14,
  },
  slotSelected: {
    backgroundColor: colors.primary,
  },
  slotDisabled: {
    backgroundColor: '#F0F2F6',
    borderColor: '#E2E6EE',
  },
  slotTime: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '800',
  },
  slotStatus: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 3,
  },
  slotDisabledText: {
    color: '#99A3B5',
  },
  slotSelectedText: {
    color: colors.surface,
  },
  footer: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    left: 0,
    paddingHorizontal: 18,
    paddingVertical: 13,
    position: 'absolute',
    right: 0,
  },
  footerCaption: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  footerSlot: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 3,
    maxWidth: 146,
  },
  reserveButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 13,
    flexDirection: 'row',
    gap: 6,
    height: 49,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  reserveDisabled: {
    backgroundColor: '#B8C3D8',
  },
  reserveText: {
    color: colors.surface,
    fontSize: 15,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.78,
  },
  notFound: {
    alignItems: 'center',
    backgroundColor: colors.page,
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  notFoundText: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '700',
  },
  backButton: {
    marginTop: 14,
  },
  backText: {
    color: colors.primary,
    fontWeight: '800',
  },
});
