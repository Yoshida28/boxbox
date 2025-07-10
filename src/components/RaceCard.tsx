import { useState, useEffect } from 'react'
import { Calendar, MapPin, Star, MessageCircle, Trophy, CheckCircle, Youtube } from 'lucide-react'
import { Race } from '../lib/supabase'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { getRaceHighlightThumbnail, getOptimizedThumbnail } from '../lib/youtubeApi'
import { getOptimizedThumbnailWithAPI, getThumbnailWithRobustFallback } from '../lib/thumbnailManager'
import { getCircuitFallbackThumbnail } from '../lib/thumbnailUtils'

interface RaceCardProps {
  race: Race
}

interface RaceStats {
  averageRating: number
  reviewCount: number
}

export function RaceCard({ race }: RaceCardProps) {
  const navigate = useNavigate()
  const [stats, setStats] = useState<RaceStats>({ averageRating: 0, reviewCount: 0 })
  const [loading, setLoading] = useState(true)
  const [thumbnailUrl, setThumbnailUrl] = useState<string>('')
  const [isOfficialThumbnail, setIsOfficialThumbnail] = useState(false)
  const [thumbnailLoading, setThumbnailLoading] = useState(true)

  const raceDate = new Date(race.date)
  const now = new Date()
  const hasHappened = raceDate <= now

  useEffect(() => {
    fetchRaceStats()
    if (hasHappened) {
      loadThumbnail()
    } else {
      setThumbnailLoading(false)
    }
  }, [race.id])

  const fetchRaceStats = async () => {
    try {
      const { data, error } = await supabase
        .from('reviews')
        .select('rating')
        .eq('race_id', race.id)

      if (error) {
        console.error('Error fetching race stats:', error)
        // Set default values instead of throwing
        setStats({ averageRating: 0, reviewCount: 0 })
        return
      }

      const reviewCount = data.length
      const averageRating = reviewCount > 0 
        ? data.reduce((sum, review) => sum + review.rating, 0) / reviewCount 
        : 0

      setStats({ averageRating, reviewCount })
    } catch (error) {
      console.error('Error fetching race stats:', error)
      // Set default values on error
      setStats({ averageRating: 0, reviewCount: 0 })
    } finally {
      setLoading(false)
    }
  }

  const loadThumbnail = async () => {
    setThumbnailLoading(true)
    
    try {
      // First try the stored thumbnail URL
      if (race.thumbnail_url) {
        try {
          const thumbnailCheck = await fetch(race.thumbnail_url, { method: 'HEAD' })
          if (thumbnailCheck.ok) {
            setThumbnailUrl(race.thumbnail_url)
            setIsOfficialThumbnail(true)
            setThumbnailLoading(false)
            return
          }
        } catch (error) {
          console.warn('Stored thumbnail check failed:', error)
        }
      }

      // Use the Gemini-powered thumbnail service
      const year = new Date(race.date).getFullYear().toString()
      const { getRaceHighlightThumbnail } = await import('../lib/thumbnailService')
      const result = await getRaceHighlightThumbnail(race.grand_prix_name, year)
      
      if (result.success && result.thumbnailUrl) {
        setThumbnailUrl(result.thumbnailUrl)
        setIsOfficialThumbnail(result.channelTitle?.toLowerCase().includes('formula 1') || false)
        
        // Update race with video ID if found
        if (result.videoId && !race.youtube_video_id) {
          console.log(`Found video ID for ${race.grand_prix_name}: ${result.videoId}`)
          // In a real app, you might want to update the database here
        }
      } else {
        // Fallback to circuit-specific image
        const fallbackImage = getCircuitFallbackThumbnail(race.circuit_name)
        setThumbnailUrl(fallbackImage)
        setIsOfficialThumbnail(false)
      }
      
    } catch (error) {
      console.error('Error loading thumbnail:', error)
      // Use utility function for fallback thumbnail
      const fallbackImage = getCircuitFallbackThumbnail(race.circuit_name)
      
      setThumbnailUrl(fallbackImage)
      setIsOfficialThumbnail(false)
    } finally {
      setThumbnailLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  return (
    <div 
      className="bg-gray-900 rounded-xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer transform hover:scale-105 group"
      onClick={() => navigate(`/race/${race.id}`)}
    >
      <div className="relative">
        {!hasHappened ? (
          <div className="w-full h-48 bg-gray-800 flex flex-col items-center justify-center">
            <img
              src="https://upload.wikimedia.org/wikipedia/commons/thumb/3/33/F1.svg/512px-F1.svg.png"
              alt="F1 Placeholder"
              className="w-16 h-16 mb-2 opacity-70"
            />
            <span className="text-gray-300">Race has not happened yet</span>
          </div>
        ) : thumbnailLoading ? (
          <div className="w-full h-48 bg-gray-800 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
          </div>
        ) : (
          <img
            src={thumbnailUrl}
            alt={race.grand_prix_name}
            className="w-full h-48 object-cover group-hover:scale-110 transition-transform duration-500"
            onError={(e) => {
              console.warn(`Failed to load thumbnail for ${race.grand_prix_name}, using fallback`)
              e.currentTarget.src = getCircuitFallbackThumbnail(race.circuit_name)
            }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
        
        {/* Year Badge */}
        <div className="absolute top-4 right-4">
          <span className="bg-red-600 text-white px-3 py-1 rounded-full text-sm font-bold">
            {new Date(race.date).getFullYear()}
          </span>
        </div>

        {/* Official Content Badge */}
        {isOfficialThumbnail && !thumbnailLoading && hasHappened && (
          <div className="absolute top-4 left-4">
            <div className="flex items-center bg-green-600/90 backdrop-blur-sm text-white px-2 py-1 rounded-full text-xs">
              <CheckCircle className="w-3 h-3 mr-1" />
              Official
            </div>
          </div>
        )}

        {/* YouTube Badge */}
        {race.youtube_video_id && (
          <div className="absolute bottom-4 right-4">
            <div className="flex items-center bg-red-600/90 backdrop-blur-sm text-white px-2 py-1 rounded-full text-xs">
              <Youtube className="w-3 h-3 mr-1" />
              Video
            </div>
          </div>
        )}
        
        {/* Winner Badge */}
        {race.winner && race.winner !== 'TBD' && hasHappened && (
          <div className="absolute bottom-4 left-4 flex items-center bg-black/70 backdrop-blur-sm rounded-lg px-3 py-2">
            <Trophy className="w-4 h-4 text-yellow-400 mr-2" />
            <span className="text-white text-sm font-medium">{race.winner}</span>
          </div>
        )}
      </div>
      
      <div className="p-6">
        <h3 className="text-xl font-bold text-white mb-2 group-hover:text-red-400 transition-colors">
          {race.grand_prix_name}
        </h3>
        
        <div className="space-y-2 mb-4">
          <div className="flex items-center text-gray-400">
            <MapPin className="w-4 h-4 mr-2 text-red-500" />
            <span className="text-sm">{race.circuit_name}</span>
          </div>
          <div className="flex items-center text-gray-400">
            <Calendar className="w-4 h-4 mr-2 text-red-500" />
            <span className="text-sm">{formatDate(race.date)}</span>
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {!loading && stats.reviewCount > 0 ? (
              <>
                <div className="flex items-center space-x-1">
                  <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  <span className="text-white font-semibold">
                    {stats.averageRating.toFixed(1)}
                  </span>
                </div>
                <div className="flex items-center space-x-1 text-gray-400">
                  <MessageCircle className="w-4 h-4" />
                  <span className="text-sm">{stats.reviewCount}</span>
                </div>
              </>
            ) : (
              <span className="text-gray-500 text-sm">No reviews yet</span>
            )}
          </div>
          
          <button className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors font-medium">
            Rate & Review
          </button>
        </div>
      </div>
    </div>
  )
}