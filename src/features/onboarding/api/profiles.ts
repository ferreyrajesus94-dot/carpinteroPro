import { supabase } from '@/shared/lib/supabase'

export async function markOnboarded(userId: string): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ onboarded_at: new Date().toISOString() })
    .eq('id', userId)
  if (error) throw error
}

export async function resetOnboarding(userId: string): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ onboarded_at: null })
    .eq('id', userId)
  if (error) throw error
}
