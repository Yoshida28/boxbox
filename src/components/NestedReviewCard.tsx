import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { StarRating } from './StarRating'
import { Review } from '../lib/supabase'
import { User, Trash2, Edit, Reply, ChevronDown, ChevronUp } from 'lucide-react'

interface NestedReviewCardProps {
  review: Review & { 
    profiles?: { email: string; username: string } 
  }
  currentUserId?: string
  onDelete?: (reviewId: string) => void
  onEdit?: (review: Review) => void
  onReply?: (parentReviewId: string, replyText: string) => void
  replies?: (Review & { profiles?: { email: string; username: string } })[]
  depth?: number
  maxDepth?: number
}

export function NestedReviewCard({ 
  review, 
  currentUserId, 
  onDelete, 
  onEdit, 
  onReply,
  replies = [],
  depth = 0,
  maxDepth = 10
}: NestedReviewCardProps) {
  const [showReplies, setShowReplies] = useState(depth < 2) // Auto-expand first 2 levels
  const [showReplyForm, setShowReplyForm] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [submittingReply, setSubmittingReply] = useState(false)

  const isOwner = currentUserId === review.user_id
  const userEmail = review.profiles?.email || 'Anonymous'
  const hasReplies = replies.length > 0
  const canReply = depth < maxDepth

  const formatDate = (dateString: string) => {
    return formatDistanceToNow(new Date(dateString), { addSuffix: true })
  }

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!replyText.trim()) return

    setSubmittingReply(true)
    try {
      // This will be handled by the parent component
      if (onReply) {
        onReply(review.id, replyText)
      }
      setShowReplyForm(false)
      setReplyText('')
    } catch (error) {
      console.error('Error submitting reply:', error)
    } finally {
      setSubmittingReply(false)
    }
  }

  return (
    <div className={`${depth > 0 ? 'ml-6 border-l-2 border-gray-700 pl-4' : ''}`}>
      <div className="bg-gray-900 rounded-lg p-4 mb-3">
        {/* Review Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center">
              <User className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="text-white font-medium text-sm">{userEmail}</div>
              <div className="text-gray-400 text-xs">
                {formatDate(review.created_at)}
                {review.is_edited && (
                  <span className="ml-2 text-gray-500">(edited)</span>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {canReply && (
              <button
                onClick={() => setShowReplyForm(!showReplyForm)}
                className="text-gray-400 hover:text-blue-400 transition-colors p-1"
                title="Reply"
              >
                <Reply className="w-4 h-4" />
              </button>
            )}
            {isOwner && (
              <>
                <button
                  onClick={() => onEdit?.(review)}
                  className="text-gray-400 hover:text-blue-400 transition-colors p-1"
                  title="Edit review"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onDelete?.(review.id)}
                  className="text-gray-400 hover:text-red-400 transition-colors p-1"
                  title="Delete review"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Rating - Only show for top-level reviews */}
        {review.rating && review.rating > 0 && review.depth === 0 && (
          <div className="mb-3">
            <StarRating rating={review.rating} readonly size="sm" />
          </div>
        )}

        {/* Review Body */}
        {review.body && (
          <div className="text-gray-300 text-sm mb-3 whitespace-pre-wrap">
            {review.body}
          </div>
        )}

        {/* Reply Form */}
        {showReplyForm && canReply && (
          <div className="mt-4 p-3 bg-gray-800 rounded-lg">
            <form onSubmit={handleReply} className="space-y-3">
              <div>
                <label className="block text-gray-300 text-sm mb-1">Reply</label>
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  className="w-full bg-gray-700 text-white rounded-lg p-2 text-sm resize-none"
                  rows={3}
                  placeholder="Write your reply..."
                />
              </div>
              <div className="flex space-x-2">
                <button
                  type="submit"
                  disabled={submittingReply || !replyText.trim()}
                  className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white px-3 py-1 rounded text-sm transition-colors"
                >
                  {submittingReply ? 'Posting...' : 'Post Reply'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowReplyForm(false)}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded text-sm transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Replies Toggle */}
        {hasReplies && (
          <div className="mt-3 pt-3 border-t border-gray-700">
            <button
              onClick={() => setShowReplies(!showReplies)}
              className="flex items-center text-gray-400 hover:text-white transition-colors text-sm"
            >
              {showReplies ? (
                <ChevronUp className="w-4 h-4 mr-1" />
              ) : (
                <ChevronDown className="w-4 h-4 mr-1" />
              )}
              {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
            </button>
          </div>
        )}
      </div>

      {/* Nested Replies */}
      {showReplies && hasReplies && (
        <div className="space-y-2">
          {replies.map((reply) => (
            <NestedReviewCard
              key={reply.id}
              review={reply}
              currentUserId={currentUserId}
              onDelete={onDelete}
              onEdit={onEdit}
              onReply={onReply}
              replies={reply.replies || []}
              depth={depth + 1}
              maxDepth={maxDepth}
            />
          ))}
        </div>
      )}
    </div>
  )
} 