import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { colors } from '@/src/constants/theme';
import { Reservation } from '@/src/types';
import { canCheckInReservation } from '@/src/utils/booking';
import { prettyDate } from '@/src/utils/date';

interface BookingPassModalProps {
  reservation: Reservation | null;
  onClose: () => void;
  onCheckIn?: (reservationId: string) => Promise<Reservation | undefined>;
}

export function BookingPassModal({
  reservation,
  onClose,
  onCheckIn,
}: BookingPassModalProps) {
  const [currentReservation, setCurrentReservation] = React.useState<Reservation | null>(
    reservation,
  );
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    setCurrentReservation(reservation);
  }, [reservation]);

  if (!currentReservation) {
    return null;
  }

  const checkedIn = currentReservation.status === 'checked_in';
  const cancelled = currentReservation.status === 'cancelled';
  const canCheckIn = canCheckInReservation(currentReservation);
  const checkInAvailable = !cancelled && !checkedIn && canCheckIn;
  const checkInLocked = !cancelled && !checkedIn && !canCheckIn;

  const handleCheckIn = async () => {
    if (!onCheckIn || !checkInAvailable || submitting) {
      return;
    }

    setSubmitting(true);
    try {
      const checkedInReservation = await onCheckIn(currentReservation.id);
      if (!checkedInReservation) {
        throw new Error('The booking could not be checked in.');
      }

      setCurrentReservation(checkedInReservation);
      Alert.alert(
        'Check-in confirmed',
        'Your booking is now marked as checked in. Keep this QR pass available if room staff asks for it.',
      );
    } catch (error) {
      Alert.alert(
        'Could not check in',
        error instanceof Error ? error.message : 'The server rejected this check-in.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="pageSheet"
      transparent
      visible={Boolean(currentReservation)}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View>
              <Text style={styles.eyebrow}>YOUR BOOKING PASS</Text>
              <Text style={styles.title}>
                {cancelled ? 'Reservation cancelled' : checkedIn ? 'Checked in' : 'Ready for check-in'}
              </Text>
            </View>
            <Pressable
              accessibilityLabel="Close booking pass"
              onPress={onClose}
              style={styles.close}
            >
              <Ionicons color={colors.ink} name="close" size={23} />
            </Pressable>
          </View>

          <View style={styles.roomInfo}>
            <Text style={styles.roomName}>{currentReservation.roomName}</Text>
            <Text style={styles.detail}>
              {'Building ' + currentReservation.building + ' · ' + currentReservation.floor}
            </Text>
            <Text style={styles.detail}>
              {prettyDate(currentReservation.dateKey) + ' · ' + currentReservation.slotLabel}
            </Text>
          </View>

          {!cancelled ? (
            <Pressable
              accessibilityLabel="Booking QR code"
              onPress={() =>
                Alert.alert(
                  'VKU check-in pass',
                  'This QR identifies your reservation. Room staff can scan it during check-in.',
                )
              }
              style={styles.qrPanel}
            >
              <QRCode
                backgroundColor={colors.surface}
                color={colors.ink}
                size={198}
                value={currentReservation.qrValue}
              />
              <Text style={styles.tapHint}>Tap the QR code for check-in help</Text>
            </Pressable>
          ) : (
            <View style={styles.cancelledPanel}>
              <Ionicons color={colors.danger} name="close-circle-outline" size={30} />
              <Text style={styles.cancelledTitle}>This reservation is no longer active.</Text>
              <Text style={styles.cancelledText}>
                The room slot has been released for other students.
              </Text>
            </View>
          )}

          <View style={styles.passId}>
            <Text style={styles.passIdLabel}>BOOKING ID</Text>
            <Text style={styles.passIdValue}>{currentReservation.id}</Text>
          </View>

          {!cancelled && onCheckIn && (
            <Pressable
              disabled={!checkInAvailable || submitting}
              onPress={() => void handleCheckIn()}
              style={({ pressed }) => [
                styles.checkInButton,
                checkedIn && styles.checkedInButton,
                checkInLocked && styles.lockedButton,
                pressed && checkInAvailable && !submitting && styles.pressed,
              ]}
            >
              {submitting ? (
                <ActivityIndicator color={colors.surface} />
              ) : (
                <>
                  <Ionicons
                    color={colors.surface}
                    name={checkedIn ? 'checkmark-circle' : 'qr-code-outline'}
                    size={20}
                  />
                  <Text style={styles.checkInText}>
                    {checkedIn
                      ? 'Checked in — close pass'
                      : checkInAvailable
                        ? 'Confirm check-in'
                        : 'Check-in opens 30 min before'}
                  </Text>
                </>
              )}
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(15, 23, 42, 0.42)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 22,
    paddingBottom: 36,
  },
  handle: {
    alignSelf: 'center',
    backgroundColor: colors.border,
    borderRadius: 4,
    height: 5,
    marginBottom: 16,
    width: 46,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  title: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: '800',
    marginTop: 3,
  },
  close: {
    alignItems: 'center',
    backgroundColor: colors.page,
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  roomInfo: {
    backgroundColor: colors.page,
    borderRadius: 14,
    marginTop: 20,
    padding: 14,
  },
  roomName: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '800',
  },
  detail: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 4,
  },
  qrPanel: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: 18,
    borderStyle: 'dashed',
    borderWidth: 1,
    marginTop: 18,
    padding: 18,
  },
  tapHint: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 13,
  },
  cancelledPanel: {
    alignItems: 'center',
    backgroundColor: colors.dangerSoft,
    borderRadius: 18,
    marginTop: 18,
    padding: 22,
  },
  cancelledTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '800',
    marginTop: 9,
    textAlign: 'center',
  },
  cancelledText: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 5,
    textAlign: 'center',
  },
  passId: {
    alignItems: 'center',
    marginTop: 16,
  },
  passIdLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  passIdValue: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '800',
    marginTop: 3,
  },
  checkInButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 14,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginTop: 20,
    minHeight: 52,
    paddingHorizontal: 15,
  },
  checkedInButton: {
    backgroundColor: colors.success,
  },
  lockedButton: {
    backgroundColor: '#B8C3D8',
  },
  checkInText: {
    color: colors.surface,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.82,
  },
});
