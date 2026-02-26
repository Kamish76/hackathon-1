-- ============================================================
-- Migration 07: Emergency Mode — Real-Time Roll Call
-- ============================================================

-- 1. emergency_sessions
--    Tracks each declared emergency event.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.emergency_sessions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  triggered_by    uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  triggered_at    timestamptz NOT NULL DEFAULT now(),
  resolved_at     timestamptz NULL,
  is_active       boolean NOT NULL DEFAULT true,
  notes           text NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Enforce: only one active session at a time
CREATE UNIQUE INDEX IF NOT EXISTS emergency_sessions_single_active
  ON public.emergency_sessions (is_active)
  WHERE (is_active = true);

-- ============================================================
-- 2. emergency_roll_call
--    Per-person status within a session.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.emergency_roll_call (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      uuid NOT NULL REFERENCES public.emergency_sessions(id) ON DELETE CASCADE,
  person_id       uuid NOT NULL REFERENCES public.person_registry(id) ON DELETE CASCADE,
  status          text NOT NULL DEFAULT 'UNKNOWN'
                    CHECK (status IN ('UNKNOWN', 'ACCOUNTED', 'MISSING')),
  last_seen_gate_id   uuid NULL REFERENCES public.gates(id) ON DELETE SET NULL,
  last_updated_by     uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  last_updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, person_id)
);

CREATE INDEX IF NOT EXISTS idx_emergency_roll_call_session
  ON public.emergency_roll_call (session_id);

CREATE INDEX IF NOT EXISTS idx_emergency_roll_call_person
  ON public.emergency_roll_call (person_id);

-- ============================================================
-- 3. RLS
-- ============================================================
ALTER TABLE public.emergency_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emergency_roll_call ENABLE ROW LEVEL SECURITY;

-- emergency_sessions: Admins and Officers can SELECT
CREATE POLICY "Officers and Admins can select emergency_sessions"
  ON public.emergency_sessions
  FOR SELECT
  TO authenticated
  USING (
    has_school_operator_role(auth.uid(), 'Admin') OR
    has_school_operator_role(auth.uid(), 'Officer')
  );

-- emergency_sessions: Admins and Officers can INSERT (trigger emergency)
CREATE POLICY "Officers and Admins can insert emergency_sessions"
  ON public.emergency_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    has_school_operator_role(auth.uid(), 'Admin') OR
    has_school_operator_role(auth.uid(), 'Officer')
  );

-- emergency_sessions: Only Admins can UPDATE (resolve / edit notes)
CREATE POLICY "Admins can update emergency_sessions"
  ON public.emergency_sessions
  FOR UPDATE
  TO authenticated
  USING (has_school_operator_role(auth.uid(), 'Admin'))
  WITH CHECK (has_school_operator_role(auth.uid(), 'Admin'));

-- emergency_roll_call: Admins can SELECT
CREATE POLICY "Admins can select emergency_roll_call"
  ON public.emergency_roll_call
  FOR SELECT
  TO authenticated
  USING (has_school_operator_role(auth.uid(), 'Admin'));

-- emergency_roll_call: Admins can INSERT (populate roll call on declare)
CREATE POLICY "Admins can insert emergency_roll_call"
  ON public.emergency_roll_call
  FOR INSERT
  TO authenticated
  WITH CHECK (has_school_operator_role(auth.uid(), 'Admin'));

-- emergency_roll_call: Admins can UPDATE (mark accounted/missing)
CREATE POLICY "Admins can update emergency_roll_call"
  ON public.emergency_roll_call
  FOR UPDATE
  TO authenticated
  USING (has_school_operator_role(auth.uid(), 'Admin'))
  WITH CHECK (has_school_operator_role(auth.uid(), 'Admin'));
