# Supabase production setup

## 1. Create and configure the Supabase project

Create a Supabase project and copy the Project URL plus the **Publishable key** from the Dashboard.

The app expects:

EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_SB_PUBLISHABLE_KEY

Never put a service_role or sb_secret_* key in the Expo app.

## 2. Configure Supabase Auth

Open **Authentication → Providers** and keep the **Email** provider enabled.

For the student-only demo, the database trigger accepts only addresses ending in @vku.udn.vn.

Recommended production settings:
- require email confirmation;
- use a strong password policy;
- configure the production Site URL and redirect URLs for the deployed web app;
- use a university SSO/OIDC provider instead of password auth when VKU provides one.

## 3. Apply the migrations

Run these migrations in order:

1. supabase/migrations/20260926000000_realtime_bookings.sql
2. supabase/migrations/20260926000001_harden_validation_search_path.sql
3. supabase/migrations/20260926000002_production_auth_booking_security.sql

The third migration adds:
- Supabase Auth profile records linked to auth.users;
- RLS-protected profiles;
- server-owned room metadata and recurring blocked slots;
- authenticated-only reservation reads;
- RPC booking/cancellation that derives identity from auth.uid();
- server-generated booking IDs;
- unique room/date/slot and user/date/slot constraints.

Existing pre-Auth demo reservations are retained. Legacy demo reservations are intentionally kept as unowned schedule occupancy; they are not attached to student accounts.

## 4. Configure Expo / Vercel

Local .env:

~~~env
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_SB_PUBLISHABLE_KEY
~~~

On Vercel, add the same two variables as **Config** variables for Production/Preview as needed, then redeploy.

## 5. Authentication flow

A new student:
1. Opens VKU StudySpace.
2. Enters full name, student ID, VKU email and password.
3. Supabase Auth creates the user.
4. The database trigger creates public.profiles.
5. After email confirmation, the student signs in.
6. The app stores the Supabase Auth session and loads the user's profile.

Chrome and Edge therefore have separate browser auth storage. A booking created by one signed-in account appears under **My bookings** only for that account.

## 6. True realtime booking test

Sign in as **Student A** in Chrome and **Student B** in Edge.

On Chrome, reserve a future room/date/slot.

On Edge, keep the same room/date open. The slot should change to **Unavailable** through Supabase Realtime without a page refresh.

Then cancel the booking on Chrome. The slot should become **Available** on Edge.

For double-booking, have A and B submit the same room/date/slot as close together as possible. The PostgreSQL unique constraint is the final authority, so at most one insert should succeed.

## 7. Security model

The browser only has the publishable key. It does not receive a service-role/secret key.

The client does not send a trusted student ID to the booking RPC. The booking function uses auth.uid() to identify the caller and reads the student profile on the server.

The reservation API is write-protected: clients get read access needed for realtime availability, but inserts/deletes are performed only through authenticated RPC functions. RLS is enabled on profiles, rooms, room rules, and reservations.

For a real university deployment, add VKU SSO/OIDC, server-side role management, audit logging and operational monitoring before opening registration broadly.
