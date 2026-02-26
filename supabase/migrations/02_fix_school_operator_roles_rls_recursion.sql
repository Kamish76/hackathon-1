-- Fix RLS recursion on school_operator_roles checks.
-- Symptom: "stack depth limit exceeded" when querying school_operator_roles
-- through policies that call has_school_operator_role().

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
        (p_role = 'Taker' AND sor.operator_role IN ('Taker', 'Admin'))
        OR (p_role = 'Admin' AND sor.operator_role = 'Admin')
      )
  );
$$;

REVOKE ALL ON FUNCTION public.has_school_operator_role(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_school_operator_role(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_school_operator_role(uuid, text) TO anon;
