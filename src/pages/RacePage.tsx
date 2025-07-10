import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Calendar, MapPin, Youtube, Star, MessageCircle, Send, Trophy, Users } from 'lucide-react'
import { supabase, Race, Review } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { StarRating } from '../components/StarRating'
import { NestedReviewCard } from '../components/NestedReviewCard'
import { getThumbnailWithRobustFallback } from '../lib/thumbnailManager'
import { getCircuitFallbackThumbnail } from '../lib/thumbnailUtils'

export function RacePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  
  const [race, setRace] = useState<Race | null>(null)
  const [reviews, setReviews] = useState<(Review & { profiles?: { email: string; username: string } })[]>([])
  const [userReview, setUserReview] = useState<Review | null>(null)
  const [newRating, setNewRating] = useState(0)
  const [newReviewBody, setNewReviewBody] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [editingReview, setEditingReview] = useState<Review | null>(null)
  const [submittingReply, setSubmittingReply] = useState(false)
  const [thumbnailUrl, setThumbnailUrl] = useState<string>('')
  const [thumbnailLoading, setThumbnailLoading] = useState(true)

  useEffect(() => {
    if (id) {
      fetchRaceData()
      fetchReviews()
    }
  }, [id])

  useEffect(() => {
    if (race) {
      const raceDate = new Date(race.date)
      const now = new Date()
      const hasHappened = raceDate <= now
      if (hasHappened) {
        loadThumbnail()
      } else {
        setThumbnailLoading(false)
      }
    }
  }, [race])

  const loadThumbnail = async () => {
    setThumbnailLoading(true)
    try {
      if (race?.thumbnail_url) {
        try {
          const thumbnailCheck = await fetch(race.thumbnail_url, { method: 'HEAD' })
          if (thumbnailCheck.ok) {
            setThumbnailUrl(race.thumbnail_url)
            setThumbnailLoading(false)
            return
          }
        } catch {}
      }
      
      // Use the Gemini-powered thumbnail service
      const year = new Date(race?.date || '').getFullYear().toString()
      const { getRaceHighlightThumbnail } = await import('../lib/thumbnailService')
      const result = await getRaceHighlightThumbnail(race?.grand_prix_name || '', year)
      
      if (result.success && result.thumbnailUrl) {
        setThumbnailUrl(result.thumbnailUrl)
      } else {
        setThumbnailUrl(getCircuitFallbackThumbnail(race?.circuit_name || 'default'))
      }
    } catch (error) {
      console.error('Error loading thumbnail:', error)
      setThumbnailUrl(getCircuitFallbackThumbnail(race?.circuit_name || 'default'))
    } finally {
      setThumbnailLoading(false)
    }
  }

  const fetchRaceData = async () => {
    if (!id) return

    try {
      const { data, error } = await supabase
        .from('races')
        .select('*')
        .eq('id', id)
        .single()

      if (error) throw error
      setRace(data)
    } catch (error) {
      console.error('Error fetching race:', error)
      navigate('/dashboard')
    } finally {
      setLoading(false)
    }
  }

  const fetchReviews = async () => {
    if (!id) return

    try {
      const { data, error } = await supabase
        .from('reviews')
        .select(`
          *,
          profiles!inner (email, username)
        `)
        .eq('race_id', id)
        .order('created_at', { ascending: false })

      if (error) throw error

      const reviewsData = data || []
      setReviews(reviewsData)

      // Find current user's review
      const currentUserReview = reviewsData.find(review => review.user_id === user?.id)
      if (currentUserReview) {
        setUserReview(currentUserReview)
        setNewRating(currentUserReview.rating)
        setNewReviewBody(currentUserReview.body)
      }
    } catch (error) {
      console.error('Error fetching reviews:', error)
    }
  }

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !race || !newRating || newRating < 1) return

    setSubmitting(true)

    try {
      const reviewData = {
        race_id: race.id,
        user_id: user.id,
        profile_id: user.id, // profile_id is the same as user_id
        rating: newRating,
        body: newReviewBody.trim()
      }

      if (userReview || editingReview) {
        // Update existing review
        const updateData = {
          ...reviewData,
          is_edited: true
        }
        const { error } = await supabase
          .from('reviews')
          .update(updateData)
          .eq('id', (editingReview || userReview)!.id)

        if (error) throw error
      } else {
        // Create new review
        const { error } = await supabase
          .from('reviews')
          .insert([reviewData])

        if (error) throw error
      }

      // Reset form
      if (!userReview) {
        setNewRating(0)
        setNewReviewBody('')
      }
      setEditingReview(null)

      // Refresh reviews
      await fetchReviews()
    } catch (error) {
      console.error('Error submitting review:', error)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteReview = async (reviewId: string) => {
    if (!confirm('Are you sure you want to delete this review?')) return

    try {
      const { error } = await supabase
        .from('reviews')
        .delete()
        .eq('id', reviewId)

      if (error) throw error

      // If it was the user's review, reset the form
      if (userReview?.id === reviewId) {
        setUserReview(null)
        setNewRating(0)
        setNewReviewBody('')
      }

      await fetchReviews()
    } catch (error) {
      console.error('Error deleting review:', error)
    }
  }

  const handleEditReview = (review: Review) => {
    setEditingReview(review)
    setNewRating(review.rating)
    setNewReviewBody(review.body)
    document.getElementById('review-form')?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleReplyToReview = async (parentReviewId: string, replyText: string) => {
    if (!user || !race || !replyText.trim()) return

    setSubmittingReply(true)
    try {
      const replyData = {
        race_id: race.id,
        user_id: user.id,
        profile_id: user.id,
        parent_review_id: parentReviewId,
        rating: null, // Replies don't have ratings
        body: replyText.trim()
      }

      const { error } = await supabase
        .from('reviews')
        .insert([replyData])

      if (error) throw error

      // Refresh reviews
      await fetchReviews()
    } catch (error) {
      console.error('Error submitting reply:', error)
    } finally {
      setSubmittingReply(false)
    }
  }

  // Organize reviews into nested structure
  const organizeReviews = (allReviews: (Review & { profiles?: { email: string; username: string } })[]) => {
    const reviewMap = new Map()
    const topLevelReviews: (Review & { profiles?: { email: string; username: string }; replies?: any[] })[] = []

    // First pass: create a map of all reviews
    allReviews.forEach(review => {
      reviewMap.set(review.id, { ...review, replies: [] })
    })

    // Second pass: organize into hierarchy
    allReviews.forEach(review => {
      if (review.parent_review_id) {
        // This is a reply
        const parent = reviewMap.get(review.parent_review_id)
        if (parent) {
          parent.replies.push(reviewMap.get(review.id))
        }
      } else {
        // This is a top-level review
        topLevelReviews.push(reviewMap.get(review.id))
      }
    })

    // Third pass: sort replies by creation date
    const sortReplies = (reviews: any[]) => {
      reviews.forEach(review => {
        if (review.replies && review.replies.length > 0) {
          review.replies.sort((a: any, b: any) => 
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          )
          sortReplies(review.replies)
        }
      })
    }
    sortReplies(topLevelReviews)

    return topLevelReviews
  }

  const calculateAverageRating = () => {
    if (reviews.length === 0) return 0
    const ratedReviews = reviews.filter(review => review.rating && review.rating > 0)
    if (ratedReviews.length === 0) return 0
    const sum = ratedReviews.reduce((acc, review) => acc + (review.rating || 0), 0)
    return sum / ratedReviews.length
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
      </div>
    )
  }

  if (!race) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Race not found</h2>
          <button
            onClick={() => navigate('/dashboard')}
            className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  const averageRating = calculateAverageRating()
  const raceDate = race ? new Date(race.date) : null
  const now = new Date()
  const hasHappened = raceDate ? raceDate <= now : false

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center text-gray-300 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back to Dashboard
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {loading ? (
          <div className="flex items-center justify-center min-h-[300px]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
          </div>
        ) : race ? (
          <>
            <div className="mb-8">
              <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-white flex items-center mb-4">
                <ArrowLeft className="w-5 h-5 mr-2" /> Back
              </button>
              <h1 className="text-3xl font-bold text-white mb-2">{race.grand_prix_name}</h1>
              <div className="flex items-center text-gray-400 mb-4">
                <MapPin className="w-4 h-4 mr-2" />
                <span>{race.circuit_name}</span>
                <Calendar className="w-4 h-4 ml-6 mr-2" />
                <span>{new Date(race.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
              </div>
              {/* Thumbnail Section */}
              <div className="mb-6">
                {!hasHappened ? (
                  <div className="w-full h-64 bg-gray-800 flex flex-col items-center justify-center rounded-xl">
                    <img
                      src="https://upload.wikimedia.org/wikipedia/commons/thumb/3/33/F1.svg/512px-F1.svg.png"
                      alt="F1 Placeholder"
                      className="w-20 h-20 mb-2 opacity-70"
                    />
                    <span className="text-gray-300">Race has not happened yet</span>
                  </div>
                ) : thumbnailLoading ? (
                  <div className="w-full h-64 bg-gray-800 flex items-center justify-center rounded-xl">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600"></div>
                  </div>
                ) : (
                  <img
                    src={thumbnailUrl}
                    alt={race.grand_prix_name}
                    className="w-full h-64 object-cover rounded-xl"
                    onError={(e) => {
                      console.warn(`Failed to load thumbnail for ${race.grand_prix_name}, using fallback`)
                      e.currentTarget.src = getCircuitFallbackThumbnail(race.circuit_name)
                    }}
                  />
                )}
              </div>
              {/* Race Info */}
              <div className="bg-gray-900 rounded-xl p-6 mb-8">
                <h1 className="text-3xl font-bold text-white mb-4" style={{ fontFamily: 'Oswald' }}>
                  {race.grand_prix_name}
                </h1>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-gray-300 mb-6">
                  <div className="flex items-center">
                    <MapPin className="w-5 h-5 text-red-500 mr-2" />
                    <span>{race.circuit_name}</span>
                  </div>
                  <div className="flex items-center">
                    <Calendar className="w-5 h-5 text-red-500 mr-2" />
                    <span>{formatDate(race.date)}</span>
                  </div>
                  {race.winner && race.winner !== 'TBD' && (
                    <div className="flex items-center">
                      <Trophy className="w-5 h-5 text-yellow-400 mr-2" />
                      <span>{race.winner}</span>
                    </div>
                  )}
                </div>

                {/* Podium */}
                {race.podium && race.podium.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-white mb-3 flex items-center">
                      <Users className="w-5 h-5 text-red-500 mr-2" />
                      Podium
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {race.podium.slice(0, 3).map((driver, index) => (
                        <div key={index} className="bg-gray-800 rounded-lg p-3 text-center">
                          <div className="text-2xl mb-1">
                            {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                          </div>
                          <div className="text-white font-medium">{driver}</div>
                          <div className="text-gray-400 text-sm">P{index + 1}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* YouTube Video */}
                {race.youtube_video_id && (
                  <div className="aspect-video mb-6">
                    <iframe
                      src={`https://www.youtube.com/embed/${race.youtube_video_id}`}
                      title={race.grand_prix_name}
                      className="w-full h-full rounded-lg"
                      allowFullScreen
                    />
                  </div>
                )}

                {/* Notable Moments */}
                {race.notable_moments && (
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-white mb-3">Notable Moments</h3>
                    <div className="bg-gray-800 rounded-lg p-4">
                      <p className="text-gray-300">{race.notable_moments}</p>
                    </div>
                  </div>
                )}

                {/* Race Stats */}
                <div className="flex items-center space-x-6 p-4 bg-gray-800 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                    <span className="text-white font-semibold">
                      {averageRating > 0 ? averageRating.toFixed(1) : 'No ratings'}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <MessageCircle className="w-5 h-5 text-gray-400" />
                    <span className="text-gray-300">{reviews.length} reviews</span>
                  </div>
                </div>
              </div>

              {/* Review Form */}
              <div id="review-form" className="bg-gray-900 rounded-xl p-6 mb-8">
                <h2 className="text-xl font-bold text-white mb-4">
                  {userReview && !editingReview ? 'Your Review' : editingReview ? 'Edit Review' : 'Rate & Review'}
                </h2>
                
                <form onSubmit={handleSubmitReview} className="space-y-4">
                  <div>
                    <label className="block text-gray-300 mb-2">Rating</label>
                    <StarRating
                      rating={newRating}
                      onRatingChange={setNewRating}
                      size="lg"
                    />
                  </div>

                  <div>
                    <label className="block text-gray-300 mb-2">Review (optional)</label>
                    <textarea
                      value={newReviewBody}
                      onChange={(e) => setNewReviewBody(e.target.value)}
                      placeholder="Share your thoughts about this race..."
                      rows={4}
                      className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:border-red-600 focus:ring-1 focus:ring-red-600 transition-colors resize-none"
                    />
                  </div>

                  <div className="flex items-center space-x-3">
                    <button
                      type="submit"
                      disabled={submitting || newRating === 0}
                      className="bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg transition-colors flex items-center"
                    >
                      {submitting ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      ) : (
                        <Send className="w-4 h-4 mr-2" />
                      )}
                      {editingReview ? 'Update Review' : userReview ? 'Update Review' : 'Submit Review'}
                    </button>
                    
                    {editingReview && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingReview(null)
                          if (userReview) {
                            setNewRating(userReview.rating)
                            setNewReviewBody(userReview.body)
                          } else {
                            setNewRating(0)
                            setNewReviewBody('')
                          }
                        }}
                        className="text-gray-400 hover:text-white transition-colors"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </form>
              </div>

              {/* Reviews List */}
              <div>
                <h2 className="text-xl font-bold text-white mb-6">
                  All Reviews ({reviews.length})
                </h2>
                
                {reviews.length > 0 ? (
                  <div className="space-y-4">
                    {organizeReviews(reviews).map(review => (
                      <NestedReviewCard
                        key={review.id}
                        review={review}
                        currentUserId={user?.id}
                        onDelete={handleDeleteReview}
                        onEdit={handleEditReview}
                        onReply={handleReplyToReview}
                        replies={review.replies || []}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-400">
                    No reviews yet. Be the first to review this race!
                  </div>
                )}
              </div>
            </div>
            {/* Sidebar */}
            <div className="lg:col-span-1">
              <div className="bg-gray-900 rounded-xl p-6 sticky top-8">
                <h3 className="text-lg font-bold text-white mb-4">Race Details</h3>
                
                <div className="space-y-3 text-sm">
                  <div>
                    <span className="text-gray-400">Circuit:</span>
                    <span className="text-white ml-2">{race.circuit_name}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Date:</span>
                    <span className="text-white ml-2">{formatDate(race.date)}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Winner:</span>
                    <span className="text-white ml-2">{race.winner}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Average Rating:</span>
                    <div className="flex items-center mt-1">
                      <StarRating rating={averageRating} readonly size="sm" />
                      <span className="text-white ml-2">
                        {averageRating > 0 ? averageRating.toFixed(1) : 'N/A'}
                      </span>
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-400">Total Reviews:</span>
                    <span className="text-white ml-2">{reviews.length}</span>
                  </div>
                </div>

                {race.video_url && (
                  <div className="mt-6">
                    <a
                      href={race.video_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center w-full bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-lg transition-colors"
                    >
                      <Youtube className="w-4 h-4 mr-2" />
                      Watch on YouTube
                    </a>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="text-center text-gray-400">Race not found.</div>
        )}
      </main>
    </div>
  )
}