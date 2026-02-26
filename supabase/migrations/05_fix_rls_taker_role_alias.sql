-- Fix: has_school_operator_role called with p_role='Taker' by existing RLS policies
-- returns false for everyone because neither 'Officer' nor 'Admin' branch matches.
-- Add 'Taker' as an alias for 'Officer' in p_role so old policies still work.

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
        -- Admin check
        (p_role = 'Admin' AND sor.operator_role = 'Admin')
        -- Officer check: matches both old 'Taker' rows and new 'Officer' rows
        -- Also handles old RLS policies that still pass p_role='Taker'
        OR (p_role IN ('Officer', 'Taker') AND sor.operator_role IN ('Officer', 'Taker', 'Admin'))
      )
  );
$$;

REVOKE ALL ON FUNCTION public.has_school_operator_role(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_school_operator_role(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_school_operator_role(uuid, text) TO anon;
