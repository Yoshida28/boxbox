import { supabase } from './supabase'
import { quotaManager, shouldSkipApiCall } from './quotaManager'

const FORMULA_1_CHANNEL_ID = 'UCB_qr75-ydFVKSF9Dmo6izg'
const YOUTUBE_API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY || 'AIzaSyCXAJsZ0f9ILTXQffRrdPZQmUTOp3Y-fCE'

export interface ThumbnailResult {
  success: boolean
  raceName: string
  thumbnailUrl?: string
  videoId?: string
  channelTitle?: string
  videoTitle?: string
  cached?: boolean
  year?: string
  error?: string
  fallback?: boolean
}

interface CachedThumbnail {
  id: string
  race_name: string
  video_id: string
  thumbnail_url: string
  channel_title: string
  video_title: string
  year: string
  created_at: string
}

/**
 * Get cached thumbnail from database
 */
async function getCachedThumbnail(raceName: string, year: string): Promise<CachedThumbnail | null> {
  try {
    // Use a more robust query approach to handle special characters
    const { data, error } = await supabase
      .from('thumbnail_cache')
      .select('*')
      .eq('race_name', raceName)
      .eq('year', year)
      .maybeSingle() // Use maybeSingle instead of single to avoid errors

    if (error) {
      console.error('Cache lookup error:', error)
      return null
    }

    if (!data) {
      return null // No data found, not an error
    }

    // Validate cached thumbnail URL
    if (data.thumbnail_url) {
      try {
        const thumbnailCheck = await fetch(data.thumbnail_url, { 
          method: 'HEAD',
          // Add timeout to prevent hanging requests
          signal: AbortSignal.timeout(3000)
        })
        if (!thumbnailCheck.ok) {
          console.warn(`Cached thumbnail for ${raceName} ${year} is invalid (${thumbnailCheck.status}), removing from cache`)
          // Remove invalid cached thumbnail
          try {
            await supabase
              .from('thumbnail_cache')
              .delete()
              .eq('race_name', raceName)
              .eq('year', year)
          } catch (deleteError) {
            console.error('Failed to delete invalid cached thumbnail:', deleteError)
          }
          return null
        }
      } catch (error) {
        console.warn(`Cached thumbnail validation failed for ${raceName} ${year}:`, error)
        return null
      }
    }

    return data
  } catch (error) {
    console.error('Cache lookup error:', error)
    return null
  }
}

/**
 * Cache thumbnail data in database
 */
async function cacheThumbnail(data: {
  race_name: string
  video_id: string
  thumbnail_url: string
  channel_title: string
  video_title: string
  year: string
}): Promise<void> {
  try {
    const { error } = await supabase
      .from('thumbnail_cache')
      .upsert([{
        ...data,
        created_at: new Date().toISOString()
      }], {
        onConflict: 'race_name,year'
      })

    if (error) {
      console.error('Failed to cache thumbnail:', error)
    }
  } catch (error) {
    console.error('Cache error:', error)
  }
}

/**
 * Find similar cached thumbnail when exact match not found
 */
async function findSimilarCachedThumbnail(raceName: string, year: string): Promise<CachedThumbnail | null> {
  try {
    // Try to find any cached thumbnail for the same year
    const { data, error } = await supabase
      .from('thumbnail_cache')
      .select('*')
      .eq('year', year)
      .limit(1)
      .maybeSingle()

    if (error || !data) {
      return null
    }

    return data
  } catch (error) {
    console.error('Error finding similar cached thumbnail:', error)
    return null
  }
}

/**
 * Generate search query for F1 race highlights
 */
function generateSearchQuery(raceName: string, year: string): string {
  // Use the exact pattern that F1 uses for their race highlight titles
  // Format: "Race Highlights | 2025 {Race Name} Grand Prix"
  const searchQuery = `Race Highlights ${year} ${raceName}`
  console.log(`[Search] Generated query for ${raceName} ${year}: "${searchQuery}"`)
  return searchQuery
}

/**
 * Search YouTube for F1 race highlights using generated search query
 */
async function searchYouTubeHighlights(raceName: string, year: string): Promise<ThumbnailResult> {
  if (!YOUTUBE_API_KEY) {
    return {
      success: false,
      raceName,
      error: 'YouTube API key not configured'
    }
  }

  // Check if we should skip API calls due to quota
  if (shouldSkipApiCall()) {
    console.log('Skipping API call due to quota limit')
    return {
      success: false,
      raceName,
      error: 'YouTube API quota exceeded. Please try again later.'
    }
  }

  try {
    // Generate search query for the specific race
    const searchQuery = generateSearchQuery(raceName, year)
    
    // Search YouTube with the generated query
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=25&q=${encodeURIComponent(searchQuery)}&type=video&key=${YOUTUBE_API_KEY}&order=relevance&publishedAfter=${year}-01-01T00:00:00Z&publishedBefore=${year}-12-31T23:59:59Z&channelId=${FORMULA_1_CHANNEL_ID}`
    
    console.log(`[YouTube] Searching with query: ${searchQuery}`)
    
    const response = await fetch(searchUrl)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('[YouTube] API error:', response.status, errorText)
      
      // Check if it's a quota error
      if (response.status === 403 && errorText.includes('quota')) {
        // Update quota manager to reflect the actual quota limit
        quotaManager.simulateQuotaExceeded()
        throw new Error(`YouTube API quota exceeded: ${response.status} - ${errorText}`)
      }
      
      throw new Error(`YouTube API error: ${response.status} - ${errorText}`)
    }

    const responseData = await response.json()
    console.log(`[YouTube] Results:`, responseData.items?.map((i: any) => i.snippet.title))
    
    // Record the API request
    quotaManager.recordRequest()
    
    if (!responseData.items || responseData.items.length === 0) {
      return {
        success: false,
        raceName,
        error: `No videos found for ${raceName} ${year}`
      }
    }

    // Look for exact match with the F1 race highlights pattern
    const expectedTitle = `Race Highlights | ${year} ${raceName} Grand Prix`
    console.log(`[YouTube] Looking for exact match: "${expectedTitle}"`)
    
    for (const item of responseData.items) {
      const videoTitle = item.snippet.title
      const channelId = item.snippet.channelId
      
      console.log(`[YouTube] Checking: "${videoTitle}" (Channel: ${channelId})`)
      
      // Check for exact title match first
      if (channelId === FORMULA_1_CHANNEL_ID && videoTitle.trim() === expectedTitle) {
        console.log(`[YouTube] ✅ Found exact match: "${videoTitle}"`)
        const videoId = item.id.videoId
        const thumbnailQualities = [
          'maxresdefault.jpg',
          'hqdefault.jpg', 
          'mqdefault.jpg',
          'sddefault.jpg',
          'default.jpg'
        ]
        let finalThumbnailUrl = ''
        for (const quality of thumbnailQualities) {
          const testUrl = `https://img.youtube.com/vi/${videoId}/${quality}`
          try {
            const thumbnailCheck = await fetch(testUrl, { 
              method: 'HEAD',
              signal: AbortSignal.timeout(5000)
            })
            if (thumbnailCheck.ok) {
              finalThumbnailUrl = testUrl
              console.log(`[YouTube] Found working thumbnail: ${testUrl}`)
              break
            }
          } catch (error) {
            continue
          }
        }
        if (!finalThumbnailUrl) {
          finalThumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
        }
        return {
          success: true,
          raceName,
          thumbnailUrl: finalThumbnailUrl,
          videoId,
          channelTitle: item.snippet.channelTitle,
          videoTitle: item.snippet.title
        }
      }
      
      // Fallback: Check for partial match (race name + highlights)
      const normalizedRaceName = raceName.toLowerCase().replace(/ grand prix/i, '').trim()
      const videoTitleLower = videoTitle.toLowerCase()
      if (
        channelId === FORMULA_1_CHANNEL_ID &&
        videoTitleLower.includes('highlight') &&
        videoTitleLower.includes(normalizedRaceName) &&
        videoTitleLower.includes(year)
      ) {
        console.log(`[YouTube] ✅ Found partial match: "${videoTitle}"`)
        const videoId = item.id.videoId
        const thumbnailQualities = [
          'maxresdefault.jpg',
          'hqdefault.jpg', 
          'mqdefault.jpg',
          'sddefault.jpg',
          'default.jpg'
        ]
        let finalThumbnailUrl = ''
        for (const quality of thumbnailQualities) {
          const testUrl = `https://img.youtube.com/vi/${videoId}/${quality}`
          try {
            const thumbnailCheck = await fetch(testUrl, { 
              method: 'HEAD',
              signal: AbortSignal.timeout(5000)
            })
            if (thumbnailCheck.ok) {
              finalThumbnailUrl = testUrl
              console.log(`[YouTube] Found working thumbnail: ${testUrl}`)
              break
            }
          } catch (error) {
            continue
          }
        }
        if (!finalThumbnailUrl) {
          finalThumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
        }
        return {
          success: true,
          raceName,
          thumbnailUrl: finalThumbnailUrl,
          videoId,
          channelTitle: item.snippet.channelTitle,
          videoTitle: item.snippet.title
        }
      }
    }
    
    // If no match found, fallback to branded F1 image
    console.warn(`[YouTube] No match found for ${raceName} ${year}. Using fallback image.`)
    return {
      success: false,
      raceName,
      thumbnailUrl: 'https://upload.wikimedia.org/wikipedia/commons/3/33/F1.svg',
      error: 'No official F1 highlight found'
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[YouTube] Search error:', errorMessage)
    
    // Check if it's a quota exceeded error
    if (errorMessage.includes('quota') || errorMessage.includes('403')) {
      return {
        success: false,
        raceName,
        error: 'YouTube API quota exceeded. Please try again later or contact administrator.'
      }
    }
    
    return {
      success: false,
      raceName,
      error: `YouTube API error: ${errorMessage}`
    }
  }
}

/**
 * Update race in database with found video data
 */
async function updateRaceWithVideoData(raceName: string, year: string, videoId: string, thumbnailUrl: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('races')
      .update({
        youtube_video_id: videoId,
        thumbnail_url: thumbnailUrl,
        video_url: `https://www.youtube.com/watch?v=${videoId}`
      })
      .eq('grand_prix_name', raceName)
      .gte('date', `${year}-01-01`)
      .lt('date', `${parseInt(year) + 1}-01-01`)

    if (error) {
      console.error('Failed to update race with video data:', error)
    } else {
      console.log(`✅ Updated race ${raceName} ${year} with video ID: ${videoId}`)
    }
  } catch (error) {
    console.error('Error updating race with video data:', error)
  }
}

/**
 * Get race highlight thumbnail with caching
 */
export async function getRaceHighlightThumbnail(
  raceName: string, 
  year: string = '2025'
): Promise<ThumbnailResult> {
  console.log('Getting thumbnail for:', raceName, year)

  try {
    // Check cache first
    const cachedResult = await getCachedThumbnail(raceName, year)
    if (cachedResult) {
      console.log('Found cached thumbnail for:', raceName, year)
      return {
        success: true,
        raceName,
        thumbnailUrl: cachedResult.thumbnail_url,
        videoId: cachedResult.video_id,
        channelTitle: cachedResult.channel_title || undefined,
        videoTitle: cachedResult.video_title || undefined,
        cached: true,
        year: cachedResult.year || undefined
      }
    }

    // Fetch from YouTube API
    console.log('No cache found, fetching from YouTube')
    const youtubeResult = await searchYouTubeHighlights(raceName, year)
    
    if (!youtubeResult.success) {
      // If quota exceeded, try to find similar cached results
      if (youtubeResult.error?.includes('quota')) {
        console.log('Quota exceeded, trying to find similar cached results')
        const similarResult = await findSimilarCachedThumbnail(raceName, year)
        if (similarResult) {
          return {
            success: true,
            raceName,
            thumbnailUrl: similarResult.thumbnail_url,
            videoId: similarResult.video_id,
            channelTitle: similarResult.channel_title || undefined,
            videoTitle: similarResult.video_title || undefined,
            cached: true,
            year: similarResult.year || undefined,
            fallback: true
          }
        }
      }
      return youtubeResult
    }

    // Cache the successful result
    try {
      await cacheThumbnail({
        race_name: raceName,
        video_id: youtubeResult.videoId!,
        thumbnail_url: youtubeResult.thumbnailUrl!,
        channel_title: youtubeResult.channelTitle!,
        video_title: youtubeResult.videoTitle!,
        year
      })
    } catch (cacheError) {
      console.warn('Failed to cache thumbnail, but continuing:', cacheError)
    }

    // Update the race in the database with the found video data
    if (youtubeResult.videoId && youtubeResult.thumbnailUrl) {
      await updateRaceWithVideoData(raceName, year, youtubeResult.videoId, youtubeResult.thumbnailUrl)
    }

    return {
      ...youtubeResult,
      cached: false,
      year
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error getting thumbnail:', errorMessage)
    return {
      success: false,
      raceName,
      error: `Internal error: ${errorMessage}`
    }
  }
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<{
  success: boolean
  stats?: {
    totalCached: number
    byYear: Record<string, number>
    oldestCache: string | null
    newestCache: string | null
  }
  error?: string
}> {
  try {
    const { data, error } = await supabase
      .from('thumbnail_cache')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      return {
        success: false,
        error: error.message
      }
    }

    if (!data || data.length === 0) {
      return {
        success: true,
        stats: {
          totalCached: 0,
          byYear: {},
          oldestCache: null,
          newestCache: null
        }
      }
    }

    const byYear: Record<string, number> = {}
    data.forEach(item => {
      byYear[item.year] = (byYear[item.year] || 0) + 1
    })

    return {
      success: true,
      stats: {
        totalCached: data.length,
        byYear,
        oldestCache: data[data.length - 1]?.created_at || null,
        newestCache: data[0]?.created_at || null
      }
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Clear all cached thumbnails
 */
export async function clearThumbnailCache(): Promise<{
  success: boolean
  error?: string
}> {
  try {
    const { error } = await supabase
      .from('thumbnail_cache')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all records

    if (error) {
      return {
        success: false,
        error: error.message
      }
    }

    return {
      success: true
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Cleanup invalid thumbnails
 */
export async function cleanupInvalidThumbnails(): Promise<{
  success: boolean
  cleanedCount?: number
  message?: string
  error?: string
}> {
  try {
    const { data, error } = await supabase
      .from('thumbnail_cache')
      .select('*')

    if (error) {
      return {
        success: false,
        error: error.message
      }
    }

    if (!data || data.length === 0) {
      return {
        success: true,
        cleanedCount: 0,
        message: 'No cached thumbnails to clean'
      }
    }

    let cleanedCount = 0
    const invalidIds: string[] = []

    // Check each cached thumbnail
    for (const item of data) {
      try {
        const thumbnailCheck = await fetch(item.thumbnail_url, { 
          method: 'HEAD',
          signal: AbortSignal.timeout(3000)
        })
        
        if (!thumbnailCheck.ok) {
          invalidIds.push(item.id)
          cleanedCount++
        }
      } catch (error) {
        invalidIds.push(item.id)
        cleanedCount++
      }
    }

    // Remove invalid thumbnails
    if (invalidIds.length > 0) {
      const { error: deleteError } = await supabase
        .from('thumbnail_cache')
        .delete()
        .in('id', invalidIds)

      if (deleteError) {
        return {
          success: false,
          error: deleteError.message
        }
      }
    }

    return {
      success: true,
      cleanedCount,
      message: `Cleaned up ${cleanedCount} invalid thumbnails`
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Get fallback thumbnail URL
 */
export function getFallbackThumbnail(): string {
  return 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/33/F1.svg/512px-F1.svg.png'
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
      // Try to validate the thumbnail URL
      try {
        const thumbnailCheck = await fetch(result.thumbnailUrl, { method: 'HEAD' })
        if (thumbnailCheck.ok) {
          return result.thumbnailUrl
        }
      } catch (error) {
        console.warn('Thumbnail verification failed:', error)
      }
      
      // If the cached thumbnail fails, try to get a fresh one
      console.log('Cached thumbnail failed validation, trying fresh fetch')
      const freshResult = await searchYouTubeHighlights(raceName, year)
      if (freshResult.success && freshResult.thumbnailUrl) {
        return freshResult.thumbnailUrl
      }
    }
  } catch (error) {
    console.error('Error getting optimized thumbnail:', error)
  }
  
  return getFallbackThumbnail()
} 

/**
 * Test search query generation
 */
export async function testSearchQuery(): Promise<{
  success: boolean
  query?: string
  error?: string
}> {
  try {
    const testQuery = generateSearchQuery('Monaco Grand Prix', '2024')
    return {
      success: true,
      query: testQuery
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
} 