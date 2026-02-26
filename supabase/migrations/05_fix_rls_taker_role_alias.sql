-- Fix: allow 'Officer' role (renamed from 'Taker') to access access_events
-- Updates has_school_operator_role helper so both 'Officer' and 'Taker' are accepted,
-- and adds RLS policies for officers to INSERT and SELECT access_events.

-- 1. Restore the correct helper function (migration 05 previously broke this
--    by mapping 'Officer' -> 'Taker', but migration 03 already renamed all rows to 'Officer')
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
        (p_role = 'Officer' AND sor.operator_role IN ('Officer', 'Taker', 'Admin'))
        OR (p_role = 'Taker'   AND sor.operator_role IN ('Officer', 'Taker', 'Admin'))
        OR (p_role = 'Admin'   AND sor.operator_role = 'Admin')
      )
  );
$$;

REVOKE ALL ON FUNCTION public.has_school_operator_role(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_school_operator_role(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_school_operator_role(uuid, text) TO anon;

-- 2. Allow officers to SELECT person_registry (needed for scan lookup)
DROP POLICY IF EXISTS "Officers can select person_registry" ON person_registry;
CREATE POLICY "Officers can select person_registry"
  ON person_registry
  FOR SELECT
  TO authenticated
  USING (
    has_school_operator_role(auth.uid(), 'Officer')
    OR has_school_operator_role(auth.uid(), 'Admin')
  );

-- 3. Allow officers to SELECT gates (needed to cache gate_id on mount)
DROP POLICY IF EXISTS "Officers can select gates" ON gates;
CREATE POLICY "Officers can select gates"
  ON gates
  FOR SELECT
  TO authenticated
  USING (
    has_school_operator_role(auth.uid(), 'Officer')
    OR has_school_operator_role(auth.uid(), 'Admin')
  );

-- 5. Allow officers to INSERT access_events
DROP POLICY IF EXISTS "Officers can insert access_events" ON access_events;
CREATE POLICY "Officers can insert access_events"
  ON access_events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    has_school_operator_role(auth.uid(), 'Officer')
    OR has_school_operator_role(auth.uid(), 'Admin')
  );

-- 6. Allow officers to SELECT access_events
DROP POLICY IF EXISTS "Officers can select access_events" ON access_events;
CREATE POLICY "Officers can select access_events"
  ON access_events
  FOR SELECT
  TO authenticated
  USING (
    has_school_operator_role(auth.uid(), 'Officer')
    OR has_school_operator_role(auth.uid(), 'Admin')
  );
