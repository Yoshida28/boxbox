/*
  # Fix rating constraint to allow null ratings for replies

  1. Problem
    - Current constraint requires rating >= 1 AND rating <= 5
    - Replies should not have ratings (rating = 0 or NULL)
    - This violates the check constraint

  2. Solution
    - Update the constraint to allow NULL ratings
    - Keep the 1-5 range for non-null ratings
    - This allows replies to have NULL ratings while top-level reviews have 1-5
*/

-- Drop the existing constraint
ALTER TABLE public.reviews DROP CONSTRAINT IF EXISTS reviews_rating_check;

-- Add new constraint that allows NULL ratings
ALTER TABLE public.reviews ADD CONSTRAINT reviews_rating_check 
CHECK (
  (rating IS NULL) OR 
  (rating >= 1 AND rating <= 5)
);

-- Update existing replies to have NULL ratings instead of 0
UPDATE public.reviews 
SET rating = NULL 
WHERE parent_review_id IS NOT NULL AND rating = 0; 