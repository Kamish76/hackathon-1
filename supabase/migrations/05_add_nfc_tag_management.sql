BEGIN;

ALTER TABLE public.person_registry
  ADD COLUMN IF NOT EXISTS nfc_tag_status text NOT NULL DEFAULT 'none'
    CHECK (nfc_tag_status IN ('none', 'active', 'deactivated', 'replaced')),
  ADD COLUMN IF NOT EXISTS nfc_tag_last_changed_at timestamptz,
  ADD COLUMN IF NOT EXISTS nfc_tag_deactivation_reason text
    CHECK (nfc_tag_deactivation_reason IS NULL OR nfc_tag_deactivation_reason IN ('lost', 'stolen', 'damaged', 'other'));

CREATE TABLE IF NOT EXISTS public.nfc_tag_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  cooldown_enabled boolean NOT NULL DEFAULT true,
  cooldown_days integer NOT NULL DEFAULT 7 CHECK (cooldown_days BETWEEN 1 AND 365),
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.nfc_tag_settings (id, cooldown_enabled, cooldown_days)
VALUES (true, true, 7)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.member_tag_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES public.person_registry(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('set', 'replace', 'deactivate', 'reactivate')),
  previous_tag_uid text,
  new_tag_uid text,
  reason text,
  external_status text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_member_tag_events_person_id_created_at
  ON public.member_tag_events(person_id, created_at DESC);

ALTER TABLE public.nfc_tag_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_tag_events ENABLE ROW LEVEL SECURITY;

COMMIT;