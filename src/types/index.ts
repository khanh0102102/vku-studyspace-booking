export type Building = 'A' | 'B' | 'C' | 'V';
export type Equipment = 'Projector' | 'Whiteboard' | 'High-spec PC' | 'AC';
export type ReservationStatus = 'confirmed' | 'checked_in' | 'cancelled';

export interface TimeSlot {
  id: string;
  label: string;
  startsAt: string;
  endsAt: string;
}

export interface BusyRule {
  weekdays: number[];
  slotIds: string[];
}

export interface Room {
  id: string;
  name: string;
  building: Building;
  floor: string;
  capacity: number;
  equipment: Equipment[];
  imageUrl: string;
  description: string;
  busyRules: BusyRule[];
}

export interface Reservation {
  id: string;
  userId: string;
  roomId: string;
  roomName: string;
  building: Building;
  floor: string;
  dateKey: string;
  slotId: string;
  slotLabel: string;
  startAt: string;
  endAt: string;
  qrValue: string;
  studentId: string;
  createdAt: string;
  status: ReservationStatus;
  notificationId?: string;
  cancelledAt?: string;
  checkedInAt?: string;
}

export interface BookingAvailability {
  reservationId: string;
  roomId: string;
  dateKey: string;
  slotId: string;
  startAt: string;
  endAt: string;
}

export interface BookingFilters {
  query: string;
  building: Building | 'All';
  minCapacity: number | null;
  equipment: Equipment | 'All';
}

export interface UserSession {
  id: string;
  fullName: string;
  studentId: string;
  email: string;
}

export type RealtimeStatus = 'offline' | 'connecting' | 'connected' | 'error';

export interface BookingChange {
  roomId: string;
  dateKey: string;
  slotId: string;
  reserved: boolean;
}

export type RootStackParamList = {
  Discover: undefined;
  RoomDetails: { roomId: string };
  MyBookings: undefined;
};
