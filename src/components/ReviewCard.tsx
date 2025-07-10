import { formatDistanceToNow } from 'date-fns'
import { StarRating } from './StarRating'
import { Review } from '../lib/supabase'
import { User, Trash2, Edit } from 'lucide-react'

interface ReviewCardProps {
  review: Review & { 
    profiles?: { email: string; username: string } 
  }
  currentUserId?: string
  onDelete?: (reviewId: string) => void
  onEdit?: (review: Review) => void
}

export function ReviewCard({ review, currentUserId, onDelete, onEdit }: ReviewCardProps) {
  const isOwner = currentUserId === review.user_id
  const userEmail = review.profiles?.email || 'Anonymous'
  
  const formatDate = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true })
    } catch {
      return 'Recently'
    }
  }

  return (
    <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center">
            <User className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-white font-medium">{userEmail.split('@')[0]}</p>
            <p className="text-gray-400 text-sm">{formatDate(review.created_at)}</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          <StarRating rating={review.rating} readonly size="sm" />
          {isOwner && (
            <div className="flex items-center space-x-2">
              <button
                onClick={() => onEdit?.(review)}
                className="text-gray-400 hover:text-blue-400 transition-colors"
                title="Edit review"
              >
                <Edit className="w-4 h-4" />
              </button>
              <button
                onClick={() => onDelete?.(review.id)}
                className="text-gray-400 hover:text-red-400 transition-colors"
                title="Delete review"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
      
      {review.body && (
        <div className="text-gray-300 whitespace-pre-wrap">{review.body}</div>
      )}
    </div>
  )
}