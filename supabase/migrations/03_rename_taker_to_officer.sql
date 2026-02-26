-- Rename operator_role value from 'Taker' to 'Officer'
-- Run this in the Supabase SQL editor.

-- 1. Drop ALL check constraints on school_operator_roles (handles any constraint name)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.school_operator_roles'::regclass
      AND contype = 'c'
  LOOP
    EXECUTE 'ALTER TABLE public.school_operator_roles DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname);
  END LOOP;
END;
$$;

-- 2. Update existing rows
UPDATE public.school_operator_roles
  SET operator_role = 'Officer'
  WHERE operator_role = 'Taker';

-- 3. Re-add the CHECK constraint with the new value
ALTER TABLE public.school_operator_roles
  ADD CONSTRAINT school_operator_roles_operator_role_check
  CHECK (operator_role IN ('Admin', 'Officer'));

-- 4. Recreate the RLS helper function with the updated role name
CREATE OR REPLACE FUNCTION public.has_school_operator_role(p_user_id uuid, p_role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.school_operator_roles sor
    WHERE sor.user_id = p_user_id
      AND sor.is_active = true
      AND (
        (p_role = 'Officer' AND sor.operator_role IN ('Officer', 'Admin'))
        OR (p_role = 'Admin' AND sor.operator_role = 'Admin')
      )
  );
$$;

REVOKE ALL ON FUNCTION public.has_school_operator_role(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_school_operator_role(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_school_operator_role(uuid, text) TO anon;
