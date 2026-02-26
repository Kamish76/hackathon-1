-- ============================================================================
-- SCHOOL NFC INGRESS / EGRESS INITIALIZATION (ADDITIVE)
-- ============================================================================
-- Purpose:
--   Initialize database objects needed for whole-school ingress/egress tracking
--   while keeping your CURRENT_DATABASE_STRUCTURE intact.
--
-- Scope (adds new module):
--   - person_registry
--   - school_operator_roles
--   - gates
--   - access_devices
--   - vehicle_registry
--   - vehicle_sessions
--   - access_events
--   - vehicle_passengers
--   - manifests / manifest_entries
--   - override_logs
--   - helper functions, triggers, views, indexes, and baseline RLS policies
--
-- Notes:
--   1) This script is idempotent where possible (IF NOT EXISTS / CREATE OR REPLACE).
--   2) It does NOT drop/replace your existing attendance tables.
--   3) Visitors/guests are modeled in person_registry (not forced into users table).
-- ============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- --------------------------------------------------------------------------
-- SHARED TRIGGER FUNCTION
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- --------------------------------------------------------------------------
-- CORE REFERENCE TABLES
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.person_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  linked_user_id uuid NULL REFERENCES public.users(id) ON DELETE SET NULL,
  person_type text NOT NULL CHECK (person_type IN ('Student', 'Staff', 'Visitor', 'Special Guest')),
  full_name text NOT NULL,
  email text NULL,
  external_identifier text NULL,
  nfc_tag_id text NULL,
  qr_code_data text NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NULL REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_person_registry_external_identifier UNIQUE (external_identifier),
  CONSTRAINT uq_person_registry_nfc_tag_id UNIQUE (nfc_tag_id),
  CONSTRAINT uq_person_registry_qr_code_data UNIQUE (qr_code_data)
);

CREATE INDEX IF NOT EXISTS idx_person_registry_person_type ON public.person_registry(person_type);
CREATE INDEX IF NOT EXISTS idx_person_registry_linked_user_id ON public.person_registry(linked_user_id);
CREATE INDEX IF NOT EXISTS idx_person_registry_is_active ON public.person_registry(is_active);

CREATE TABLE IF NOT EXISTS public.school_operator_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  operator_role text NOT NULL CHECK (operator_role IN ('Admin', 'Taker')),
  is_active boolean NOT NULL DEFAULT true,
  assigned_by uuid NULL REFERENCES public.users(id) ON DELETE SET NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_school_operator_user UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_school_operator_roles_role ON public.school_operator_roles(operator_role);
CREATE INDEX IF NOT EXISTS idx_school_operator_roles_active ON public.school_operator_roles(is_active);

CREATE TABLE IF NOT EXISTS public.gates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gate_code text NOT NULL UNIQUE,
  gate_name text NOT NULL,
  location_description text NULL,
  is_vehicle_lane boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gates_active ON public.gates(is_active);
CREATE INDEX IF NOT EXISTS idx_gates_vehicle_lane ON public.gates(is_vehicle_lane);

CREATE TABLE IF NOT EXISTS public.access_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gate_id uuid NOT NULL REFERENCES public.gates(id) ON DELETE CASCADE,
  device_name text NOT NULL,
  device_type text NOT NULL CHECK (device_type IN ('WEB_NFC', 'USB_READER', 'QR_SCANNER', 'MANUAL')),
  device_identifier text NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_access_devices_identifier UNIQUE (device_identifier)
);

CREATE INDEX IF NOT EXISTS idx_access_devices_gate_id ON public.access_devices(gate_id);
CREATE INDEX IF NOT EXISTS idx_access_devices_type ON public.access_devices(device_type);
CREATE INDEX IF NOT EXISTS idx_access_devices_active ON public.access_devices(is_active);

CREATE TABLE IF NOT EXISTS public.vehicle_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plate_number text NOT NULL UNIQUE,
  vehicle_type text NOT NULL CHECK (vehicle_type IN ('Car', 'Van', 'Bus', 'Motorcycle', 'Service', 'Unknown')),
  owner_type text NOT NULL CHECK (owner_type IN ('School', 'Staff', 'Visitor', 'Service', 'Unknown')),
  notes text NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vehicle_registry_owner_type ON public.vehicle_registry(owner_type);
CREATE INDEX IF NOT EXISTS idx_vehicle_registry_active ON public.vehicle_registry(is_active);

-- --------------------------------------------------------------------------
-- SESSIONS + EVENTS
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vehicle_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NULL REFERENCES public.vehicle_registry(id) ON DELETE SET NULL,
  gate_id uuid NOT NULL REFERENCES public.gates(id) ON DELETE RESTRICT,
  session_started_at timestamptz NOT NULL DEFAULT now(),
  session_closed_at timestamptz NULL,
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED', 'CANCELLED')),
  opened_by uuid NULL REFERENCES public.users(id) ON DELETE SET NULL,
  closed_by uuid NULL REFERENCES public.users(id) ON DELETE SET NULL,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_vehicle_session_closed_when_status_closed CHECK (
    (status <> 'CLOSED') OR (session_closed_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_vehicle_sessions_vehicle_id ON public.vehicle_sessions(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_sessions_gate_id ON public.vehicle_sessions(gate_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_sessions_status ON public.vehicle_sessions(status);
CREATE INDEX IF NOT EXISTS idx_vehicle_sessions_started_at ON public.vehicle_sessions(session_started_at DESC);

CREATE TABLE IF NOT EXISTS public.access_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES public.person_registry(id) ON DELETE RESTRICT,
  gate_id uuid NOT NULL REFERENCES public.gates(id) ON DELETE RESTRICT,
  reader_id uuid NULL REFERENCES public.access_devices(id) ON DELETE SET NULL,
  vehicle_session_id uuid NULL REFERENCES public.vehicle_sessions(id) ON DELETE SET NULL,
  direction text NOT NULL CHECK (direction IN ('IN', 'OUT')),
  entry_mode text NOT NULL DEFAULT 'WALK' CHECK (entry_mode IN ('WALK', 'VEHICLE')),
  verification_method text NOT NULL CHECK (verification_method IN ('NFC', 'QR', 'MANUAL_OVERRIDE', 'MANIFEST')),
  event_timestamp timestamptz NOT NULL DEFAULT now(),
  operator_user_id uuid NULL REFERENCES public.users(id) ON DELETE SET NULL,
  is_manual_override boolean NOT NULL DEFAULT false,
  override_reason text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_override_reason_required CHECK (
    (is_manual_override = false) OR (override_reason IS NOT NULL AND length(trim(override_reason)) > 0)
  )
);

CREATE INDEX IF NOT EXISTS idx_access_events_person_id ON public.access_events(person_id);
CREATE INDEX IF NOT EXISTS idx_access_events_gate_id ON public.access_events(gate_id);
CREATE INDEX IF NOT EXISTS idx_access_events_vehicle_session_id ON public.access_events(vehicle_session_id);
CREATE INDEX IF NOT EXISTS idx_access_events_event_timestamp ON public.access_events(event_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_access_events_direction_timestamp ON public.access_events(direction, event_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_access_events_person_timestamp ON public.access_events(person_id, event_timestamp DESC);

CREATE TABLE IF NOT EXISTS public.vehicle_passengers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_session_id uuid NOT NULL REFERENCES public.vehicle_sessions(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES public.person_registry(id) ON DELETE RESTRICT,
  boarded_direction text NOT NULL CHECK (boarded_direction IN ('IN', 'OUT')),
  verified_by_method text NOT NULL CHECK (verified_by_method IN ('NFC', 'QR', 'MANUAL_OVERRIDE', 'MANIFEST')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_vehicle_passenger_direction UNIQUE (vehicle_session_id, person_id, boarded_direction)
);

CREATE INDEX IF NOT EXISTS idx_vehicle_passengers_session_id ON public.vehicle_passengers(vehicle_session_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_passengers_person_id ON public.vehicle_passengers(person_id);

CREATE TABLE IF NOT EXISTS public.manifests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manifest_name text NOT NULL,
  vehicle_id uuid NULL REFERENCES public.vehicle_registry(id) ON DELETE SET NULL,
  scheduled_date date NOT NULL,
  direction text NOT NULL CHECK (direction IN ('IN', 'OUT', 'BOTH')),
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'ACTIVE', 'CLOSED', 'CANCELLED')),
  created_by uuid NULL REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_manifests_scheduled_date ON public.manifests(scheduled_date DESC);
CREATE INDEX IF NOT EXISTS idx_manifests_status ON public.manifests(status);

CREATE TABLE IF NOT EXISTS public.manifest_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manifest_id uuid NOT NULL REFERENCES public.manifests(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES public.person_registry(id) ON DELETE RESTRICT,
  expected_stop text NULL,
  is_required boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_manifest_person UNIQUE (manifest_id, person_id)
);

CREATE INDEX IF NOT EXISTS idx_manifest_entries_manifest_id ON public.manifest_entries(manifest_id);
CREATE INDEX IF NOT EXISTS idx_manifest_entries_person_id ON public.manifest_entries(person_id);

CREATE TABLE IF NOT EXISTS public.override_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  access_event_id uuid NOT NULL REFERENCES public.access_events(id) ON DELETE CASCADE,
  operator_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  reason text NOT NULL,
  approved_by uuid NULL REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_override_logs_access_event_id ON public.override_logs(access_event_id);
CREATE INDEX IF NOT EXISTS idx_override_logs_operator_user_id ON public.override_logs(operator_user_id);

-- --------------------------------------------------------------------------
-- BUSINESS RULE FUNCTIONS
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_school_operator_role(p_user_id uuid, p_role text)
RETURNS boolean
LANGUAGE sql
STABLE
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

CREATE OR REPLACE FUNCTION public.prevent_duplicate_direction()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_last_direction text;
BEGIN
  IF NEW.is_manual_override THEN
    RETURN NEW;
  END IF;

  SELECT ae.direction
    INTO v_last_direction
  FROM public.access_events ae
  WHERE ae.person_id = NEW.person_id
  ORDER BY ae.event_timestamp DESC
  LIMIT 1;

  IF v_last_direction IS NOT NULL AND v_last_direction = NEW.direction THEN
    RAISE EXCEPTION 'Anti-passback violation: last direction was %, new direction cannot also be %', v_last_direction, NEW.direction;
  END IF;

  RETURN NEW;
END;
$$;

-- --------------------------------------------------------------------------
-- TRIGGERS
-- --------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_person_registry_updated_at ON public.person_registry;
CREATE TRIGGER trg_person_registry_updated_at
BEFORE UPDATE ON public.person_registry
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_school_operator_roles_updated_at ON public.school_operator_roles;
CREATE TRIGGER trg_school_operator_roles_updated_at
BEFORE UPDATE ON public.school_operator_roles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_gates_updated_at ON public.gates;
CREATE TRIGGER trg_gates_updated_at
BEFORE UPDATE ON public.gates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_access_devices_updated_at ON public.access_devices;
CREATE TRIGGER trg_access_devices_updated_at
BEFORE UPDATE ON public.access_devices
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_vehicle_registry_updated_at ON public.vehicle_registry;
CREATE TRIGGER trg_vehicle_registry_updated_at
BEFORE UPDATE ON public.vehicle_registry
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_vehicle_sessions_updated_at ON public.vehicle_sessions;
CREATE TRIGGER trg_vehicle_sessions_updated_at
BEFORE UPDATE ON public.vehicle_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_access_events_updated_at ON public.access_events;
CREATE TRIGGER trg_access_events_updated_at
BEFORE UPDATE ON public.access_events
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_manifests_updated_at ON public.manifests;
CREATE TRIGGER trg_manifests_updated_at
BEFORE UPDATE ON public.manifests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_prevent_duplicate_direction ON public.access_events;
CREATE TRIGGER trg_prevent_duplicate_direction
BEFORE INSERT ON public.access_events
FOR EACH ROW
EXECUTE FUNCTION public.prevent_duplicate_direction();

-- --------------------------------------------------------------------------
-- VIEWS
-- --------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.current_population_inside AS
WITH latest_events AS (
  SELECT DISTINCT ON (ae.person_id)
    ae.person_id,
    ae.direction,
    ae.event_timestamp,
    ae.gate_id
  FROM public.access_events ae
  ORDER BY ae.person_id, ae.event_timestamp DESC
)
SELECT
  pr.id AS person_id,
  pr.full_name,
  pr.person_type,
  le.event_timestamp AS last_seen_at,
  g.gate_name AS last_gate_name
FROM latest_events le
JOIN public.person_registry pr ON pr.id = le.person_id
LEFT JOIN public.gates g ON g.id = le.gate_id
WHERE le.direction = 'IN';

CREATE OR REPLACE VIEW public.vehicle_session_summary AS
SELECT
  vs.id AS vehicle_session_id,
  vs.status,
  vs.session_started_at,
  vs.session_closed_at,
  vr.plate_number,
  g.gate_name,
  COUNT(vp.id) AS passenger_count
FROM public.vehicle_sessions vs
LEFT JOIN public.vehicle_registry vr ON vr.id = vs.vehicle_id
LEFT JOIN public.gates g ON g.id = vs.gate_id
LEFT JOIN public.vehicle_passengers vp ON vp.vehicle_session_id = vs.id
GROUP BY vs.id, vs.status, vs.session_started_at, vs.session_closed_at, vr.plate_number, g.gate_name;

-- --------------------------------------------------------------------------
-- BASELINE RLS
-- --------------------------------------------------------------------------
ALTER TABLE public.person_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_operator_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_passengers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manifests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manifest_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.override_logs ENABLE ROW LEVEL SECURITY;

-- person_registry
DROP POLICY IF EXISTS person_registry_select_operator ON public.person_registry;
CREATE POLICY person_registry_select_operator
ON public.person_registry
FOR SELECT
USING (public.has_school_operator_role(auth.uid(), 'Taker'));

DROP POLICY IF EXISTS person_registry_insert_operator ON public.person_registry;
CREATE POLICY person_registry_insert_operator
ON public.person_registry
FOR INSERT
WITH CHECK (public.has_school_operator_role(auth.uid(), 'Taker'));

DROP POLICY IF EXISTS person_registry_update_operator ON public.person_registry;
CREATE POLICY person_registry_update_operator
ON public.person_registry
FOR UPDATE
USING (public.has_school_operator_role(auth.uid(), 'Taker'))
WITH CHECK (public.has_school_operator_role(auth.uid(), 'Taker'));

-- school_operator_roles (admin only)
DROP POLICY IF EXISTS school_operator_roles_admin_all ON public.school_operator_roles;
CREATE POLICY school_operator_roles_admin_all
ON public.school_operator_roles
FOR ALL
USING (public.has_school_operator_role(auth.uid(), 'Admin'))
WITH CHECK (public.has_school_operator_role(auth.uid(), 'Admin'));

-- gates + devices + vehicles + manifests (taker can read, admin can mutate)
DROP POLICY IF EXISTS gates_select_taker ON public.gates;
CREATE POLICY gates_select_taker
ON public.gates
FOR SELECT
USING (public.has_school_operator_role(auth.uid(), 'Taker'));

DROP POLICY IF EXISTS gates_admin_mutation ON public.gates;
CREATE POLICY gates_admin_mutation
ON public.gates
FOR ALL
USING (public.has_school_operator_role(auth.uid(), 'Admin'))
WITH CHECK (public.has_school_operator_role(auth.uid(), 'Admin'));

DROP POLICY IF EXISTS access_devices_select_taker ON public.access_devices;
CREATE POLICY access_devices_select_taker
ON public.access_devices
FOR SELECT
USING (public.has_school_operator_role(auth.uid(), 'Taker'));

DROP POLICY IF EXISTS access_devices_admin_mutation ON public.access_devices;
CREATE POLICY access_devices_admin_mutation
ON public.access_devices
FOR ALL
USING (public.has_school_operator_role(auth.uid(), 'Admin'))
WITH CHECK (public.has_school_operator_role(auth.uid(), 'Admin'));

DROP POLICY IF EXISTS vehicle_registry_select_taker ON public.vehicle_registry;
CREATE POLICY vehicle_registry_select_taker
ON public.vehicle_registry
FOR SELECT
USING (public.has_school_operator_role(auth.uid(), 'Taker'));

DROP POLICY IF EXISTS vehicle_registry_admin_mutation ON public.vehicle_registry;
CREATE POLICY vehicle_registry_admin_mutation
ON public.vehicle_registry
FOR ALL
USING (public.has_school_operator_role(auth.uid(), 'Admin'))
WITH CHECK (public.has_school_operator_role(auth.uid(), 'Admin'));

DROP POLICY IF EXISTS manifests_select_taker ON public.manifests;
CREATE POLICY manifests_select_taker
ON public.manifests
FOR SELECT
USING (public.has_school_operator_role(auth.uid(), 'Taker'));

DROP POLICY IF EXISTS manifests_admin_mutation ON public.manifests;
CREATE POLICY manifests_admin_mutation
ON public.manifests
FOR ALL
USING (public.has_school_operator_role(auth.uid(), 'Admin'))
WITH CHECK (public.has_school_operator_role(auth.uid(), 'Admin'));

DROP POLICY IF EXISTS manifest_entries_select_taker ON public.manifest_entries;
CREATE POLICY manifest_entries_select_taker
ON public.manifest_entries
FOR SELECT
USING (public.has_school_operator_role(auth.uid(), 'Taker'));

DROP POLICY IF EXISTS manifest_entries_admin_mutation ON public.manifest_entries;
CREATE POLICY manifest_entries_admin_mutation
ON public.manifest_entries
FOR ALL
USING (public.has_school_operator_role(auth.uid(), 'Admin'))
WITH CHECK (public.has_school_operator_role(auth.uid(), 'Admin'));

-- access events + vehicle sessions + passengers + overrides
DROP POLICY IF EXISTS access_events_select_taker ON public.access_events;
CREATE POLICY access_events_select_taker
ON public.access_events
FOR SELECT
USING (public.has_school_operator_role(auth.uid(), 'Taker'));

DROP POLICY IF EXISTS access_events_insert_taker ON public.access_events;
CREATE POLICY access_events_insert_taker
ON public.access_events
FOR INSERT
WITH CHECK (public.has_school_operator_role(auth.uid(), 'Taker'));

DROP POLICY IF EXISTS access_events_update_admin ON public.access_events;
CREATE POLICY access_events_update_admin
ON public.access_events
FOR UPDATE
USING (public.has_school_operator_role(auth.uid(), 'Admin'))
WITH CHECK (public.has_school_operator_role(auth.uid(), 'Admin'));

DROP POLICY IF EXISTS vehicle_sessions_select_taker ON public.vehicle_sessions;
CREATE POLICY vehicle_sessions_select_taker
ON public.vehicle_sessions
FOR SELECT
USING (public.has_school_operator_role(auth.uid(), 'Taker'));

DROP POLICY IF EXISTS vehicle_sessions_insert_taker ON public.vehicle_sessions;
CREATE POLICY vehicle_sessions_insert_taker
ON public.vehicle_sessions
FOR INSERT
WITH CHECK (public.has_school_operator_role(auth.uid(), 'Taker'));

DROP POLICY IF EXISTS vehicle_sessions_update_taker ON public.vehicle_sessions;
CREATE POLICY vehicle_sessions_update_taker
ON public.vehicle_sessions
FOR UPDATE
USING (public.has_school_operator_role(auth.uid(), 'Taker'))
WITH CHECK (public.has_school_operator_role(auth.uid(), 'Taker'));

DROP POLICY IF EXISTS vehicle_passengers_select_taker ON public.vehicle_passengers;
CREATE POLICY vehicle_passengers_select_taker
ON public.vehicle_passengers
FOR SELECT
USING (public.has_school_operator_role(auth.uid(), 'Taker'));

DROP POLICY IF EXISTS vehicle_passengers_insert_taker ON public.vehicle_passengers;
CREATE POLICY vehicle_passengers_insert_taker
ON public.vehicle_passengers
FOR INSERT
WITH CHECK (public.has_school_operator_role(auth.uid(), 'Taker'));

DROP POLICY IF EXISTS override_logs_select_taker ON public.override_logs;
CREATE POLICY override_logs_select_taker
ON public.override_logs
FOR SELECT
USING (public.has_school_operator_role(auth.uid(), 'Taker'));

DROP POLICY IF EXISTS override_logs_insert_taker ON public.override_logs;
CREATE POLICY override_logs_insert_taker
ON public.override_logs
FOR INSERT
WITH CHECK (public.has_school_operator_role(auth.uid(), 'Taker'));

-- --------------------------------------------------------------------------
-- OPTIONAL BOOTSTRAP SEEDS (safe defaults)
-- --------------------------------------------------------------------------
INSERT INTO public.gates (gate_code, gate_name, location_description, is_vehicle_lane)
VALUES
  ('GATE-01', 'Main Gate', 'Primary pedestrian gate', false),
  ('GATE-02', 'Vehicle Gate', 'Primary vehicle entry/exit lane', true)
ON CONFLICT (gate_code) DO NOTHING;

COMMIT;

-- ============================================================================
-- OPTIONAL COMPATIBILITY NOTE
-- ============================================================================
-- If you decide to store school-wide person types directly in public.users.user_type,
-- you must update the existing users_user_type_check constraint accordingly.
-- Current schema allows only: ('Student', 'Faculty').
-- Recommended: keep visitors/guests in person_registry and keep users for authenticated accounts.
-- ============================================================================
