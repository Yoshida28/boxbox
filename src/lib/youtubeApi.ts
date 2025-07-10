// YouTube Thumbnail API Client
// Integrates with Supabase Edge Function for race highlight thumbnails

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

export interface ThumbnailApiResponse {
  success: boolean
  raceName: string
  thumbnailUrl?: string
  videoId?: string
  channelTitle?: string
  videoTitle?: string
  cached?: boolean
  year?: string
  error?: string
}

export interface HealthCheckResponse {
  success: boolean
  status: 'healthy' | 'unhealthy'
  services?: {
    youtubeApi: string
    supabase: string
    cache: string
  }
  error?: string
  timestamp: string
}

export interface CacheStats {
  success: boolean
  stats?: {
    totalCached: number
    byYear: Record<string, number>
    oldestCache: string | null
    newestCache: string | null
  }
  timestamp: string
}

/**
 * Get race highlight thumbnail from YouTube API
 */
export async function getRaceHighlightThumbnail(
  raceName: string, 
  year: string = '2025'
): Promise<ThumbnailApiResponse> {
  // Check if Supabase is configured
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('Supabase configuration missing')
    return {
      success: false,
      raceName,
      error: 'Supabase configuration missing'
    }
  }

  try {
    const apiUrl = `${SUPABASE_URL}/functions/v1/race-thumbnails`
    const params = new URLSearchParams({
      raceName,
      year
    })

    const response = await fetch(`${apiUrl}?${params}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || `API request failed: ${response.status}`)
    }

    const data: ThumbnailApiResponse = await response.json()
    return data

  } catch (error) {
    console.error('YouTube API error:', error)
    return {
      success: false,
      raceName,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Check API health status
 */
export async function checkApiHealth(): Promise<HealthCheckResponse> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return {
      success: false,
      status: 'unhealthy',
      error: 'Supabase configuration missing',
      timestamp: new Date().toISOString()
    }
  }

  try {
    const apiUrl = `${SUPABASE_URL}/functions/v1/race-thumbnails/health`
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
    })

    const data: HealthCheckResponse = await response.json()
    return data

  } catch (error) {
    return {
      success: false,
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }
  }
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<CacheStats> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return {
      success: false,
      timestamp: new Date().toISOString()
    }
  }

  try {
    const apiUrl = `${SUPABASE_URL}/functions/v1/race-thumbnails/cache/stats`
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
    })

    const data: CacheStats = await response.json()
    return data

  } catch (error) {
    return {
      success: false,
      timestamp: new Date().toISOString()
    }
  }
}

/**
 * Clear thumbnail cache (admin function)
 */
export async function clearThumbnailCache(): Promise<{ success: boolean; message?: string; error?: string }> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return {
      success: false,
      error: 'Supabase configuration missing'
    }
  }

  try {
    const apiUrl = `${SUPABASE_URL}/functions/v1/race-thumbnails/cache/clear`
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
    })

    const data = await response.json()
    return data

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Batch fetch thumbnails for multiple races
 */
export async function batchFetchThumbnails(
  races: Array<{ name: string; year: string }>
): Promise<ThumbnailApiResponse[]> {
  const results: ThumbnailApiResponse[] = []
  
  // Process in batches to avoid overwhelming the API
  const batchSize = 5
  for (let i = 0; i < races.length; i += batchSize) {
    const batch = races.slice(i, i + batchSize)
    
    const batchPromises = batch.map(race => 
      getRaceHighlightThumbnail(race.name, race.year)
    )
    
    const batchResults = await Promise.all(batchPromises)
    results.push(...batchResults)
    
    // Add delay between batches to be respectful to the API
    if (i + batchSize < races.length) {
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }
  
  return results
}

/**
 * Get fallback thumbnail URL
 */
export function getFallbackThumbnail(): string {
  return 'https://images.pexels.com/photos/358220/pexels-photo-358220.jpeg?auto=compress&cs=tinysrgb&w=1280&h=720'
}

/**
 * Validate and get best quality thumbnail
 */
export async function getOptimizedThumbnail(
  raceName: string, 
  year: string = '2025'
): Promise<string> {
  try {
    const result = await getRaceHighlightThumbnail(raceName, year)
    
    if (result.success && result.thumbnailUrl) {
      // Verify the thumbnail URL is accessible
      try {
        const thumbnailCheck = await fetch(result.thumbnailUrl, { method: 'HEAD' })
        if (thumbnailCheck.ok) {
          return result.thumbnailUrl
        }
      } catch (error) {
        console.warn('Thumbnail verification failed:', error)
      }
    }
  } catch (error) {
    console.error('Error getting optimized thumbnail:', error)
  }
  
  return getFallbackThumbnail()
}