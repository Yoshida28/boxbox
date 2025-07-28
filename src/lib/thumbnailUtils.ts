/**
 * Utility functions for thumbnail management
 */

export interface ThumbnailValidationResult {
  isValid: boolean
  url: string
  error?: string
}

/**
 * Validate if a YouTube video ID is valid
 */
export function isValidYouTubeVideoId(videoId: string): boolean {
  // YouTube video IDs are 11 characters long and contain alphanumeric characters, hyphens, and underscores
  const youtubeVideoIdRegex = /^[a-zA-Z0-9_-]{11}$/
  return youtubeVideoIdRegex.test(videoId)
}

/**
 * Extract YouTube video ID from various URL formats
 */
export function extractYouTubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/
  ]
  
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) {
      return match[1]
    }
  }
  
  return null
}

/**
 * Generate YouTube thumbnail URLs for different qualities
 */
export function getYouTubeThumbnailUrls(videoId: string): {
  maxres: string
  high: string
  medium: string
  default: string
} {
  const baseUrl = `https://img.youtube.com/vi/${videoId}`
  return {
    maxres: `${baseUrl}/maxresdefault.jpg`,
    high: `${baseUrl}/hqdefault.jpg`,
    medium: `${baseUrl}/mqdefault.jpg`,
    default: `${baseUrl}/default.jpg`
  }
}

/**
 * Validate if a thumbnail URL is accessible
 */
export async function validateThumbnailUrl(url: string): Promise<{
  isValid: boolean
  status?: number
  error?: string
}> {
  try {
    const response = await fetch(url, { 
      method: 'HEAD',
      signal: AbortSignal.timeout(5000) // 5 second timeout
    })
    
    return {
      isValid: response.ok,
      status: response.status
    }
  } catch (error) {
    return {
      isValid: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Get the best available thumbnail URL for a video ID
 */
export async function getBestThumbnailUrl(videoId: string): Promise<string> {
  if (!isValidYouTubeVideoId(videoId)) {
    throw new Error('Invalid YouTube video ID')
  }
  
  const urls = getYouTubeThumbnailUrls(videoId)
  
  // Try maxres first, then fallback to high quality
  try {
    const maxresCheck = await validateThumbnailUrl(urls.maxres)
    if (maxresCheck.isValid) {
      return urls.maxres
    }
  } catch {
    // Continue to fallback
  }
  
  // Fallback to high quality
  try {
    const highCheck = await validateThumbnailUrl(urls.high)
    if (highCheck.isValid) {
      return urls.high
    }
  } catch {
    // Continue to fallback
  }
  
  // Final fallback to default
  return urls.default
}

/**
 * Get a working thumbnail URL with comprehensive fallback
 */
export async function getWorkingThumbnailUrl(videoId: string): Promise<{
  url: string
  quality: string
  isValid: boolean
}> {
  // First validate the video ID format
  if (!isValidYouTubeVideoId(videoId)) {
    return {
      url: getCircuitFallbackThumbnail('default'),
      quality: 'fallback',
      isValid: false
    }
  }
  
  const urls = getYouTubeThumbnailUrls(videoId)
  const qualities = [
    { key: 'maxres', url: urls.maxres },
    { key: 'high', url: urls.high },
    { key: 'medium', url: urls.medium },
    { key: 'default', url: urls.default }
  ]
  
  // Try each quality in order
  for (const quality of qualities) {
    try {
      const check = await validateThumbnailUrl(quality.url)
      if (check.isValid) {
        return {
          url: quality.url,
          quality: quality.key,
          isValid: true
        }
      }
    } catch (error) {
      console.warn(`Failed to validate ${quality.key} thumbnail for ${videoId}:`, error)
      continue
    }
  }
  
  // If no YouTube thumbnail works, return fallback
  return {
    url: getCircuitFallbackThumbnail('default'),
    quality: 'fallback',
    isValid: false
  }
}

/**
 * Normalize race name for consistent caching
 */
export function normalizeRaceName(raceName: string): string {
  return raceName
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Generate cache key for race thumbnails
 */
export function generateCacheKey(raceName: string, year: string): string {
  return `${normalizeRaceName(raceName)}_${year}`
}

/**
 * Parse race name from various formats
 */
export function parseRaceName(input: string): {
  raceName: string
  year?: string
} {
  // Remove common suffixes
  const cleanInput = input
    .replace(/grand\s*prix/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
  
  // Try to extract year
  const yearMatch = cleanInput.match(/(\d{4})/)
  const year = yearMatch ? yearMatch[1] : undefined
  
  // Remove year from race name
  const raceName = year ? cleanInput.replace(/\d{4}/, '').trim() : cleanInput
  
  return { raceName, year }
}

/**
 * Get fallback thumbnail based on circuit name
 */
export function getCircuitFallbackThumbnail(circuitName: string): string {
  // Use F1 logo as fallback instead of sea diving image
  return 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/33/F1.svg/512px-F1.svg.png'
}

/**
 * Debounce function for API calls
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout
  return (...args: Parameters<T>) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

/**
 * Retry function for failed API calls
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: Error
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error')
      
      if (attempt === maxAttempts) {
        throw lastError
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay * attempt))
    }
  }
  
  throw lastError!
} 

/**
 * Validate and clean up video IDs in thumbnail database
 */
export async function validateThumbnailDatabase(): Promise<{
  valid: string[]
  invalid: string[]
  total: number
}> {
  const { getAllRaceKeys } = await import('./thumbnailManager')
  
  const allRaces = await getAllRaceKeys()
  const valid: string[] = []
  const invalid: string[] = []
  
  for (const race of allRaces) {
    if (isValidYouTubeVideoId(race.videoId)) {
      // Test if the video actually exists
      try {
        const result = await getWorkingThumbnailUrl(race.videoId)
        if (result.isValid) {
          valid.push(race.videoId)
        } else {
          invalid.push(race.videoId)
        }
      } catch (error) {
        invalid.push(race.videoId)
      }
    } else {
      invalid.push(race.videoId)
    }
  }
  
  return {
    valid,
    invalid,
    total: allRaces.length
  }
}

/**
 * Get a list of all unique video IDs in the database
 */
export async function getAllVideoIds(): Promise<string[]> {
  const { getAllRaceKeys } = await import('./thumbnailManager')
  const allRaces = await getAllRaceKeys()
  const uniqueIds = new Set(allRaces.map(race => race.videoId))
  return Array.from(uniqueIds)
} 