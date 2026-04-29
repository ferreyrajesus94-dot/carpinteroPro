import { supabase } from '@/shared/lib/supabase'

// /auth/v1/settings is not exposed by supabase-js — raw fetch is the only option here.
export async function checkGoogleEnabled(): Promise<boolean> {
  try {
    const url = import.meta.env.VITE_SUPABASE_URL as string
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string
    const res = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } })
    const settings = (await res.json()) as { external?: { google?: boolean } }
    return Boolean(settings?.external?.google)
  } catch {
    return true
  }
}

export async function signInWithEmail(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password })
}

export async function signUpWithEmail(
  email: string,
  password: string,
  metadata: Record<string, string>,
) {
  return supabase.auth.signUp({ email, password, options: { data: metadata } })
}

export async function signInWithGoogle(redirectTo: string) {
  return supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } })
}
