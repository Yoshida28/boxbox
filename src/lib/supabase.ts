import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Race = {
  id: string
  grand_prix_name: string
  circuit_name: string
  date: string
  winner: string
  podium: string[]
  notable_moments?: string
  track_layout_image_url?: string
  youtube_video_id?: string
  thumbnail_url?: string
  video_url?: string
  created_at: string
  updated_at: string
}

export type Review = {
  id: string
  race_id: string
  user_id: string
  profile_id: string
  rating: number | null
  body: string
  created_at: string
  updated_at: string
  parent_review_id?: string | null
  is_edited: boolean
  edited_at?: string | null
  depth: number
}

export type Profile = {
  id: string
  email: string
  username: string
  is_admin: boolean
  created_at: string
  updated_at: string
}