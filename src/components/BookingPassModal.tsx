import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
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
import { prettyDate } from '@/src/utils/date';

interface BookingPassModalProps {
  reservation: Reservation | null;
  onClose: () => void;
}

export function BookingPassModal({ reservation, onClose }: BookingPassModalProps) {
  const [checkedIn, setCheckedIn] = React.useState(false);

  React.useEffect(() => {
    if (reservation) {
      setCheckedIn(false);
    }
  }, [reservation]);

  if (!reservation) {
    return null;
  }

  const handleCheckIn = () => {
    setCheckedIn(true);
    Alert.alert('Check-in confirmed', 'Show this QR code to the room assistant if requested.');
  };

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="pageSheet"
      transparent
      visible={Boolean(reservation)}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View>
              <Text style={styles.eyebrow}>YOUR BOOKING PASS</Text>
              <Text style={styles.title}>Ready for check-in</Text>
            </View>
            <Pressable accessibilityLabel="Close booking pass" onPress={onClose} style={styles.close}>
              <Ionicons color={colors.ink} name="close" size={23} />
            </Pressable>
          </View>

          <View style={styles.roomInfo}>
            <Text style={styles.roomName}>{reservation.roomName}</Text>
            <Text style={styles.detail}>
              {'Building ' + reservation.building + ' · ' + reservation.floor}
            </Text>
            <Text style={styles.detail}>{prettyDate(reservation.dateKey) + ' · ' + reservation.slotLabel}</Text>
          </View>

          <Pressable
            accessibilityLabel="Booking QR code"
            onPress={() => Alert.alert('VKU check-in pass', 'Scan this unique code at the room entrance.')}
            style={styles.qrPanel}
          >
            <QRCode backgroundColor={colors.surface} color={colors.ink} size={198} value={reservation.qrValue} />
            <Text style={styles.tapHint}>Tap the QR code for check-in help</Text>
          </Pressable>

          <View style={styles.passId}>
            <Text style={styles.passIdLabel}>BOOKING ID</Text>
            <Text style={styles.passIdValue}>{reservation.id}</Text>
          </View>

          <Pressable
            onPress={checkedIn ? onClose : handleCheckIn}
            style={({ pressed }) => [styles.checkInButton, checkedIn && styles.checkedInButton, pressed && styles.pressed]}
          >
            <Ionicons color={colors.surface} name={checkedIn ? 'checkmark-circle' : 'qr-code-outline'} size={20} />
            <Text style={styles.checkInText}>{checkedIn ? 'Checked in — close pass' : 'Confirm check-in'}</Text>
          </Pressable>
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
  },
  checkedInButton: {
    backgroundColor: colors.success,
  },
  checkInText: {
    color: colors.surface,
    fontSize: 15,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.82,
  },
});
