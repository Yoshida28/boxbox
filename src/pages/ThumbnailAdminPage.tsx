import { useState, useEffect } from 'react'
import { getCacheStats, clearThumbnailCache, cleanupInvalidThumbnails } from '../lib/thumbnailService'
import { getRaceHighlightThumbnail } from '../lib/thumbnailService'
import { quotaManager, getQuotaWarningMessage } from '../lib/quotaManager'
import { validateThumbnailDatabase, getAllVideoIds } from '../lib/thumbnailUtils'
import { populateSampleRaces } from '../lib/thumbnailManager'
import { testSearchQuery } from '../lib/thumbnailService'

interface CacheStats {
  totalCached: number
  byYear: Record<string, number>
  oldestCache: string | null
  newestCache: string | null
}

interface VideoIdValidation {
  valid: string[]
  invalid: string[]
  total: number
}

export default function ThumbnailAdminPage() {
  const [stats, setStats] = useState<CacheStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [testRace, setTestRace] = useState('')
  const [testYear, setTestYear] = useState('2024')
  const [testResult, setTestResult] = useState<any>(null)
  const [quotaInfo, setQuotaInfo] = useState(quotaManager.getQuotaInfo())
  const [videoIdValidation, setVideoIdValidation] = useState<VideoIdValidation | null>(null)

  useEffect(() => {
    loadStats()
    // Update quota info every 5 seconds
    const interval = setInterval(() => {
      setQuotaInfo(quotaManager.getQuotaInfo())
    }, 5000)
    
    return () => clearInterval(interval)
  }, [])

  const loadStats = async () => {
    setLoading(true)
    try {
      const result = await getCacheStats()
      if (result.success && result.stats) {
        setStats(result.stats)
      } else {
        setMessage('Failed to load cache stats')
      }
    } catch (error) {
      setMessage('Error loading stats: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setLoading(false)
    }
  }

  const handleClearCache = async () => {
    if (!confirm('Are you sure you want to clear all cached thumbnails?')) {
      return
    }

    setLoading(true)
    try {
      const result = await clearThumbnailCache()
      if (result.success) {
        setMessage('Cache cleared successfully')
        await loadStats() // Reload stats
      } else {
        setMessage('Failed to clear cache: ' + (result.error || 'Unknown error'))
      }
    } catch (error) {
      setMessage('Error clearing cache: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setLoading(false)
    }
  }

  const handleTestThumbnail = async () => {
    if (!testRace.trim()) {
      setMessage('Please enter a race name')
      return
    }

    setLoading(true)
    try {
      const result = await getRaceHighlightThumbnail(testRace, testYear)
      setTestResult(result)
      setMessage(result.success ? 'Thumbnail fetched successfully' : 'Failed to fetch thumbnail')
    } catch (error) {
      setMessage('Error testing thumbnail: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setLoading(false)
    }
  }

  const handleResetQuota = () => {
    if (confirm('Are you sure you want to reset the quota counter? This is for testing purposes only.')) {
      // Reset quota by clearing localStorage
      localStorage.removeItem('youtube_api_quota')
      setQuotaInfo(quotaManager.getQuotaInfo())
      setMessage('Quota counter reset successfully')
    }
  }

  const handleSimulateQuotaExceeded = () => {
    if (confirm('Simulate quota exceeded for testing?')) {
      quotaManager.simulateQuotaExceeded()
      setQuotaInfo(quotaManager.getQuotaInfo())
      setMessage('Quota exceeded simulation activated')
    }
  }

  const handleSetQuotaUsage = () => {
    const usage = prompt('Enter quota usage count (0-10000):', '9500')
    if (usage !== null) {
      const count = parseInt(usage)
      if (!isNaN(count) && count >= 0 && count <= 10000) {
        quotaManager.setRequestCount(count)
        setQuotaInfo(quotaManager.getQuotaInfo())
        setMessage(`Quota usage set to ${count}`)
      } else {
        setMessage('Invalid quota usage value')
      }
    }
  }

  const handleCleanupInvalidThumbnails = async () => {
    if (!confirm('This will check all cached thumbnails and remove any that are no longer accessible. Continue?')) {
      return
    }

    setLoading(true)
    try {
      const result = await cleanupInvalidThumbnails()
      if (result.success) {
        setMessage(result.message || `Cleaned up ${result.cleanedCount} invalid thumbnails`)
        await loadStats() // Reload stats
      } else {
        setMessage('Failed to cleanup invalid thumbnails: ' + (result.error || 'Unknown error'))
      }
    } catch (error) {
      setMessage('Error cleaning up invalid thumbnails: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setLoading(false)
    }
  }

  const handleValidateVideoIds = async () => {
    if (!confirm('This will validate all video IDs in the thumbnail database. This may take a while. Continue?')) {
      return
    }

    setLoading(true)
    try {
      const result = await validateThumbnailDatabase()
      setVideoIdValidation(result)
      setMessage(`Validation complete: ${result.valid.length} valid, ${result.invalid.length} invalid out of ${result.total} total`)
    } catch (error) {
      setMessage('Error validating video IDs: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setLoading(false)
    }
  }

  const handlePopulateSampleRaces = async () => {
    if (!confirm('This will add sample race data to the database for testing. Continue?')) {
      return
    }

    setLoading(true)
    try {
      await populateSampleRaces()
      setMessage('Sample races populated successfully')
      await loadStats() // Reload stats
    } catch (error) {
      setMessage('Error populating sample races: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setLoading(false)
    }
  }

  const handleTestSearchQuery = async () => {
    setLoading(true)
    try {
      const result = await testSearchQuery()
      if (result.success) {
        setMessage(`Search query test successful! Generated query: "${result.query}"`)
      } else {
        setMessage('Search query test failed: ' + (result.error || 'Unknown error'))
      }
    } catch (error) {
      setMessage('Error testing search query: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Thumbnail Cache Management</h1>

        {/* Quota Information */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">YouTube API Quota</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-gray-700 p-4 rounded">
              <div className="text-2xl font-bold text-blue-400">{quotaInfo.usedQuota}</div>
              <div className="text-gray-300">Used Today</div>
            </div>
            <div className="bg-gray-700 p-4 rounded">
              <div className="text-2xl font-bold text-green-400">{quotaInfo.remainingQuota}</div>
              <div className="text-gray-300">Remaining</div>
            </div>
            <div className="bg-gray-700 p-4 rounded">
              <div className="text-2xl font-bold text-yellow-400">{quotaManager.getUsagePercentage().toFixed(1)}%</div>
              <div className="text-gray-300">Usage</div>
            </div>
            <div className="bg-gray-700 p-4 rounded">
              <div className="text-sm text-gray-300">Status</div>
              <div className={`text-lg font-bold ${
                quotaManager.getQuotaStatus() === 'Quota Exceeded' ? 'text-red-400' :
                quotaManager.getQuotaStatus() === 'Quota Low' ? 'text-yellow-400' :
                'text-green-400'
              }`}>
                {quotaManager.getQuotaStatus()}
              </div>
            </div>
          </div>
          {getQuotaWarningMessage() && (
            <div className="mt-4 p-3 bg-yellow-600/20 border border-yellow-600/30 rounded">
              <div className="text-yellow-300 text-sm">{getQuotaWarningMessage()}</div>
            </div>
          )}
        </div>

        {/* Stats Section */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Cache Statistics</h2>
          {loading ? (
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-red-600 mr-3"></div>
              Loading stats...
            </div>
          ) : stats ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-gray-700 p-4 rounded">
                  <div className="text-2xl font-bold text-red-400">{stats.totalCached}</div>
                  <div className="text-gray-300">Total Cached</div>
                </div>
                <div className="bg-gray-700 p-4 rounded">
                  <div className="text-2xl font-bold text-green-400">{Object.keys(stats.byYear).length}</div>
                  <div className="text-gray-300">Years Covered</div>
                </div>
                <div className="bg-gray-700 p-4 rounded">
                  <div className="text-sm text-gray-300">Oldest Cache</div>
                  <div className="text-gray-100">{stats.oldestCache ? new Date(stats.oldestCache).toLocaleDateString() : 'N/A'}</div>
                </div>
                <div className="bg-gray-700 p-4 rounded">
                  <div className="text-sm text-gray-300">Newest Cache</div>
                  <div className="text-gray-100">{stats.newestCache ? new Date(stats.newestCache).toLocaleDateString() : 'N/A'}</div>
                </div>
              </div>

              {/* Year Breakdown */}
              {Object.keys(stats.byYear).length > 0 && (
                <div className="mt-6">
                  <h3 className="text-lg font-semibold mb-3">By Year</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                    {Object.entries(stats.byYear).map(([year, count]) => (
                      <div key={year} className="bg-gray-700 p-3 rounded text-center">
                        <div className="text-lg font-bold text-blue-400">{count}</div>
                        <div className="text-sm text-gray-300">{year}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-gray-400">No stats available</div>
          )}
        </div>

        {/* Actions Section */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Actions</h2>
          <div className="flex flex-wrap gap-4">
            <button
              onClick={loadStats}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 px-4 py-2 rounded transition-colors"
            >
              Refresh Stats
            </button>
            <button
              onClick={handleClearCache}
              disabled={loading}
              className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 px-4 py-2 rounded transition-colors"
            >
              Clear All Cache
            </button>
            <button
              onClick={handleResetQuota}
              className="bg-yellow-600 hover:bg-yellow-700 px-4 py-2 rounded transition-colors"
            >
              Reset Quota Counter
            </button>
            <button
              onClick={handleSimulateQuotaExceeded}
              className="bg-orange-600 hover:bg-orange-700 px-4 py-2 rounded transition-colors"
            >
              Simulate Quota Exceeded
            </button>
            <button
              onClick={handleSetQuotaUsage}
              className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded transition-colors"
            >
              Set Quota Usage
            </button>
            <button
              onClick={handleCleanupInvalidThumbnails}
              disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 px-4 py-2 rounded transition-colors"
            >
              Cleanup Invalid Thumbnails
            </button>
            <button
              onClick={handleValidateVideoIds}
              disabled={loading}
              className="bg-teal-600 hover:bg-teal-700 disabled:bg-gray-600 px-4 py-2 rounded transition-colors"
            >
              Validate Video IDs
            </button>
            <button
              onClick={handlePopulateSampleRaces}
              disabled={loading}
              className="bg-pink-600 hover:bg-pink-700 disabled:bg-gray-600 px-4 py-2 rounded transition-colors"
            >
              Populate Sample Races
            </button>
            <button
              onClick={handleTestSearchQuery}
              disabled={loading}
              className="bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-600 px-4 py-2 rounded transition-colors"
            >
              Test Search Query
            </button>
          </div>
        </div>

        {/* Video ID Validation Section */}
        {videoIdValidation && (
          <div className="bg-gray-800 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Video ID Validation Results</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="bg-gray-700 p-4 rounded">
                <div className="text-2xl font-bold text-green-400">{videoIdValidation.valid.length}</div>
                <div className="text-gray-300">Valid Video IDs</div>
              </div>
              <div className="bg-gray-700 p-4 rounded">
                <div className="text-2xl font-bold text-red-400">{videoIdValidation.invalid.length}</div>
                <div className="text-gray-300">Invalid Video IDs</div>
              </div>
              <div className="bg-gray-700 p-4 rounded">
                <div className="text-2xl font-bold text-blue-400">{videoIdValidation.total}</div>
                <div className="text-gray-300">Total Races</div>
              </div>
            </div>
            
            {videoIdValidation.invalid.length > 0 && (
              <div className="bg-red-600/20 border border-red-600/30 rounded p-4">
                <h3 className="font-semibold text-red-300 mb-2">Invalid Video IDs:</h3>
                <div className="text-sm text-red-200">
                  {videoIdValidation.invalid.map((videoId, index) => (
                    <span key={videoId} className="inline-block bg-red-700/50 px-2 py-1 rounded mr-2 mb-1">
                      {videoId}
                    </span>
                  ))}
                </div>
              </div>
            )}
            
            {videoIdValidation.valid.length > 0 && (
              <div className="bg-green-600/20 border border-green-600/30 rounded p-4 mt-4">
                <h3 className="font-semibold text-green-300 mb-2">Valid Video IDs:</h3>
                <div className="text-sm text-green-200">
                  {videoIdValidation.valid.map((videoId, index) => (
                    <span key={videoId} className="inline-block bg-green-700/50 px-2 py-1 rounded mr-2 mb-1">
                      {videoId}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Test Section */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Test Thumbnail Fetch</h2>
          <div className="flex flex-wrap gap-4 mb-4">
            <input
              type="text"
              placeholder="Race name (e.g., Monaco Grand Prix)"
              value={testRace}
              onChange={(e) => setTestRace(e.target.value)}
              className="bg-gray-700 text-white px-4 py-2 rounded flex-1 min-w-64"
            />
            <input
              type="text"
              placeholder="Year"
              value={testYear}
              onChange={(e) => setTestYear(e.target.value)}
              className="bg-gray-700 text-white px-4 py-2 rounded w-24"
            />
            <button
              onClick={handleTestThumbnail}
              disabled={loading}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 px-4 py-2 rounded transition-colors"
            >
              Test Fetch
            </button>
          </div>

          {testResult && (
            <div className="bg-gray-700 p-4 rounded">
              <h3 className="font-semibold mb-2">Test Result:</h3>
              <pre className="text-sm overflow-auto">
                {JSON.stringify(testResult, null, 2)}
              </pre>
              {testResult.success && testResult.thumbnailUrl && (
                <div className="mt-4">
                  <img
                    src={testResult.thumbnailUrl}
                    alt="Test thumbnail"
                    className="max-w-md rounded"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Message Display */}
        {message && (
          <div className="bg-gray-800 rounded-lg p-4 mb-6">
            <div className="text-gray-300">{message}</div>
          </div>
        )}
      </div>
    </div>
  )
} 