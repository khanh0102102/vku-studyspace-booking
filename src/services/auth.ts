import { Session } from '@supabase/supabase-js';

import { supabase } from '@/src/services/supabase';
import { UserSession } from '@/src/types';

interface ProfileRow {
  user_id: string;
  full_name: string;
  student_id: string;
}

function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase is not configured. Add the project environment variables first.');
  }
  return supabase;
}

export async function getUserSessionFromAuthSession(
  authSession: Session | null,
): Promise<UserSession | null> {
  if (!authSession?.user) {
    return null;
  }

  const client = requireSupabase();
  const { data, error } = await client
    .from('profiles')
    .select('user_id, full_name, student_id')
    .eq('user_id', authSession.user.id)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const profile = data as ProfileRow;
  return {
    id: profile.user_id,
    fullName: profile.full_name,
    studentId: profile.student_id,
    email: authSession.user.email ?? '',
  };
}

export async function getCurrentUserSession(): Promise<UserSession | null> {
  const client = requireSupabase();
  const {
    data: { session },
    error,
  } = await client.auth.getSession();

  if (error) {
    throw new Error(error.message);
  }

  return getUserSessionFromAuthSession(session);
}

export async function signInWithPassword(email: string, password: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    throw new Error(error.message);
  }
}

export async function signUpWithPassword(input: {
  email: string;
  password: string;
  fullName: string;
  studentId: string;
}): Promise<{ needsEmailConfirmation: boolean }> {
  const client = requireSupabase();
  const { data, error } = await client.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      data: {
        full_name: input.fullName,
        student_id: input.studentId,
      },
    },
  });

  if (error) {
    throw new Error(error.message);
  }

  return { needsEmailConfirmation: !data.session };
}

export async function signOut(): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.auth.signOut();
  if (error) {
    throw new Error(error.message);
  }
}


export async function resendSignupConfirmation(email: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.auth.resend({
    type: 'signup',
    email,
  });

  if (error) {
    throw new Error(error.message);
  }
}
