// F1 Thumbnail Management System
// Comprehensive mapping of F1 race highlights with high-quality thumbnails

import { supabase } from './supabase'

export interface ThumbnailData {
  videoId: string
  title: string
  season: string
  round: string
  grandPrix: string
  circuit: string
  date: string
  isOfficial: boolean
  quality: 'maxres' | 'high' | 'medium'
  source: 'f1' | 'fia' | 'community'
}

// Remove the static database - we'll use the actual database instead
// const F1_HIGHLIGHTS_DATABASE: Record<string, ThumbnailData> = { ... }

/**
 * Get thumbnail URL with multiple quality options
 */
export function getThumbnailUrl(videoId: string, quality: 'maxres' | 'high' | 'medium' | 'default' = 'maxres'): string {
  const qualityMap = {
    maxres: 'maxresdefault',
    high: 'hqdefault',
    medium: 'mqdefault',
    default: 'default'
  }
  
  return `https://img.youtube.com/vi/${videoId}/${qualityMap[quality]}.jpg`
}

/**
 * Get thumbnail data for a specific race from database
 */
export async function getRaceThumbnailData(raceName: string, season: string): Promise<ThumbnailData | null> {
  try {
    const { data, error } = await supabase
      .from('races')
      .select('*')
      .eq('grand_prix_name', raceName)
      .gte('date', `${season}-01-01`)
      .lt('date', `${parseInt(season) + 1}-01-01`)
      .maybeSingle()

    if (error || !data) {
      return null
    }

    // If the race has a YouTube video ID, create thumbnail data
    if (data.youtube_video_id) {
      return {
        videoId: data.youtube_video_id,
        title: `${data.grand_prix_name} ${season}`,
        season,
        round: '', // We don't store round in the database
        grandPrix: data.grand_prix_name,
        circuit: data.circuit_name,
        date: data.date,
        isOfficial: true, // Assume official if it has a video ID
        quality: 'maxres',
        source: 'f1'
      }
    }

    return null
  } catch (error) {
    console.error('Error fetching race thumbnail data:', error)
    return null
  }
}

/**
 * Get all races for a season from database
 */
export async function getSeasonThumbnails(season: string): Promise<ThumbnailData[]> {
  try {
    const { data, error } = await supabase
      .from('races')
      .select('*')
      .gte('date', `${season}-01-01`)
      .lt('date', `${parseInt(season) + 1}-01-01`)
      .order('date', { ascending: true })

    if (error || !data) {
      return []
    }

    return data
      .filter(race => race.youtube_video_id) // Only return races with video IDs
      .map(race => ({
        videoId: race.youtube_video_id!,
        title: `${race.grand_prix_name} ${season}`,
        season,
        round: '',
        grandPrix: race.grand_prix_name,
        circuit: race.circuit_name,
        date: race.date,
        isOfficial: true,
        quality: 'maxres',
        source: 'f1'
      }))
  } catch (error) {
    console.error('Error fetching season thumbnails:', error)
    return []
  }
}

/**
 * Get thumbnail with fallback mechanism
 */
export function getThumbnailWithFallback(raceName: string, season: string): {
  url: string
  isOfficial: boolean
  quality: string
} {
  // This function is now async, but we keep the sync version for backward compatibility
  // It will return a fallback immediately
  return {
    url: 'https://images.pexels.com/photos/358220/pexels-photo-358220.jpeg?auto=compress&cs=tinysrgb&w=1280&h=720',
    isOfficial: false,
    quality: 'fallback'
  }
}

/**
 * Get thumbnail with robust validation and fallback
 */
export async function getThumbnailWithRobustFallback(raceName: string, season: string): Promise<{
  url: string
  isOfficial: boolean
  quality: string
  isValid: boolean
}> {
  try {
    // First try to get thumbnail data from database
    const thumbnailData = await getRaceThumbnailData(raceName, season)
    
    if (thumbnailData) {
      // Use the new robust validation function
      const { getWorkingThumbnailUrl } = await import('./thumbnailUtils')
      const result = await getWorkingThumbnailUrl(thumbnailData.videoId)
      
      return {
        url: result.url,
        isOfficial: thumbnailData.isOfficial && result.isValid,
        quality: result.quality,
        isValid: result.isValid
      }
    }
    
    // If no database data, return fallback
    return {
      url: 'https://images.pexels.com/photos/358220/pexels-photo-358220.jpeg?auto=compress&cs=tinysrgb&w=1280&h=720',
      isOfficial: false,
      quality: 'fallback',
      isValid: false
    }
  } catch (error) {
    console.error('Error in getThumbnailWithRobustFallback:', error)
    return {
      url: 'https://images.pexels.com/photos/358220/pexels-photo-358220.jpeg?auto=compress&cs=tinysrgb&w=1280&h=720',
      isOfficial: false,
      quality: 'fallback',
      isValid: false
    }
  }
}

/**
 * Get optimized thumbnail using YouTube API with "Race Highlights | [Year] [Grand Prix]" pattern
 */
import { getRaceHighlightThumbnail } from './thumbnailService'

export async function getOptimizedThumbnailWithAPI(raceName: string, season: string): Promise<{
  url: string
  isOfficial: boolean
  quality: string
  videoId?: string
}> {
  try {
    // Use the new thumbnail service
    const result = await getRaceHighlightThumbnail(raceName, season)
    
    if (result.success && result.thumbnailUrl) {
      return {
        url: result.thumbnailUrl,
        isOfficial: result.channelTitle?.toLowerCase().includes('formula 1') || false,
        quality: 'maxres',
        videoId: result.videoId
      }
    }
  } catch (error) {
    console.warn('Thumbnail service failed:', error)
  }
  
  // Fallback to static database (now just returns fallback)
  return getThumbnailWithFallback(raceName, season)
}

/**
 * Validate thumbnail URL accessibility
 */
export async function validateThumbnailUrl(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { 
      method: 'HEAD',
      signal: AbortSignal.timeout(5000)
    })
    return response.ok
  } catch (error) {
    console.warn('Thumbnail validation failed:', error)
    return false
  }
}

/**
 * Get multiple thumbnail qualities for responsive images
 */
export function getResponsiveThumbnails(videoId: string): {
  maxres: string
  high: string
  medium: string
  default: string
} {
  return {
    maxres: getThumbnailUrl(videoId, 'maxres'),
    high: getThumbnailUrl(videoId, 'high'),
    medium: getThumbnailUrl(videoId, 'medium'),
    default: getThumbnailUrl(videoId, 'default')
  }
}

/**
 * Auto-import thumbnail data when new races are scheduled
 */
export async function autoImportThumbnails(races: any[]): Promise<void> {
  // This function is now async and works with the database
  for (const race of races) {
    try {
      // Check if race already has thumbnail data
      if (!race.thumbnail_url && !race.youtube_video_id) {
        // Try to find thumbnail using the API
        const year = new Date(race.date).getFullYear().toString()
        const result = await getOptimizedThumbnailWithAPI(race.grand_prix_name, year)
        
        if (result.videoId) {
          // Update the race with thumbnail data
          const { error } = await supabase
            .from('races')
            .update({
              thumbnail_url: result.url,
              youtube_video_id: result.videoId,
              video_url: `https://www.youtube.com/watch?v=${result.videoId}`
            })
            .eq('id', race.id)
          
          if (error) {
            console.error(`Failed to update race ${race.grand_prix_name} with thumbnail data:`, error)
          }
        }
      }
    } catch (error) {
      console.error(`Error auto-importing thumbnail for ${race.grand_prix_name}:`, error)
    }
  }
}

/**
 * Get thumbnail statistics from database
 */
export async function getThumbnailStats(): Promise<{
  totalRaces: number
  officialThumbnails: number
  communityThumbnails: number
  coverageByYear: Record<string, number>
}> {
  try {
    const { data, error } = await supabase
      .from('races')
      .select('date, youtube_video_id, thumbnail_url')

    if (error || !data) {
      return {
        totalRaces: 0,
        officialThumbnails: 0,
        communityThumbnails: 0,
        coverageByYear: {}
      }
    }

    const totalRaces = data.length
    const officialThumbnails = data.filter(race => race.youtube_video_id).length
    const communityThumbnails = data.filter(race => race.thumbnail_url && !race.youtube_video_id).length
    
    const coverageByYear: Record<string, number> = {}
    data.forEach(race => {
      const year = new Date(race.date).getFullYear().toString()
      coverageByYear[year] = (coverageByYear[year] || 0) + 1
    })

    return {
      totalRaces,
      officialThumbnails,
      communityThumbnails,
      coverageByYear
    }
  } catch (error) {
    console.error('Error getting thumbnail stats:', error)
    return {
      totalRaces: 0,
      officialThumbnails: 0,
      communityThumbnails: 0,
      coverageByYear: {}
    }
  }
}

/**
 * Add race thumbnail data to database
 */
export async function addRaceThumbnail(
  raceId: string,
  videoId: string,
  options: {
    title?: string
    circuit?: string
    date?: string
    isOfficial?: boolean
    quality?: 'maxres' | 'high' | 'medium'
    source?: 'f1' | 'fia' | 'community'
  } = {}
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('races')
      .update({
        youtube_video_id: videoId,
        thumbnail_url: getThumbnailUrl(videoId, options.quality || 'maxres'),
        video_url: `https://www.youtube.com/watch?v=${videoId}`
      })
      .eq('id', raceId)

    if (error) {
      console.error('Error adding race thumbnail:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Error adding race thumbnail:', error)
    return false
  }
}

/**
 * Remove race thumbnail data from database
 */
export async function removeRaceThumbnail(raceId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('races')
      .update({
        youtube_video_id: null,
        thumbnail_url: null,
        video_url: null
      })
      .eq('id', raceId)

    if (error) {
      console.error('Error removing race thumbnail:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Error removing race thumbnail:', error)
    return false
  }
}

/**
 * Get all race keys from database
 */
export async function getAllRaceKeys(): Promise<Array<{
  key: string
  raceName: string
  season: string
  videoId: string
  isOfficial: boolean
}>> {
  try {
    const { data, error } = await supabase
      .from('races')
      .select('id, grand_prix_name, date, youtube_video_id')

    if (error || !data) {
      return []
    }

    return data
      .filter(race => race.youtube_video_id)
      .map(race => ({
        key: race.id,
        raceName: race.grand_prix_name,
        season: new Date(race.date).getFullYear().toString(),
        videoId: race.youtube_video_id!,
        isOfficial: true
      }))
  } catch (error) {
    console.error('Error getting all race keys:', error)
    return []
  }
}

/**
 * Search races in database
 */
export async function searchRaces(query: string): Promise<ThumbnailData[]> {
  try {
    const { data, error } = await supabase
      .from('races')
      .select('*')
      .or(`grand_prix_name.ilike.%${query}%,circuit_name.ilike.%${query}%`)
      .not('youtube_video_id', 'is', null)

    if (error || !data) {
      return []
    }

    return data.map(race => ({
      videoId: race.youtube_video_id!,
      title: `${race.grand_prix_name} ${new Date(race.date).getFullYear()}`,
      season: new Date(race.date).getFullYear().toString(),
      round: '',
      grandPrix: race.grand_prix_name,
      circuit: race.circuit_name,
      date: race.date,
      isOfficial: true,
      quality: 'maxres',
      source: 'f1'
    }))
  } catch (error) {
    console.error('Error searching races:', error)
    return []
  }
}

/**
 * Validate a YouTube video ID and get thumbnail info
 */
export async function validateVideoId(videoId: string): Promise<{
  isValid: boolean
  thumbnailUrl: string
  error?: string
}> {
  try {
    // Test if the video ID is valid by checking if thumbnail exists
    const thumbnailUrl = getThumbnailUrl(videoId, 'maxres')
    const response = await fetch(thumbnailUrl, { method: 'HEAD' })
    
    if (response.ok) {
      return {
        isValid: true,
        thumbnailUrl
      }
    } else {
      // Try high quality as fallback
      const hqThumbnail = getThumbnailUrl(videoId, 'high')
      const hqResponse = await fetch(hqThumbnail, { method: 'HEAD' })
      
      if (hqResponse.ok) {
        return {
          isValid: true,
          thumbnailUrl: hqThumbnail
        }
      } else {
        return {
          isValid: false,
          thumbnailUrl: '',
          error: 'Video thumbnail not found'
        }
      }
    }
  } catch (error) {
    return {
      isValid: false,
      thumbnailUrl: '',
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Batch update thumbnails in database
 */
export async function batchUpdateThumbnails(updates: Array<{
  raceId: string
  videoId: string
  options?: {
    title?: string
    circuit?: string
    date?: string
    isOfficial?: boolean
    quality?: 'maxres' | 'high' | 'medium'
    source?: 'f1' | 'fia' | 'community'
  }
}>): Promise<boolean> {
  try {
    for (const update of updates) {
      const success = await addRaceThumbnail(update.raceId, update.videoId, update.options)
      if (!success) {
        console.error(`Failed to update thumbnail for race ${update.raceId}`)
      }
    }
    return true
  } catch (error) {
    console.error('Error in batch update thumbnails:', error)
    return false
  }
}

/**
 * Export thumbnail database as JSON
 */
export async function exportThumbnailDatabase(): Promise<string> {
  try {
    const { data, error } = await supabase
      .from('races')
      .select('*')
      .not('youtube_video_id', 'is', null)

    if (error || !data) {
      return JSON.stringify([])
    }

    return JSON.stringify(data, null, 2)
  } catch (error) {
    console.error('Error exporting thumbnail database:', error)
    return JSON.stringify([])
  }
}

/**
 * Import thumbnail database from JSON
 */
export async function importThumbnailDatabase(jsonData: string): Promise<boolean> {
  try {
    const data = JSON.parse(jsonData)
    
    for (const race of data) {
      if (race.youtube_video_id) {
        await addRaceThumbnail(race.id, race.youtube_video_id)
      }
    }
    
    return true
  } catch (error) {
    console.error('Error importing thumbnail database:', error)
    return false
  }
}

/**
 * Populate sample race data for testing (only use in development)
 */
export async function populateSampleRaces(): Promise<void> {
  try {
    const sampleRaces = [
      {
        grand_prix_name: 'Monaco Grand Prix',
        circuit_name: 'Circuit de Monaco',
        date: '2024-05-26',
        winner: 'Charles Leclerc',
        podium: ['Charles Leclerc', 'Oscar Piastri', 'Carlos Sainz'],
        youtube_video_id: null, // Let the system find the real video
        thumbnail_url: null
      },
      {
        grand_prix_name: 'British Grand Prix',
        circuit_name: 'Silverstone Circuit',
        date: '2024-07-07',
        winner: 'Lewis Hamilton',
        podium: ['Lewis Hamilton', 'Max Verstappen', 'Lando Norris'],
        youtube_video_id: null, // Let the system find the real video
        thumbnail_url: null
      },
      {
        grand_prix_name: 'Italian Grand Prix',
        circuit_name: 'Monza Circuit',
        date: '2024-09-01',
        winner: 'Max Verstappen',
        podium: ['Max Verstappen', 'Oscar Piastri', 'Lando Norris'],
        youtube_video_id: null, // Let the system find the real video
        thumbnail_url: null
      }
    ]

    for (const race of sampleRaces) {
      const { error } = await supabase
        .from('races')
        .upsert([race], { onConflict: 'grand_prix_name,date' })

      if (error) {
        console.error(`Error inserting sample race ${race.grand_prix_name}:`, error)
      } else {
        console.log(`✅ Added sample race: ${race.grand_prix_name}`)
      }
    }
  } catch (error) {
    console.error('Error populating sample races:', error)
  }
}

/**
 * Clean the database of bad video IDs and thumbnails.
 * Only keeps video IDs that are from the official F1 channel and have a valid thumbnail.
 */
export async function cleanBadVideoIds(): Promise<{ cleaned: number, checked: number, errors: number }> {
  const FORMULA_1_CHANNEL_ID = 'UCB_qr77-2MVdNm0jKKG-h6g'
  let cleaned = 0
  let checked = 0
  let errors = 0
  try {
    const { data: races, error } = await supabase
      .from('races')
      .select('id, youtube_video_id, thumbnail_url')

    if (error || !races) {
      console.error('Failed to fetch races:', error)
      return { cleaned, checked, errors: errors + 1 }
    }

    for (const race of races) {
      checked++
      if (!race.youtube_video_id) continue
      // Check if the video is from the official F1 channel using YouTube API
      try {
        const apiKey = import.meta.env.VITE_YOUTUBE_API_KEY
        const videoUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${race.youtube_video_id}&key=${apiKey}`
        const res = await fetch(videoUrl)
        if (!res.ok) {
          errors++
          continue
        }
        const data = await res.json()
        const item = data.items && data.items[0]
        if (!item || item.snippet.channelId !== FORMULA_1_CHANNEL_ID) {
          // Not from official channel, clean it
          await supabase
            .from('races')
            .update({ youtube_video_id: null, thumbnail_url: null, video_url: null })
            .eq('id', race.id)
          cleaned++
          continue
        }
        // Check if the thumbnail is accessible
        const thumbUrl = race.thumbnail_url || `https://img.youtube.com/vi/${race.youtube_video_id}/maxresdefault.jpg`
        try {
          const thumbRes = await fetch(thumbUrl, { method: 'HEAD' })
          if (!thumbRes.ok) {
            await supabase
              .from('races')
              .update({ youtube_video_id: null, thumbnail_url: null, video_url: null })
              .eq('id', race.id)
            cleaned++
          }
        } catch {
          await supabase
            .from('races')
            .update({ youtube_video_id: null, thumbnail_url: null, video_url: null })
            .eq('id', race.id)
          cleaned++
        }
      } catch (err) {
        errors++
        continue
      }
    }
    return { cleaned, checked, errors }
  } catch (err) {
    console.error('Error cleaning bad video IDs:', err)
    return { cleaned, checked, errors: errors + 1 }
  }
}