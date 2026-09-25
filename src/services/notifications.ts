import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

import { Reservation } from '@/src/types';

const CHANNEL_ID = 'booking-reminders';

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

async function ensureNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') {
    return false;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Booking reminders',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 200, 150, 200],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted || existing.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) {
    return true;
  }

  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted || requested.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
}

export async function scheduleBookingReminder(
  reservation: Reservation,
): Promise<string | undefined> {
  try {
    const startAt = new Date(reservation.startAt);
    const triggerAt = new Date(startAt.getTime() - 15 * 60 * 1000);

    if (triggerAt.getTime() <= Date.now() || !(await ensureNotificationPermission())) {
      return undefined;
    }

    return await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Study room check-in in 15 minutes',
        body: reservation.roomName + ' · ' + reservation.slotLabel,
        sound: 'default',
        data: { reservationId: reservation.id, roomId: reservation.roomId },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerAt,
        channelId: CHANNEL_ID,
      },
    });
  } catch {
    // A booking remains valid when device permissions or scheduling are unavailable.
    return undefined;
  }
}

export async function cancelBookingReminder(notificationId?: string): Promise<void> {
  if (!notificationId) {
    return;
  }

  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch {
    // The OS can remove a stale notification; no additional recovery is needed.
  }
}
