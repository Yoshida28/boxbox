/*
  # Update races table RLS policy for imports

  1. Security Changes
    - Drop the existing restrictive INSERT policy for races
    - Create a new policy that allows authenticated users to insert races
    - This enables the F1 season import functionality for all authenticated users
    
  2. Rationale
    - The current policy only allows admin users to insert races
    - The dashboard import feature should be available to authenticated users
    - This maintains security while enabling the core functionality
*/

-- Drop the existing restrictive INSERT policy
DROP POLICY IF EXISTS "Enable insert for admin users" ON races;

-- Create a new policy that allows authenticated users to insert races
CREATE POLICY "Enable insert for authenticated users"
  ON races
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Keep the admin-only policies for UPDATE and DELETE to maintain data integrity
-- (These policies remain unchanged)