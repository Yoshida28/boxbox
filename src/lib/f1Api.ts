// F1 API integration using Jolpi Ergast API
// Documentation: https://api.jolpi.ca/ergast/f1/

import { getThumbnailWithFallback, getRaceThumbnailData, autoImportThumbnails } from './thumbnailManager'

export interface F1Race {
  season: string
  round: string
  raceName: string
  Circuit: {
    circuitId: string
    circuitName: string
    Location: {
      locality: string
      country: string
    }
  }
  date: string
  time?: string
  Results?: Array<{
    position: string
    Driver: {
      driverId: string
      givenName: string
      familyName: string
    }
    Constructor: {
      constructorId: string
      name: string
    }
  }>
}

export interface F1Season {
  season: string
  Races: F1Race[]
}

export interface F1ApiResponse {
  MRData: {
    RaceTable: {
      season: string
      Races: F1Race[]
    }
  }
}

/**
 * Fetch F1 race data for a specific season
 */
export async function fetchF1Season(season: string): Promise<F1Race[]> {
  try {
    const url = `https://api.jolpi.ca/ergast/f1/${season}.json`
    const response = await fetch(url)
    
    if (!response.ok) {
      throw new Error(`Failed to fetch F1 data: ${response.statusText}`)
    }
    
    const data: F1ApiResponse = await response.json()
    return data.MRData.RaceTable.Races || []
  } catch (error) {
    console.error('Error fetching F1 season data:', error)
    throw error
  }
}

/**
 * Fetch F1 race results for a specific race
 */
export async function fetchRaceResults(season: string, round: string): Promise<F1Race | null> {
  try {
    const url = `https://api.jolpi.ca/ergast/f1/${season}/${round}/results.json`
    const response = await fetch(url)
    
    if (!response.ok) {
      throw new Error(`Failed to fetch race results: ${response.statusText}`)
    }
    
    const data: F1ApiResponse = await response.json()
    const races = data.MRData.RaceTable.Races || []
    return races.length > 0 ? races[0] : null
  } catch (error) {
    console.error('Error fetching race results:', error)
    return null
  }
}

/**
 * Fetch multiple F1 seasons in bulk
 */
export async function fetchMultipleSeasons(startYear: number, endYear: number): Promise<{ season: string; races: F1Race[] }[]> {
  const seasons: { season: string; races: F1Race[] }[] = []
  
  for (let year = startYear; year <= endYear; year++) {
    try {
      console.log(`Fetching season ${year}...`)
      const races = await fetchF1Season(year.toString())
      seasons.push({ season: year.toString(), races })
      
      // Add a small delay to be respectful to the API
      await new Promise(resolve => setTimeout(resolve, 100))
    } catch (error) {
      console.error(`Error fetching season ${year}:`, error)
      // Continue with other seasons even if one fails
    }
  }
  
  return seasons
}

/**
 * Get all available F1 seasons from the API
 */
export async function getAvailableSeasons(): Promise<string[]> {
  try {
    const url = 'https://api.jolpi.ca/ergast/f1/seasons.json?limit=100'
    const response = await fetch(url)
    
    if (!response.ok) {
      throw new Error(`Failed to fetch seasons: ${response.statusText}`)
    }
    
    const data = await response.json()
    return data.MRData.SeasonTable.Seasons.map((season: any) => season.season)
  } catch (error) {
    console.error('Error fetching available seasons:', error)
    // Return a fallback list of recent seasons
    const currentYear = new Date().getFullYear()
    const seasons = []
    for (let year = 2000; year <= currentYear; year++) {
      seasons.push(year.toString())
    }
    return seasons
  }
}

/**
 * Get YouTube thumbnail URL from video ID
 */
export function getYouTubeThumbnail(videoId: string, quality: 'default' | 'medium' | 'high' | 'maxres' = 'maxres'): string {
  const qualityMap = {
    default: 'default',
    medium: 'mqdefault',
    high: 'hqdefault',
    maxres: 'maxresdefault'
  }
  
  return `https://img.youtube.com/vi/${videoId}/${qualityMap[quality]}.jpg`
}

/**
 * Get F1 race video ID with improved mapping using thumbnail manager
 */
export function getF1RaceVideoId(raceName: string, season: string): string | null {
  const thumbnailData = getRaceThumbnailData(raceName, season)
  return thumbnailData?.videoId || 'OWz3rQQaf_M' // Default F1 highlights video
}

/**
 * Transform F1 API race data to our database format with enhanced thumbnail support
 */
export function transformF1RaceToDbFormat(race: F1Race, videoId?: string): {
  grand_prix_name: string
  circuit_name: string
  date: string
  winner: string
  podium: string[]
  youtube_video_id: string | null
  thumbnail_url: string | null
  video_url: string | null
  notable_moments?: string
} {
  const winner = race.Results?.[0] 
    ? `${race.Results[0].Driver.givenName} ${race.Results[0].Driver.familyName}`
    : 'TBD'
  
  const podium = race.Results?.slice(0, 3).map(result => 
    `${result.Driver.givenName} ${result.Driver.familyName}`
  ) || []
  
  // Use thumbnail manager for better video/thumbnail mapping
  const thumbnailInfo = getThumbnailWithFallback(race.raceName, race.season)
  const youtubeVideoId = videoId || getF1RaceVideoId(race.raceName, race.season)
  
  // Generate notable moments based on available data
  let notableMoments = ''
  if (race.Results && race.Results.length > 0) {
    const winner = race.Results[0]
    const constructor = winner.Constructor.name
    notableMoments = `${winner.Driver.givenName} ${winner.Driver.familyName} secured victory for ${constructor} at ${race.Circuit.circuitName}.`
    
    if (race.Results.length >= 3) {
      const podiumDrivers = race.Results.slice(0, 3).map(r => 
        `${r.Driver.givenName} ${r.Driver.familyName}`
      ).join(', ')
      notableMoments += ` Podium: ${podiumDrivers}.`
    }
  }
  
  return {
    grand_prix_name: race.raceName,
    circuit_name: race.Circuit.circuitName,
    date: race.date,
    winner,
    podium,
    youtube_video_id: youtubeVideoId,
    thumbnail_url: thumbnailInfo.url,
    video_url: youtubeVideoId ? `https://www.youtube.com/watch?v=${youtubeVideoId}` : null,
    notable_moments: notableMoments || undefined
  }
}

/**
 * Get race statistics and insights
 */
export function getRaceStatistics(races: F1Race[]): {
  totalRaces: number
  uniqueCircuits: number
  uniqueWinners: number
  mostWins: { driver: string; wins: number }[]
  constructorStats: { constructor: string; wins: number }[]
} {
  const winners = new Map<string, number>()
  const constructors = new Map<string, number>()
  const circuits = new Set<string>()
  
  races.forEach(race => {
    circuits.add(race.Circuit.circuitName)
    
    if (race.Results && race.Results.length > 0) {
      const winner = race.Results[0]
      const driverName = `${winner.Driver.givenName} ${winner.Driver.familyName}`
      const constructorName = winner.Constructor.name
      
      winners.set(driverName, (winners.get(driverName) || 0) + 1)
      constructors.set(constructorName, (constructors.get(constructorName) || 0) + 1)
    }
  })
  
  const mostWins = Array.from(winners.entries())
    .map(([driver, wins]) => ({ driver, wins }))
    .sort((a, b) => b.wins - a.wins)
  
  const constructorStats = Array.from(constructors.entries())
    .map(([constructor, wins]) => ({ constructor, wins }))
    .sort((a, b) => b.wins - a.wins)
  
  return {
    totalRaces: races.length,
    uniqueCircuits: circuits.size,
    uniqueWinners: winners.size,
    mostWins,
    constructorStats
  }
}

/**
 * Auto-import and enhance races with thumbnail data
 */
export async function enhanceRacesWithThumbnails(races: any[]): Promise<any[]> {
  await autoImportThumbnails(races)
  return races
}