import { TIME_SLOTS } from '../src/constants/slots';
import { ROOMS } from '../src/data/rooms';
import { Reservation } from '../src/types';
import {
  createPassValue,
  isBookedByStudent,
  isSeededSlotBusy,
  isSlotUnavailable,
} from '../src/utils/booking';

const room = ROOMS.find((item) => item.id === 'a-201')!;
const slot = TIME_SLOTS.find((item) => item.id === 'morning-1')!;

const reservation: Reservation = {
  id: 'BK-TEST-001',
  userId: 'user-test-001',
  roomId: room.id,
  roomName: room.name,
  building: room.building,
  floor: room.floor,
  dateKey: '2030-01-08',
  slotId: slot.id,
  slotLabel: slot.label,
  startAt: '2030-01-08T07:30:00.000Z',
  endAt: '2030-01-08T09:30:00.000Z',
  qrValue: 'VKU|STUDYSPACE|BK-TEST-001|23IT123',
  studentId: '23IT123',
  createdAt: '2030-01-01T00:00:00.000Z',
};

describe('booking conflict engine', () => {
  it('marks seeded occupancy as unavailable on its configured weekday', () => {
    expect(isSeededSlotBusy(room, '2030-01-07', slot.id)).toBe(true);
    expect(isSeededSlotBusy(room, '2030-01-08', slot.id)).toBe(false);
  });

  it('detects a student reservation for the exact room/date/slot', () => {
    expect(isBookedByStudent([reservation], room.id, reservation.dateKey, slot.id)).toBe(true);
    expect(isBookedByStudent([reservation], room.id, reservation.dateKey, 'afternoon-1')).toBe(false);
  });

  it('does not allow a slot once it is in the user reservation collection', () => {
    expect(
      isSlotUnavailable(
        room,
        [reservation],
        reservation.dateKey,
        slot,
        new Date('2030-01-01T00:00:00.000Z'),
      ),
    ).toBe(true);
  });

  it('creates a deterministic, room-check-in-safe pass payload', () => {
    expect(createPassValue('BK-TEST-001', '23IT123')).toBe(
      'VKU|STUDYSPACE|BK-TEST-001|23IT123',
    );
  });
});
