# Supabase realtime setup

## 1. Create a Supabase project

Create a project in the Supabase Dashboard. Copy the Project URL and publishable key from the API/Connect panel.

## 2. Run the database migration

Open **SQL Editor** and run:

supabase/migrations/20260926000000_realtime_bookings.sql

This creates the reservations table, a unique room/date/slot constraint, the reserve_room and cancel_booking RPC functions, RLS read access, and the supabase_realtime publication.

Optional: run supabase/seed.sql after the migration to add a sample future server booking.

## 3. Configure Expo

Copy .env.example to .env and fill:

EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_SB_PUBLISHABLE_KEY

Do not commit .env. Never put a Supabase service_role key in the mobile project.

## 4. Install and verify

npm install
npm run typecheck
npm test

## 5. Test true realtime

Start the app on two phones.

On Device A, open a room, select a future date and slot, then tap Reserve.

On Device B, keep the same room/date open. The slot should become unavailable when the Realtime INSERT arrives. Try another free slot to verify normal booking still works.

Then cancel the reservation on Device A. The Realtime DELETE event should make the slot available again on Device B.

The Discover screen shows Live sync when the Realtime channel is connected. Offline demo mode means Supabase variables are missing and the previous local mode is active.

## 6. Security note

This mini-project still uses a demo student session, so the public RPC receives the student ID from the client. For production, replace this with Supabase Auth and derive identity from the authenticated JWT inside the database function/RLS policy. Never treat a client-provided student ID as a trusted identity.

Current Supabase Expo guidance uses @supabase/supabase-js, EXPO_PUBLIC_* variables, AsyncStorage for React Native auth/session storage, and Realtime subscriptions for database changes.
