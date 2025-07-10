// Automatic F1 Race Import Service
// Handles background importing of new F1 races without user intervention

import { supabase } from './supabase'
import { fetchF1Season, transformF1RaceToDbFormat, getAvailableSeasons } from './f1Api'

interface ImportLog {
  timestamp: string
  season: string
  racesImported: number
  racesSkipped: number
  status: 'success' | 'error'
  error?: string
}

class AutoImportService {
  private isRunning = false
  private importInterval: NodeJS.Timeout | null = null
  private readonly CHECK_INTERVAL = 24 * 60 * 60 * 1000 // 24 hours
  private readonly CURRENT_YEAR = new Date().getFullYear()
  private readonly SEASONS_TO_MONITOR = [this.CURRENT_YEAR, this.CURRENT_YEAR - 1] // Current and previous year

  /**
   * Initialize the auto-import service
   */
  async initialize(): Promise<void> {
    console.log('🏁 Initializing F1 Auto-Import Service...')
    
    // Run initial import check
    await this.checkAndImportNewRaces()
    
    // Set up periodic checking
    this.startPeriodicCheck()
    
    console.log('✅ F1 Auto-Import Service initialized')
  }

  /**
   * Start periodic checking for new races
   */
  private startPeriodicCheck(): void {
    if (this.importInterval) {
      clearInterval(this.importInterval)
    }

    this.importInterval = setInterval(async () => {
      await this.checkAndImportNewRaces()
    }, this.CHECK_INTERVAL)
  }

  /**
   * Check for and import new races automatically
   */
  private async checkAndImportNewRaces(): Promise<void> {
    if (this.isRunning) {
      console.log('⏳ Auto-import already running, skipping...')
      return
    }

    this.isRunning = true
    console.log('🔍 Checking for new F1 races...')

    try {
      for (const season of this.SEASONS_TO_MONITOR) {
        await this.importSeasonIfNeeded(season.toString())
      }
    } catch (error) {
      console.error('❌ Error during auto-import:', error)
    } finally {
      this.isRunning = false
    }
  }

  /**
   * Import a specific season if new races are available
   */
  private async importSeasonIfNeeded(season: string): Promise<ImportLog> {
    const log: ImportLog = {
      timestamp: new Date().toISOString(),
      season,
      racesImported: 0,
      racesSkipped: 0,
      status: 'success'
    }

    try {
      // Fetch current races from API
      const apiRaces = await fetchF1Season(season)
      
      if (apiRaces.length === 0) {
        console.log(`📅 No races found for ${season} season`)
        return log
      }

      // Get existing races from database
      const { data: existingRaces, error } = await supabase
        .from('races')
        .select('grand_prix_name, date')
        .gte('date', `${season}-01-01`)
        .lt('date', `${parseInt(season) + 1}-01-01`)

      if (error) throw error

      const existingRaceKeys = new Set(
        (existingRaces || []).map(race => `${race.grand_prix_name}_${race.date}`)
      )

      // Import new races
      for (const apiRace of apiRaces) {
        const raceKey = `${apiRace.raceName}_${apiRace.date}`
        
        if (!existingRaceKeys.has(raceKey)) {
          try {
            const raceData = transformF1RaceToDbFormat(apiRace)
            
            const { error: insertError } = await supabase
              .from('races')
              .insert([raceData])

            if (insertError) {
              console.error(`❌ Error inserting race ${apiRace.raceName}:`, insertError)
            } else {
              log.racesImported++
              console.log(`✅ Imported: ${apiRace.raceName} (${season})`)
            }
          } catch (error) {
            console.error(`❌ Error processing race ${apiRace.raceName}:`, error)
          }
        } else {
          log.racesSkipped++
        }
      }

      if (log.racesImported > 0) {
        console.log(`🎉 Auto-imported ${log.racesImported} new races for ${season} season`)
        
        // Trigger a custom event for UI updates
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('racesUpdated', { 
            detail: { season, imported: log.racesImported } 
          }))
        }
      }

    } catch (error) {
      log.status = 'error'
      log.error = error instanceof Error ? error.message : 'Unknown error'
      console.error(`❌ Error importing season ${season}:`, error)
    }

    return log
  }

  /**
   * Force check for new races (can be called manually)
   */
  async forceCheck(): Promise<void> {
    console.log('🔄 Force checking for new races...')
    await this.checkAndImportNewRaces()
  }

  /**
   * Stop the auto-import service
   */
  stop(): void {
    if (this.importInterval) {
      clearInterval(this.importInterval)
      this.importInterval = null
    }
    console.log('🛑 F1 Auto-Import Service stopped')
  }

  /**
   * Get service status
   */
  getStatus(): {
    isRunning: boolean
    seasonsMonitored: number[]
    checkInterval: number
  } {
    return {
      isRunning: this.isRunning,
      seasonsMonitored: this.SEASONS_TO_MONITOR,
      checkInterval: this.CHECK_INTERVAL
    }
  }
}

// Create singleton instance
export const autoImportService = new AutoImportService()

/**
 * Initialize auto-import when the module loads
 */
export async function initializeAutoImport(): Promise<void> {
  try {
    await autoImportService.initialize()
  } catch (error) {
    console.error('Failed to initialize auto-import service:', error)
  }
}

/**
 * Check if new races are scheduled for today
 */
export async function checkTodaysRaces(): Promise<boolean> {
  const today = new Date().toISOString().split('T')[0]
  
  try {
    const { data, error } = await supabase
      .from('races')
      .select('id')
      .eq('date', today)
      .limit(1)

    if (error) throw error
    
    if (data && data.length > 0) {
      console.log('🏁 Race scheduled for today!')
      return true
    }
  } catch (error) {
    console.error('Error checking today\'s races:', error)
  }
  
  return false
}

/**
 * Get upcoming races in the next 7 days
 */
export async function getUpcomingRaces(): Promise<any[]> {
  const today = new Date()
  const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
  
  try {
    const { data, error } = await supabase
      .from('races')
      .select('*')
      .gte('date', today.toISOString().split('T')[0])
      .lte('date', nextWeek.toISOString().split('T')[0])
      .order('date', { ascending: true })

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error fetching upcoming races:', error)
    return []
  }
}