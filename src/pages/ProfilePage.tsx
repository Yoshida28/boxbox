import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, User, LogOut, Edit, Trash2, Star } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { supabase, Review, Race } from '../lib/supabase'
import { StarRating } from '../components/StarRating'

interface UserReview extends Review {
  race: Race
}

export function ProfilePage() {
  const navigate = useNavigate()
  const { user, signOut } = useAuthStore()
  const [userReviews, setUserReviews] = useState<UserReview[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) {
      fetchUserReviews()
    }
  }, [user])

  const fetchUserReviews = async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('reviews')
        .select(`
          *,
          race:races (*)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setUserReviews(data || [])
    } catch (error) {
      console.error('Error fetching user reviews:', error)
    } finally {
      setLoading(false)
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
      
      setUserReviews(prev => prev.filter(review => review.id !== reviewId))
    } catch (error) {
      console.error('Error deleting review:', error)
    }
  }

  const handleEditReview = (review: UserReview) => {
    navigate(`/race/${review.race.id}`)
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/auth')
  }

  const calculateAverageRating = () => {
    if (userReviews.length === 0) return 0
    const sum = userReviews.reduce((acc, review) => acc + review.rating, 0)
    return sum / userReviews.length
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

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center text-gray-300 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Back to Dashboard
            </button>
            
            <button
              onClick={handleSignOut}
              className="flex items-center bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Profile Info */}
          <div className="lg:col-span-1">
            <div className="bg-gray-900 rounded-xl p-6 sticky top-8">
              <div className="text-center mb-6">
                <div className="w-20 h-20 bg-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  {user?.user_metadata?.avatar_url ? (
                    <img
                      src={user.user_metadata.avatar_url}
                      alt="Profile"
                      className="w-20 h-20 rounded-full object-cover"
                    />
                  ) : (
                    <User className="w-10 h-10 text-white" />
                  )}
                </div>
                <h1 className="text-2xl font-bold text-white mb-2">
                  {user?.user_metadata?.full_name || user?.email?.split('@')[0]}
                </h1>
                <p className="text-gray-400">{user?.email}</p>
              </div>

              <div className="space-y-4">
                <div className="text-center p-4 bg-gray-800 rounded-lg">
                  <div className="text-2xl font-bold text-white">
                    {userReviews.length}
                  </div>
                  <div className="text-gray-400 text-sm">Total Reviews</div>
                </div>

                {userReviews.length > 0 && (
                  <div className="text-center p-4 bg-gray-800 rounded-lg">
                    <div className="flex items-center justify-center mb-2">
                      <StarRating rating={calculateAverageRating()} readonly size="sm" />
                    </div>
                    <div className="text-lg font-semibold text-white">
                      {calculateAverageRating().toFixed(1)}
                    </div>
                    <div className="text-gray-400 text-sm">Average Rating</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Reviews List */}
          <div className="lg:col-span-2">
            <h2 className="text-2xl font-bold text-white mb-6">Your Reviews</h2>
            
            {userReviews.length > 0 ? (
              <div className="space-y-6">
                {userReviews.map(review => (
                  <div key={review.id} className="bg-gray-900 rounded-xl p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-xl font-bold text-white mb-2">
                          {review.race.grand_prix_name}
                        </h3>
                        <p className="text-gray-400">
                          {review.race.circuit_name} • {formatDate(review.race.date)}
                        </p>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleEditReview(review)}
                          className="text-gray-400 hover:text-blue-400 transition-colors p-2"
                          title="Edit review"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteReview(review.id)}
                          className="text-gray-400 hover:text-red-400 transition-colors p-2"
                          title="Delete review"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center space-x-4 mb-4">
                      <StarRating rating={review.rating} readonly size="sm" />
                      <span className="text-gray-400 text-sm">
                        {formatDate(review.created_at)}
                      </span>
                    </div>

                    {review.body && (
                      <div className="text-gray-300 whitespace-pre-wrap">
                        {review.body}
                      </div>
                    )}

                    <div className="mt-4 pt-4 border-t border-gray-800">
                      <button
                        onClick={() => navigate(`/race/${review.race.id}`)}
                        className="text-red-400 hover:text-red-300 transition-colors text-sm"
                      >
                        View Race →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="text-gray-400 text-lg mb-4">
                  You haven't reviewed any races yet
                </div>
                <button
                  onClick={() => navigate('/dashboard')}
                  className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg transition-colors"
                >
                  Browse Races
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}