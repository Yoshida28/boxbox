import { create } from 'zustand'
import { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface AuthState {
  user: User | null
  loading: boolean
  setUser: (user: User | null) => void
  setLoading: (loading: boolean) => void
  signUp: (email: string, password: string) => Promise<{ error?: any }>
  signIn: (email: string, password: string) => Promise<{ error?: any }>
  signOut: () => Promise<void>
  initialize: () => Promise<void>
  ensureProfile: (user: User) => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  loading: true,
  
  setUser: (user) => set({ user }),
  
  setLoading: (loading) => set({ loading }),
  
  signUp: async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: undefined
      }
    })
    
    if (data.user && !error) {
      set({ user: data.user })
      // Ensure profile is created
      await get().ensureProfile(data.user)
    }
    
    return { error }
  },
  
  signIn: async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    
    if (data.user && !error) {
      set({ user: data.user })
      // Ensure profile exists
      await get().ensureProfile(data.user)
    }
    
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
    
    supabase.auth.onAuthStateChange(async (event, session) => {
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