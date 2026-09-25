# VKU StudySpace

> A real-time study-room booking app built with React Native, Expo, TypeScript and Zustand for Mini-Project 2.

VKU StudySpace lets students discover campus study rooms, filter the list instantly, reserve a two-hour session without clashes, receive a local check-in reminder, and show a unique QR booking pass at the room entrance.

## Features

- **Fast room discovery:** FlatList room feed with remote room photos, building/floor, capacity, equipment tags and live Available now / Occupied status.
- **Multi-parameter filters:** instant full-text search plus persisted building, minimum-capacity and equipment chips.
- **7-day reservation flow:** 7-day selector and 4 discrete two-hour slots: 07:30–09:30, 09:30–11:30, 13:00–15:00 and 15:00–17:00.
- **Conflict prevention:** past slots, the supplied real-time occupancy feed, and the student's existing reservation are disabled. The store validates again immediately before committing a booking, so the UI cannot bypass the rule.
- **Booking pass:** every reservation receives a unique ID and QR payload in the form VKU|STUDYSPACE|booking-id|student-id, shown in an interactive check-in modal.
- **Local notification:** after a successful booking, the app requests notification permission and schedules a reminder exactly 15 minutes before the slot begins.
- **Persistent global state:** session, filters and reservations are stored locally with Zustand persist plus AsyncStorage; pending reminders are removed when the booking is cancelled.
- **Responsive lists:** memoized RoomCard, stable callbacks, fixed-card getItemLayout, clipped subviews and conservative FlatList batching settings.

## Tech stack

| Area | Technology |
| --- | --- |
| Mobile framework | React Native 0.81 + Expo SDK 54 |
| Language | TypeScript (strict mode) |
| Navigation | React Navigation native stack |
| Global state / persistence | Zustand + AsyncStorage |
| QR pass | react-native-qrcode-svg |
| Local reminders | expo-notifications |
| Tests | Jest + Jest Expo |

## Project structure

~~~text
.
├── App.tsx                         # Safe-area shell and hydration gate
├── src/
│   ├── components/                 # Memoized room card, chips, QR pass modal
│   ├── constants/                  # Theme and time-slot definitions
│   ├── data/rooms.ts               # Demo campus-room data and occupancy rules
│   ├── navigation/                 # React Navigation stack
│   ├── screens/                    # Discover, room details and bookings screens
│   ├── services/notifications.ts   # Permission, schedule and cancellation APIs
│   ├── store/useBookingStore.ts    # Zustand state and authoritative booking action
│   ├── types/                      # Shared TypeScript domain models
│   └── utils/                      # Date helpers and pure conflict engine
├── __tests__/booking.test.ts       # Conflict-engine unit tests
└── docs/TECHNICAL_REPORT.md        # Ready-to-export 2–4 page report
~~~

## Prerequisites

- Node.js **20 LTS or newer**
- npm 10+ (or a compatible package manager)
- Expo Go installed on a physical Android/iOS device for the demo
- Phone and development computer on the same Wi-Fi network, or use Expo tunnel mode

> On Windows PowerShell configurations that block npm.ps1, run npm.cmd instead of npm, as shown below.

## Run locally

~~~bash
git clone <your-public-github-repository-url>
cd Mini_project_2
npm install
npm run start
~~~

Then:

1. Open **Expo Go** on the physical phone.
2. Scan the terminal QR code (Android) or use the iOS Camera app.
3. If LAN discovery fails, stop Metro and run npx expo start --tunnel.

Useful commands:

~~~bash
npm run android      # open Android emulator / connected Android device
npm run ios          # open iOS simulator (macOS required)
npm run web          # run the web preview
npm run typecheck    # TypeScript validation
npm test             # conflict-engine tests
~~~

## Demo scenario

1. On **Discover**, search lab, then choose Building B, capacity 10+ seats, and High-spec PC.
2. Open **Digital Lab B401**. Select a date and an enabled slot; disabled grey slots demonstrate live conflict prevention.
3. Tap **Reserve**. Allow notifications when prompted. The QR booking pass opens, with a unique booking ID and check-in action.
4. Open **My bookings** using the calendar icon. Show the QR pass again, then cancel the reservation to demonstrate state removal and reminder cancellation.
5. Close and reopen the app to demonstrate persisted filters/reservations (before cancellation).

## Local-notification notes

This project intentionally uses **local** notifications: no server or Expo push token is required. The reminder is only schedulable when the trigger is still in the future; booking very close to the start time may therefore create the reservation without a reminder. Local notifications can be tested in Expo Go, while current Expo guidance requires a development build for Android remote push notifications. See the [Expo Notifications documentation](https://docs.expo.dev/versions/v54.0.0/sdk/notifications/).

For a production build, generate native projects or use EAS so the expo-notifications configuration in app.json is applied:

~~~bash
npx expo prebuild
npx expo run:android
# or, after configuring an Expo account:
npx eas build --platform android
~~~

## Data and “real-time” model

The assignment does not provide a booking backend. The app therefore ships with deterministic occupancy rules in src/data/rooms.ts, which act as a local simulation of a server’s current reservations. New bookings are immediately added to the Zustand store and all visible room/slot status is recalculated. To connect a real API later:

1. Replace ROOMS / busyRules with a room-and-availability query.
2. Call reserveRoom only after a server transaction or use a server-issued booking ID.
3. Subscribe to a WebSocket, Supabase or Firebase channel and merge availability events into the store.
4. Keep the client-side check as an optimistic UX guard, but make the server transaction authoritative.

## Submission checklist

- [ ] Push this folder to a **public GitHub repository** and replace the clone URL above.
- [ ] Run npm run typecheck and npm test.
- [ ] Start Expo, test the complete flow on a physical phone, and record the 2–3 minute scenario above.
- [ ] Capture the Expo QR code / Snack URL and add it to the repository description or this README.
- [ ] Fill in student, course and lecturer fields in [docs/TECHNICAL_REPORT.md](docs/TECHNICAL_REPORT.md), export it as PDF, and submit it.

## Known scope boundary

The project is a complete offline-first frontend demonstration. A genuine multi-user “real-time” product needs a protected backend reservation transaction and server-driven availability feed; the current deterministic feed makes the required conflict and status behavior testable without credentials or a network service.
