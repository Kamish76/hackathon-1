BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY,
  email text,
  full_name text,
  tag_id text UNIQUE,
  nfc_tag_id text UNIQUE,
  qr_code_data text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF to_regclass('auth.users') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conrelid = 'public.users'::regclass
        AND conname = 'users_id_fkey_auth'
    ) THEN
      ALTER TABLE public.users
        ADD CONSTRAINT users_id_fkey_auth
        FOREIGN KEY (id)
        REFERENCES auth.users(id)
        ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

INSERT INTO public.users (id, email, full_name)
SELECT
  au.id,
  COALESCE(au.email, pr.email) AS email,
  pr.full_name
FROM public.auth_users au
LEFT JOIN public.person_registry pr ON pr.id = au.person_id
ON CONFLICT (id) DO UPDATE
SET
  email = COALESCE(EXCLUDED.email, public.users.email),
  full_name = COALESCE(EXCLUDED.full_name, public.users.full_name),
  updated_at = now();

UPDATE public.users u
SET
  nfc_tag_id = COALESCE(u.nfc_tag_id, pr.nfc_tag_id),
  qr_code_data = COALESCE(u.qr_code_data, pr.qr_code_data),
  tag_id = COALESCE(u.tag_id, pr.nfc_tag_id, pr.qr_code_data),
  updated_at = now()
FROM public.auth_users au
JOIN public.person_registry pr ON pr.id = au.person_id
WHERE au.id = u.id;

CREATE TABLE IF NOT EXISTS public.user_tag_writes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  tag_id text NOT NULL CHECK (length(tag_id) > 0),
  written_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_tag_writes_user_id
  ON public.user_tag_writes(user_id);
CREATE INDEX IF NOT EXISTS idx_user_tag_writes_written_at_desc
  ON public.user_tag_writes(written_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_tag_writes_user_written_desc
  ON public.user_tag_writes(user_id, written_at DESC);

CREATE TABLE IF NOT EXISTS public.user_tag_pending (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  tag_id text NOT NULL CHECK (length(tag_id) > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  confirmed boolean NOT NULL DEFAULT false,
  confirmed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_user_tag_pending_user_id
  ON public.user_tag_pending(user_id);
CREATE INDEX IF NOT EXISTS idx_user_tag_pending_expires_at
  ON public.user_tag_pending(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_tag_pending_confirmed_user_id
  ON public.user_tag_pending(confirmed, user_id);

CREATE TABLE IF NOT EXISTS public.event_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  marked_at timestamptz NOT NULL DEFAULT now(),
  marked_by uuid,
  scan_method text NOT NULL CHECK (scan_method IN ('NFC', 'QR', 'Manual')),
  location_lat numeric,
  location_lng numeric,
  notes text,
  is_member boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_event_attendance_event_user UNIQUE (event_id, user_id)
);

DO $$
BEGIN
  IF to_regclass('public.events') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conrelid = 'public.event_attendance'::regclass
        AND conname = 'event_attendance_event_id_fkey'
    ) THEN
      ALTER TABLE public.event_attendance
        ADD CONSTRAINT event_attendance_event_id_fkey
        FOREIGN KEY (event_id)
        REFERENCES public.events(id)
        ON DELETE CASCADE;
    END IF;
  END IF;

  IF to_regclass('auth.users') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conrelid = 'public.event_attendance'::regclass
        AND conname = 'event_attendance_marked_by_fkey'
    ) THEN
      ALTER TABLE public.event_attendance
        ADD CONSTRAINT event_attendance_marked_by_fkey
        FOREIGN KEY (marked_by)
        REFERENCES auth.users(id)
        ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_event_attendance_event_id
  ON public.event_attendance(event_id);
CREATE INDEX IF NOT EXISTS idx_event_attendance_marked_at_desc
  ON public.event_attendance(marked_at DESC);

CREATE OR REPLACE FUNCTION public.update_users_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_users_updated_at ON public.users;
CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.update_users_updated_at();

CREATE OR REPLACE FUNCTION public.update_event_attendance_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_event_attendance_updated_at ON public.event_attendance;
CREATE TRIGGER trg_event_attendance_updated_at
BEFORE UPDATE ON public.event_attendance
FOR EACH ROW
EXECUTE FUNCTION public.update_event_attendance_updated_at();

CREATE OR REPLACE FUNCTION public.can_user_write_tag(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last_write timestamptz;
  v_cooldown_days integer;
  v_next_available timestamptz;
BEGIN
  SELECT COALESCE(nts.cooldown_days, 14)
    INTO v_cooldown_days
  FROM public.nfc_tag_settings nts
  WHERE nts.id = true;

  v_cooldown_days := COALESCE(v_cooldown_days, 14);

  SELECT utw.written_at
    INTO v_last_write
  FROM public.user_tag_writes utw
  WHERE utw.user_id = p_user_id
  ORDER BY utw.written_at DESC
  LIMIT 1;

  IF v_last_write IS NULL THEN
    RETURN jsonb_build_object(
      'can_write', true,
      'next_available_date', NULL,
      'last_write_date', NULL,
      'cooldown_days', v_cooldown_days
    );
  END IF;

  v_next_available := v_last_write + make_interval(days => v_cooldown_days);

  RETURN jsonb_build_object(
    'can_write', now() >= v_next_available,
    'next_available_date', v_next_available,
    'last_write_date', v_last_write,
    'cooldown_days', v_cooldown_days
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.prepare_tag_write(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_exists boolean;
  v_eligibility jsonb;
  v_can_write boolean;
  v_pending_id uuid;
  v_tag_id text;
  v_expires_at timestamptz;
BEGIN
  SELECT EXISTS (SELECT 1 FROM public.users u WHERE u.id = p_user_id)
    INTO v_user_exists;

  IF NOT v_user_exists THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User not found.'
    );
  END IF;

  v_eligibility := public.can_user_write_tag(p_user_id);
  v_can_write := COALESCE((v_eligibility ->> 'can_write')::boolean, false);

  IF NOT v_can_write THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Cooldown not elapsed.',
      'next_available_date', v_eligibility -> 'next_available_date',
      'last_write_date', v_eligibility -> 'last_write_date',
      'cooldown_days', v_eligibility -> 'cooldown_days'
    );
  END IF;

  DELETE FROM public.user_tag_pending
  WHERE user_id = p_user_id
    AND confirmed = false;

  v_tag_id := gen_random_uuid()::text;
  v_expires_at := now() + interval '5 minutes';

  INSERT INTO public.user_tag_pending (user_id, tag_id, expires_at)
  VALUES (p_user_id, v_tag_id, v_expires_at)
  RETURNING id INTO v_pending_id;

  RETURN jsonb_build_object(
    'success', true,
    'tag_id', v_tag_id,
    'pending_id', v_pending_id,
    'expires_at', v_expires_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_tag_write(p_user_id uuid, p_pending_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pending public.user_tag_pending%ROWTYPE;
  v_write_id uuid;
  v_written_at timestamptz;
BEGIN
  SELECT *
    INTO v_pending
  FROM public.user_tag_pending
  WHERE id = p_pending_id
    AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Pending write not found.'
    );
  END IF;

  IF v_pending.confirmed THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Pending write already confirmed.'
    );
  END IF;

  IF v_pending.expires_at < now() THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Pending write expired.'
    );
  END IF;

  UPDATE public.users
  SET
    tag_id = v_pending.tag_id,
    nfc_tag_id = v_pending.tag_id,
    qr_code_data = v_pending.tag_id,
    updated_at = now()
  WHERE id = p_user_id;

  INSERT INTO public.user_tag_writes (user_id, tag_id)
  VALUES (p_user_id, v_pending.tag_id)
  RETURNING id, written_at INTO v_write_id, v_written_at;

  UPDATE public.user_tag_pending
  SET
    confirmed = true,
    confirmed_at = now()
  WHERE id = p_pending_id;

  RETURN jsonb_build_object(
    'success', true,
    'tag_id', v_pending.tag_id,
    'write_record_id', v_write_id,
    'written_at', v_written_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_tag_write_history(p_user_id uuid, p_limit integer DEFAULT 10)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer;
  v_writes jsonb;
  v_total integer;
BEGIN
  v_limit := GREATEST(1, LEAST(COALESCE(p_limit, 10), 100));

  SELECT COUNT(*)
    INTO v_total
  FROM public.user_tag_writes utw
  WHERE utw.user_id = p_user_id;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', utw.id,
        'tag_id', utw.tag_id,
        'written_at', utw.written_at,
        'created_at', utw.created_at
      )
      ORDER BY utw.written_at DESC
    ),
    '[]'::jsonb
  )
    INTO v_writes
  FROM (
    SELECT id, tag_id, written_at, created_at
    FROM public.user_tag_writes
    WHERE user_id = p_user_id
    ORDER BY written_at DESC
    LIMIT v_limit
  ) utw;

  RETURN jsonb_build_object(
    'writes', v_writes,
    'total_writes', v_total
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.lookup_user_by_tag(p_tag_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user record;
BEGIN
  SELECT u.id, u.email, u.full_name, u.tag_id
    INTO v_user
  FROM public.users u
  WHERE u.tag_id = p_tag_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  RETURN jsonb_build_object(
    'found', true,
    'user', jsonb_build_object(
      'id', v_user.id,
      'email', v_user.email,
      'full_name', v_user.full_name,
      'tag_id', v_user.tag_id
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_attendance(
  p_event_id uuid,
  p_user_id uuid,
  p_marked_by uuid,
  p_scan_method text,
  p_location_lat numeric DEFAULT NULL,
  p_location_lng numeric DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_is_member boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exists boolean;
  v_operator_allowed boolean;
  v_attendance_id uuid;
  v_marked_at timestamptz;
BEGIN
  IF p_scan_method NOT IN ('NFC', 'QR', 'Manual') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid scan_method.'
    );
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.users u WHERE u.id = p_user_id)
    INTO v_exists;

  IF NOT v_exists THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Attendee not found.'
    );
  END IF;

  SELECT (
    public.has_school_operator_role(p_marked_by, 'Officer')
    OR public.has_school_operator_role(p_marked_by, 'Admin')
  )
    INTO v_operator_allowed;

  IF NOT COALESCE(v_operator_allowed, false) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Permission denied.'
    );
  END IF;

  INSERT INTO public.event_attendance (
    event_id,
    user_id,
    marked_by,
    scan_method,
    location_lat,
    location_lng,
    notes,
    is_member
  )
  VALUES (
    p_event_id,
    p_user_id,
    p_marked_by,
    p_scan_method,
    p_location_lat,
    p_location_lng,
    p_notes,
    COALESCE(p_is_member, true)
  )
  ON CONFLICT (event_id, user_id) DO NOTHING
  RETURNING id, marked_at INTO v_attendance_id, v_marked_at;

  IF v_attendance_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'duplicate', true,
      'error', 'Duplicate attendance for event.'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'attendance_id', v_attendance_id,
    'marked_at', v_marked_at,
    'is_member', COALESCE(p_is_member, true)
  );
END;
$$;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_tag_pending ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_tag_writes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_select_self ON public.users;
CREATE POLICY users_select_self
  ON public.users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

DROP POLICY IF EXISTS users_update_self ON public.users;
CREATE POLICY users_update_self
  ON public.users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS user_tag_pending_select_self ON public.user_tag_pending;
CREATE POLICY user_tag_pending_select_self
  ON public.user_tag_pending
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS user_tag_writes_select_self ON public.user_tag_writes;
CREATE POLICY user_tag_writes_select_self
  ON public.user_tag_writes
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS event_attendance_select_operator ON public.event_attendance;
CREATE POLICY event_attendance_select_operator
  ON public.event_attendance
  FOR SELECT
  TO authenticated
  USING (
    public.has_school_operator_role(auth.uid(), 'Officer')
    OR public.has_school_operator_role(auth.uid(), 'Admin')
  );

DROP POLICY IF EXISTS event_attendance_insert_operator ON public.event_attendance;
CREATE POLICY event_attendance_insert_operator
  ON public.event_attendance
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_school_operator_role(auth.uid(), 'Officer')
    OR public.has_school_operator_role(auth.uid(), 'Admin')
  );

REVOKE ALL ON FUNCTION public.can_user_write_tag(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.prepare_tag_write(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.confirm_tag_write(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_tag_write_history(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.lookup_user_by_tag(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_attendance(uuid, uuid, uuid, text, numeric, numeric, text, boolean) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.can_user_write_tag(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_tag_write(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_tag_write(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_tag_write_history(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lookup_user_by_tag(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_attendance(uuid, uuid, uuid, text, numeric, numeric, text, boolean) TO authenticated;

COMMIT;
