import { useState, useEffect } from 'react'
import { Search, Filter, Flag, Calendar, TrendingUp, Clock } from 'lucide-react'
import { supabase, Race } from '../lib/supabase'
import { RaceCard } from '../components/RaceCard'
import { useAuthStore } from '../store/authStore'
import { initializeAutoImport, getUpcomingRaces, checkTodaysRaces } from '../lib/autoImportService'

export function DashboardPage() {
  const [races, setRaces] = useState<Race[]>([])
  const [filteredRaces, setFilteredRaces] = useState<Race[]>([])
  const [upcomingRaces, setUpcomingRaces] = useState<Race[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [selectedYear, setSelectedYear] = useState<string>('all')
  const [hasRaceToday, setHasRaceToday] = useState(false)
  
  const { user } = useAuthStore()

  useEffect(() => {
    initializeServices()
    fetchRaces()
    fetchUpcomingRaces()
    checkForTodaysRaces()
    
    // Listen for race updates from auto-import service
    const handleRacesUpdated = () => {
      fetchRaces()
      fetchUpcomingRaces()
    }
    
    window.addEventListener('racesUpdated', handleRacesUpdated)
    
    return () => {
      window.removeEventListener('racesUpdated', handleRacesUpdated)
    }
  }, [])

  useEffect(() => {
    filterRaces()
  }, [races, searchQuery, selectedYear])

  const initializeServices = async () => {
    try {
      await initializeAutoImport()
    } catch (error) {
      console.error('Failed to initialize auto-import:', error)
    }
  }

  const fetchRaces = async () => {
    try {
      const { data, error } = await supabase
        .from('races')
        .select('*')
        .order('date', { ascending: false })

      if (error) throw error
      setRaces(data || [])
    } catch (error) {
      console.error('Error fetching races:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchUpcomingRaces = async () => {
    try {
      const upcoming = await getUpcomingRaces()
      setUpcomingRaces(upcoming)
    } catch (error) {
      console.error('Error fetching upcoming races:', error)
    }
  }

  const checkForTodaysRaces = async () => {
    try {
      const hasRace = await checkTodaysRaces()
      setHasRaceToday(hasRace)
    } catch (error) {
      console.error('Error checking today\'s races:', error)
    }
  }

  const filterRaces = () => {
    let filtered = races

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(race =>
        race.grand_prix_name.toLowerCase().includes(query) ||
        race.circuit_name.toLowerCase().includes(query) ||
        race.date.includes(query) ||
        race.winner.toLowerCase().includes(query)
      )
    }

    // Filter by year
    if (selectedYear !== 'all') {
      filtered = filtered.filter(race => 
        new Date(race.date).getFullYear().toString() === selectedYear
      )
    }

    setFilteredRaces(filtered)
  }

  const availableYears = [...new Set(races.map(race => 
    new Date(race.date).getFullYear()
  ))].sort((a, b) => b - a)

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    })
  }

  const getDaysUntilRace = (dateString: string) => {
    const raceDate = new Date(dateString)
    const today = new Date()
    const diffTime = raceDate.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading F1 races...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Flag className="w-8 h-8 text-red-600 mr-3" />
              <h1 className="text-3xl font-bold text-white" style={{ fontFamily: 'Oswald' }}>
                boxbox
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-gray-300">Welcome, {user?.email?.split('@')[0]}</span>
              <a
                href="/profile"
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Profile
              </a>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Race Today Alert */}
        {hasRaceToday && (
          <div className="mb-6 bg-gradient-to-r from-red-600 to-red-700 rounded-xl p-4">
            <div className="flex items-center">
              <Flag className="w-6 h-6 text-white mr-3" />
              <div>
                <h3 className="text-white font-bold">🏁 Race Day!</h3>
                <p className="text-red-100">There's a Formula 1 race scheduled for today!</p>
              </div>
            </div>
          </div>
        )}

        {/* Upcoming Races */}
        {upcomingRaces.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center">
              <Clock className="w-5 h-5 mr-2 text-red-500" />
              Upcoming Races
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {upcomingRaces.slice(0, 4).map(race => {
                const daysUntil = getDaysUntilRace(race.date)
                return (
                  <div key={race.id} className="bg-gray-900 rounded-lg p-4 border border-gray-800">
                    <h3 className="text-white font-semibold mb-2">{race.grand_prix_name}</h3>
                    <p className="text-gray-400 text-sm mb-2">{race.circuit_name}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-300 text-sm">{formatDate(race.date)}</span>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        daysUntil === 0 ? 'bg-red-600 text-white' :
                        daysUntil <= 3 ? 'bg-orange-600 text-white' :
                        'bg-gray-700 text-gray-300'
                      }`}>
                        {daysUntil === 0 ? 'Today' : 
                         daysUntil === 1 ? 'Tomorrow' : 
                         `${daysUntil} days`}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Search and Filters */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search races, circuits, winners, or dates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:border-red-600 focus:ring-1 focus:ring-red-600 transition-colors"
              />
            </div>
            
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="pl-10 pr-8 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:border-red-600 focus:ring-1 focus:ring-red-600 transition-colors appearance-none min-w-[140px]"
              >
                <option value="all">All Years</option>
                {availableYears.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
              <div className="flex items-center">
                <TrendingUp className="w-5 h-5 text-green-500 mr-2" />
                <div>
                  <p className="text-gray-400 text-sm">Total Races</p>
                  <p className="text-white text-xl font-bold">{races.length}</p>
                </div>
              </div>
            </div>
            <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
              <div className="flex items-center">
                <Calendar className="w-5 h-5 text-blue-500 mr-2" />
                <div>
                  <p className="text-gray-400 text-sm">Seasons Covered</p>
                  <p className="text-white text-xl font-bold">{availableYears.length}</p>
                </div>
              </div>
            </div>
            <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
              <div className="flex items-center">
                <Clock className="w-5 h-5 text-orange-500 mr-2" />
                <div>
                  <p className="text-gray-400 text-sm">Upcoming</p>
                  <p className="text-white text-xl font-bold">{upcomingRaces.length}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="text-gray-400">
            Showing {filteredRaces.length} of {races.length} races
            <span className="ml-2 text-xs bg-green-900/50 text-green-400 px-2 py-1 rounded-full">
              Auto-updated
            </span>
          </div>
        </div>

        {/* Race Grid */}
        {filteredRaces.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredRaces.map(race => (
              <RaceCard key={race.id} race={race} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="text-gray-400 text-lg mb-4">
              {searchQuery || selectedYear !== 'all' 
                ? 'No races found matching your criteria'
                : 'No races available'
              }
            </div>
            {!searchQuery && selectedYear === 'all' && races.length === 0 && (
              <div className="space-y-4">
                <p className="text-gray-500">F1 races are automatically imported when scheduled</p>
                <div className="text-sm text-gray-600">
                  The system checks for new races every 24 hours
                </div>
              </div>
            )}
            {(searchQuery || selectedYear !== 'all') && (
              <button
                onClick={() => {
                  setSearchQuery('')
                  setSelectedYear('all')
                }}
                className="mt-4 text-red-400 hover:text-red-300 transition-colors"
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </main>
    </div>
  )
}