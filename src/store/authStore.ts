import { create } from 'zustand'
import { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface AuthState {
  user: User | null
  loading: boolean
  setUser: (user: User | null) => void
  setLoading: (loading: boolean) => void
  signInWithGoogle: () => Promise<{ error?: any }>
  signOut: () => Promise<void>
  initialize: () => Promise<void>
  ensureProfile: (user: User) => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  loading: true,
  
  setUser: (user) => set({ user }),
  
  setLoading: (loading) => set({ loading }),
  
  signInWithGoogle: async () => {
    // Use production URL for OAuth redirect
    const redirectUrl = window.location.hostname === 'localhost' 
      ? 'https://boxboxed.vercel.app/dashboard'
      : `${window.location.origin}/dashboard`
    
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl
      }
    })
    
    return { error }
  },
  
  signOut: async () => {
    await supabase.auth.signOut()
    set({ user: null })
  },
  
  initialize: async () => {
    set({ loading: true })
    
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      await get().ensureProfile(session.user)
    }
    set({ user: session?.user ?? null, loading: false })
    
    supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        await get().ensureProfile(session.user)
      }
      set({ user: session?.user ?? null, loading: false })
    })
  },
  
  ensureProfile: async (user: User) => {
    try {
      // Check if profile exists
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .single()

      if (!existingProfile) {
        // Create profile if it doesn't exist
        const { error } = await supabase
          .from('profiles')
          .insert([{
            id: user.id,
            email: user.email || '',
            username: user.email?.split('@')[0] || 'user',
            is_admin: false
          }])

        if (error) {
          console.error('Error creating profile:', error)
        }
      }
    } catch (error) {
      console.error('Error ensuring profile:', error)
    }
  }
}))