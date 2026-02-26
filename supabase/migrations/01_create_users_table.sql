-- Create auth_users bridge table to link Supabase auth with person_registry
DROP TABLE IF EXISTS public.auth_users CASCADE;

CREATE TABLE public.auth_users (
  id UUID PRIMARY KEY,
  person_id UUID REFERENCES person_registry(id) ON DELETE CASCADE UNIQUE,
  email TEXT NOT NULL UNIQUE,
  role_id UUID REFERENCES school_operator_roles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add foreign key constraint to auth.users separately
ALTER TABLE public.auth_users
  ADD CONSTRAINT auth_users_id_fkey 
  FOREIGN KEY (id) 
  REFERENCES auth.users(id) 
  ON DELETE CASCADE;

-- Enable RLS on auth_users table
ALTER TABLE public.auth_users ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can read their own auth record" ON public.auth_users;
DROP POLICY IF EXISTS "Users can update their own auth record" ON public.auth_users;
DROP POLICY IF EXISTS "Admins can read all auth records" ON public.auth_users;

-- Allow users to read their own auth record
CREATE POLICY "Users can read their own auth record" 
  ON public.auth_users 
  FOR SELECT 
  USING (auth.uid() = id);

-- Allow users to update their own auth record
CREATE POLICY "Users can update their own auth record" 
  ON public.auth_users 
  FOR UPDATE 
  USING (auth.uid() = id);

-- No INSERT policy needed - we'll use a trigger with SECURITY DEFINER

-- Allow admins to read all auth records
CREATE POLICY "Admins can read all auth records" 
  ON public.auth_users 
  FOR SELECT 
  USING (
    auth.uid() IN (
      SELECT id FROM public.auth_users WHERE role_id IS NOT NULL
    )
  );

-- Function to create person_registry record (bypasses RLS with SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.create_person_registry_record(
  user_full_name TEXT,
  user_email TEXT,
  user_person_type TEXT
)
RETURNS UUID
SECURITY DEFINER  -- This allows the function to bypass RLS
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  new_person_id UUID;
BEGIN
  -- Insert into person_registry
  INSERT INTO public.person_registry (full_name, email, person_type, is_active)
  VALUES (user_full_name, user_email, user_person_type, true)
  RETURNING id INTO new_person_id;
  
  RETURN new_person_id;
END;
$$;

-- Grant execute permission to authenticated and anon users
GRANT EXECUTE ON FUNCTION public.create_person_registry_record(TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_person_registry_record(TEXT, TEXT, TEXT) TO anon;

-- Function to create auth_users record (bypasses RLS with SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.create_auth_users_record(
  user_id UUID,
  person_uuid UUID,
  user_email TEXT,
  user_role_id UUID
)
RETURNS void
SECURITY DEFINER  -- This allows the function to bypass RLS
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  user_exists BOOLEAN;
BEGIN
  -- Check if user exists in auth.users
  SELECT EXISTS (
    SELECT 1 FROM auth.users WHERE id = user_id
  ) INTO user_exists;
  
  IF NOT user_exists THEN
    RAISE EXCEPTION 'User % does not exist in auth.users table. Email confirmation might be required.', user_id;
  END IF;
  
  -- Insert into auth_users
  INSERT INTO public.auth_users (id, person_id, email, role_id)
  VALUES (user_id, person_uuid, user_email, user_role_id);
END;
$$;

-- Grant execute permission to authenticated and anon users
GRANT EXECUTE ON FUNCTION public.create_auth_users_record(UUID, UUID, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_auth_users_record(UUID, UUID, TEXT, UUID) TO anon;

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_auth_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop trigger if it exists and create it
DROP TRIGGER IF EXISTS update_auth_users_updated_at ON public.auth_users;
CREATE TRIGGER update_auth_users_updated_at BEFORE UPDATE ON public.auth_users
  FOR EACH ROW EXECUTE FUNCTION public.update_auth_users_updated_at();
