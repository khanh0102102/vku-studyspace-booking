import { Reservation } from '@/src/types';

// Browsers can use the booking flow, but this project intentionally reserves
// device-local reminder scheduling for Android and iOS.
export async function scheduleBookingReminder(
  _reservation: Reservation,
): Promise<string | undefined> {
  return undefined;
}

export async function cancelBookingReminder(_notificationId?: string): Promise<void> {
  return;
}
