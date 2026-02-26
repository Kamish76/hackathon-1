-- Update auth_users RLS policies to allow authenticated users to read
-- Run this in your Supabase SQL Editor

-- Drop old policies
DROP POLICY IF EXISTS "Users can read their own auth record" ON public.auth_users;
DROP POLICY IF EXISTS "Authenticated users can read auth_users" ON public.auth_users;
DROP POLICY IF EXISTS "Admins can read all auth records" ON public.auth_users;

-- Create new policy allowing all authenticated users to read
CREATE POLICY "Authenticated users can read auth_users" 
  ON public.auth_users 
  FOR SELECT 
  TO authenticated
  USING (true);
