-- One-time patch: add additional profile columns used by member page edit flow
-- Run this in Supabase SQL Editor if saving profile details fails with missing-column errors.

BEGIN;

ALTER TABLE public.person_registry
  ADD COLUMN IF NOT EXISTS birth_date date,
  ADD COLUMN IF NOT EXISTS emergency_contact_name text,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone text,
  ADD COLUMN IF NOT EXISTS emergency_contacts text,
  ADD COLUMN IF NOT EXISTS remarks text;

-- Self-service RLS for authenticated users (keeps operator policies intact).
-- Users can manage only their own record, identified by linked_user_id
-- (and read fallback by matching email).
DROP POLICY IF EXISTS person_registry_select_self ON public.person_registry;
CREATE POLICY person_registry_select_self
ON public.person_registry
FOR SELECT
TO authenticated
USING (
  linked_user_id = auth.uid()
  OR lower(coalesce(email, '')) = lower(coalesce(auth.email(), ''))
);

DROP POLICY IF EXISTS person_registry_insert_self ON public.person_registry;
CREATE POLICY person_registry_insert_self
ON public.person_registry
FOR INSERT
TO authenticated
WITH CHECK (
  linked_user_id = auth.uid()
  OR lower(coalesce(email, '')) = lower(coalesce(auth.email(), ''))
);

DROP POLICY IF EXISTS person_registry_update_self ON public.person_registry;
CREATE POLICY person_registry_update_self
ON public.person_registry
FOR UPDATE
TO authenticated
USING (
  linked_user_id = auth.uid()
  OR lower(coalesce(email, '')) = lower(coalesce(auth.email(), ''))
)
WITH CHECK (
  linked_user_id = auth.uid()
  OR lower(coalesce(email, '')) = lower(coalesce(auth.email(), ''))
);

-- Ask PostgREST to refresh schema cache so new columns are immediately visible.
-- Safe to run in Supabase-hosted projects.
SELECT pg_notify('pgrst', 'reload schema');

COMMIT;
