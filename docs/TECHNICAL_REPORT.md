# MINI-PROJECT 2 — VKU StudySpace

| Item | Information |
| --- | --- |
| Student | **[Your full name] — [Student ID]** |
| Class / course | **[Class] / Nền tảng phát triển ứng dụng** |
| Lecturer | **[Lecturer name]** |
| Submission date | **[DD/MM/YYYY]** |
| GitHub repository | **[Public repository URL]** |
| Expo demo / video | **[Expo QR / Snack URL and video URL]** |

## 1. Problem and solution

VKU students often need a quiet room or computer laboratory but cannot reliably know whether it is free without going to the building. Manual sign-up also makes double booking likely. VKU StudySpace is a mobile application that lets a student discover campus rooms, filter them by practical requirements, select a date and discrete two-hour time slot, then create a digital booking pass.

The goal is a clear, fast flow: **discover → filter → choose time → reserve → check in**. The application is built in React Native with Expo so one TypeScript codebase runs on Android and iOS. The booking layer now uses Supabase PostgreSQL for shared reservations and Supabase Realtime for live cross-device availability. Zustand plus AsyncStorage remains the local cache and UI state layer.

## 2. Main functionality

The Discover screen uses an optimized FlatList to display eight representative rooms. Each card has a room photo, building/floor, seat count, equipment labels and an availability badge. Students can search by text and filter by building (A, B, C, V), minimum capacity (2–20 seats) and equipment (Projector, Whiteboard, High-spec PC, AC). The active filters remain after restarting the app.

The Room Details screen presents seven consecutive dates and four 2-hour slots: 07:30–09:30, 09:30–11:30, 13:00–15:00 and 15:00–17:00. Past slots, source occupancy and the student’s own booking are all visibly disabled. Selecting a free slot enables the Reserve action. A second validation in the global store runs at commit time, preventing a UI race from creating a duplicate room/date/slot reservation.

After booking, the app creates a unique booking identifier and QR payload. The student can revisit this interactive QR pass from My Bookings and confirm check-in. A local device notification is requested and scheduled for 15 minutes before the booked slot. Cancelling a booking removes it from local state and asks the system to cancel the associated notification.

## 3. Technical design

The application uses React Navigation native stack for three screens: Discover, RoomDetails and MyBookings. Its main domain types are Room, TimeSlot, Reservation, BookingFilters and UserSession. The code is organised into components, data, services, store and pure utility modules to keep UI rendering separate from booking rules.

useBookingStore is the single Zustand store. It contains the demo user session, reservations and active filters. Zustand’s persist middleware uses AsyncStorage, therefore the data survives an app restart. Store actions include reserveRoom, setNotificationId, cancelBooking, updateFilters and resetFilters. ReserveRoom verifies that the user is signed in, the requested room/slot exists, the time has not passed, the occupancy feed is not busy and there is no duplicate reservation.

For responsive rendering, the Discover feed uses a memoized RoomCard, stable event callbacks, a fixed card height with getItemLayout, removeClippedSubviews, initial/batch render limits and a modest windowSize. This avoids unnecessary component work while scrolling. The conflict logic in src/utils/booking.ts is pure and has Jest tests for seeded occupancy, duplicate detection, unavailable slots and QR payload generation.

## 4. Evaluation and limitations

The implementation satisfies the requested booking flow, storage, local reminder and performance-focused room feed. It can be validated on a physical device using Expo Go: filtering takes effect immediately, occupied slots cannot be pressed, booking opens a QR pass, and booked data remains after restarting the app.

The shared reservation backend is implemented with Supabase. A PostgreSQL unique constraint on (room_id, date_key, slot_id) is the authoritative double-booking guard. The mobile client submits through the reserve_room RPC, and a Supabase Realtime Postgres Changes subscription propagates INSERT/DELETE events to every connected device. Zustand updates availabilityReservations immediately after each event, so another phone can see a slot become unavailable without restarting. Client-side validation remains a fast UX guard; the database decides the final outcome.

## 5. Conclusion

VKU StudySpace demonstrates a practical React Native/Expo reservation application with a polished campus-oriented interface. The architecture uses TypeScript, React Navigation, Zustand, AsyncStorage, Expo Notifications, Supabase PostgreSQL and Supabase Realtime in a maintainable way. It meets the requested cross-device booking flow and leaves a clear path for authentication, administrative room management and stricter production RLS policies.

## References

1. Expo. *Notifications*. https://docs.expo.dev/versions/v54.0.0/sdk/notifications/
2. Zustand. *Persisting store data*. https://zustand.docs.pmnd.rs/reference/integrations/persisting-store-data
3. React Native. *FlatList*. https://reactnative.dev/docs/flatlist
