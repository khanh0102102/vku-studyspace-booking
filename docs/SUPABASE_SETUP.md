# Supabase production setup

## 1. Create and configure the Supabase project

Create a Supabase project and copy the Project URL plus the **Publishable key** from the Dashboard.

The app expects:

EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_SB_PUBLISHABLE_KEY

Never put a service_role or sb_secret_* key in the Expo app.

## 2. Configure Supabase Auth

Open **Authentication → Providers** and keep the **Email** provider enabled.

For this project demo, open the **Email** provider settings and turn **Confirm email** **OFF**. This makes password sign-up create an authenticated session immediately, so the student can enter the app without opening an email.

The app still performs basic client-side validation:
- email must use the @vku.udn.vn domain;
- password must be at least 8 characters;
- full name must contain at least 2 characters;
- student ID must contain 3–20 letters or numbers.

The database trigger still accepts only addresses ending in @vku.udn.vn.

## 3. Apply the migrations

Run these migrations in order:

1. supabase/migrations/20260926000000_realtime_bookings.sql
2. supabase/migrations/20260926000001_harden_validation_search_path.sql
3. supabase/migrations/20260926000002_production_auth_booking_security.sql
4. supabase/migrations/20260926000003_production_booking_lifecycle.sql

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
3. The app validates the basic fields.
4. Supabase Auth creates the user and returns a session immediately because email confirmation is disabled for this demo.
5. The database trigger creates public.profiles.
6. The app loads the user's profile and opens the main booking screens.

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

For the production booking lifecycle, the fourth migration adds:
- server-owned `confirmed`, `checked_in`, and `cancelled` states instead of deleting booking history;
- owner-only reservation reads so student details do not travel through shared availability events;
- a minimal `booking_occupancy` table for realtime room/date/slot availability;
- server-authoritative check-in, allowed from 30 minutes before the booking until it ends;
- realtime occupancy INSERT/DELETE events so another device sees a slot become unavailable/available without refreshing.

For a real university deployment, add VKU SSO/OIDC, server-side role management, audit logging, monitoring, and custom SMTP before opening registration broadly. Supabase's built-in email sender is rate-limited and best-effort; custom SMTP is recommended for production.
