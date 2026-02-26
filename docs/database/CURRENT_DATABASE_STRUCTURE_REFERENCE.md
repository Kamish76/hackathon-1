# Current Database Structure Reference

**Source of truth:** `docs/SCHOOL_INGRESS_EGRESS_INIT.sql`  
**Last Updated:** 2026-02-26

## 1) Module Summary
This schema adds an ingress/egress tracking module with:
- Person registry (students, staff, visitors, special guests)
- Authentication bridge table (links Supabase auth to person registry)
- Gate and access device management
- Vehicle sessions and passenger tracking
- Immutable access events (IN/OUT)
- Manifest support
- Manual override audit logs
- RLS baseline policies for operator roles

## 2) Extension
- `pgcrypto` (for `gen_random_uuid()`)

## 3) Tables

### 3.1 `public.person_registry`
Purpose: Canonical people directory for school and non-user visitors.

Columns:
- `id uuid PK default gen_random_uuid()`
- `linked_user_id uuid null`
- `person_type text not null check in ('Student','Staff','Visitor','Special Guest')`
- `full_name text not null`
- `email text null`
- `external_identifier text null unique`
- `nfc_tag_id text null unique`
- `qr_code_data text null unique`
- `is_active boolean not null default true`
- `created_by uuid null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Indexes:
- `idx_person_registry_person_type`
- `idx_person_registry_linked_user_id`
- `idx_person_registry_is_active`

---

### 3.2 `public.school_operator_roles`
Purpose: Operator RBAC assignments.

Columns:
- `id uuid PK`
- `user_id uuid not null unique`
- `operator_role text not null check in ('Admin','Taker')`
- `is_active boolean not null default true`
- `assigned_by uuid null`
- `assigned_at timestamptz not null default now()`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Indexes:
- `idx_school_operator_roles_role`
- `idx_school_operator_roles_active`

---

### 3.3 `public.gates`
Purpose: Physical gate metadata.

Columns:
- `id uuid PK`
- `gate_code text not null unique`
- `gate_name text not null`
- `location_description text null`
- `is_vehicle_lane boolean not null default false`
- `is_active boolean not null default true`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Indexes:
- `idx_gates_active`
- `idx_gates_vehicle_lane`

---

### 3.4 `public.access_devices`
Purpose: Reader/scanner devices mapped to gates.

Columns:
- `id uuid PK`
- `gate_id uuid not null FK -> public.gates(id) on delete cascade`
- `device_name text not null`
- `device_type text not null check in ('WEB_NFC','USB_READER','QR_SCANNER','MANUAL')`
- `device_identifier text null unique`
- `is_active boolean not null default true`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Indexes:
- `idx_access_devices_gate_id`
- `idx_access_devices_type`
- `idx_access_devices_active`

---

### 3.5 `public.vehicle_registry`
Purpose: Known vehicles with basic ownership classification.

Columns:
- `id uuid PK`
- `plate_number text not null unique`
- `vehicle_type text not null check in ('Car','Van','Bus','Motorcycle','Service','Unknown')`
- `owner_type text not null check in ('School','Staff','Visitor','Service','Unknown')`
- `notes text null`
- `is_active boolean not null default true`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Indexes:
- `idx_vehicle_registry_owner_type`
- `idx_vehicle_registry_active`

---

### 3.6 `public.vehicle_sessions`
Purpose: Per-gate vehicle ingress/egress session record.

Columns:
- `id uuid PK`
- `vehicle_id uuid null FK -> public.vehicle_registry(id) on delete set null`
- `gate_id uuid not null FK -> public.gates(id) on delete restrict`
- `session_started_at timestamptz not null default now()`
- `session_closed_at timestamptz null`
- `status text not null default 'OPEN' check in ('OPEN','CLOSED','CANCELLED')`
- `opened_by uuid null`
- `closed_by uuid null`
- `notes text null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Checks:
- `chk_vehicle_session_closed_when_status_closed` ensures closed sessions have `session_closed_at`

Indexes:
- `idx_vehicle_sessions_vehicle_id`
- `idx_vehicle_sessions_gate_id`
- `idx_vehicle_sessions_status`
- `idx_vehicle_sessions_started_at`

---

### 3.7 `public.access_events`
Purpose: Primary IN/OUT event ledger.

Columns:
- `id uuid PK`
- `person_id uuid not null FK -> public.person_registry(id) on delete restrict`
- `gate_id uuid not null FK -> public.gates(id) on delete restrict`
- `reader_id uuid null FK -> public.access_devices(id) on delete set null`
- `vehicle_session_id uuid null FK -> public.vehicle_sessions(id) on delete set null`
- `direction text not null check in ('IN','OUT')`
- `entry_mode text not null default 'WALK' check in ('WALK','VEHICLE')`
- `verification_method text not null check in ('NFC','QR','MANUAL_OVERRIDE','MANIFEST')`
- `event_timestamp timestamptz not null default now()`
- `operator_user_id uuid null`
- `is_manual_override boolean not null default false`
- `override_reason text null`
- `metadata jsonb not null default '{}'::jsonb`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Checks:
- `chk_override_reason_required` (reason required when manual override)

Indexes:
- `idx_access_events_person_id`
- `idx_access_events_gate_id`
- `idx_access_events_vehicle_session_id`
- `idx_access_events_event_timestamp`
- `idx_access_events_direction_timestamp`
- `idx_access_events_person_timestamp`

---

### 3.8 `public.vehicle_passengers`
Purpose: Person-to-vehicle-session linkage with direction and verification mode.

Columns:
- `id uuid PK`
- `vehicle_session_id uuid not null FK -> public.vehicle_sessions(id) on delete cascade`
- `person_id uuid not null FK -> public.person_registry(id) on delete restrict`
- `boarded_direction text not null check in ('IN','OUT')`
- `verified_by_method text not null check in ('NFC','QR','MANUAL_OVERRIDE','MANIFEST')`
- `created_at timestamptz not null default now()`

Constraints:
- `uq_vehicle_passenger_direction` unique (`vehicle_session_id`, `person_id`, `boarded_direction`)

Indexes:
- `idx_vehicle_passengers_session_id`
- `idx_vehicle_passengers_person_id`

---

### 3.9 `public.manifests`
Purpose: Scheduled manifest documents for planned ingress/egress.

Columns:
- `id uuid PK`
- `manifest_name text not null`
- `vehicle_id uuid null FK -> public.vehicle_registry(id) on delete set null`
- `scheduled_date date not null`
- `direction text not null check in ('IN','OUT','BOTH')`
- `status text not null default 'DRAFT' check in ('DRAFT','ACTIVE','CLOSED','CANCELLED')`
- `created_by uuid null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Indexes:
- `idx_manifests_scheduled_date`
- `idx_manifests_status`

---

### 3.10 `public.manifest_entries`
Purpose: People included on a manifest.

Columns:
- `id uuid PK`
- `manifest_id uuid not null FK -> public.manifests(id) on delete cascade`
- `person_id uuid not null FK -> public.person_registry(id) on delete restrict`
- `expected_stop text null`
- `is_required boolean not null default true`
- `created_at timestamptz not null default now()`

Constraints:
- `uq_manifest_person` unique (`manifest_id`, `person_id`)

Indexes:
- `idx_manifest_entries_manifest_id`
- `idx_manifest_entries_person_id`

---

### 3.11 `public.override_logs`
Purpose: Audit trail for manual overrides tied to access events.

Columns:
- `id uuid PK`
- `access_event_id uuid not null FK -> public.access_events(id) on delete cascade`
- `operator_user_id uuid not null`
- `reason text not null`
- `approved_by uuid null`
- `created_at timestamptz not null default now()`

Indexes:
- `idx_override_logs_access_event_id`
- `idx_override_logs_operator_user_id`

---

### 3.12 `public.auth_users`
Purpose: Authentication bridge table linking Supabase auth.users to person_registry and school_operator_roles.

Columns:
- `id uuid PK FK -> auth.users(id) on delete cascade`
- `person_id uuid unique FK -> public.person_registry(id) on delete cascade`
- `email text not null unique`
- `role_id uuid null FK -> public.school_operator_roles(id)`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

RLS Policies:
- `Authenticated users can read auth_users` - All authenticated users can read any record (FOR SELECT TO authenticated USING (true))
- `Users can update their own auth record` - Users can update only their own record (FOR UPDATE USING (auth.uid() = id))
- No direct INSERT policy (uses SECURITY DEFINER function `create_auth_users_record`)

OAuth Flow:
- When new Google OAuth users sign in, the callback route (`/auth/callback`) checks if they exist in auth_users
- If not found, they're redirected to `/auth/registration?oauth=true` to complete their profile
- On profile completion, `completeOAuthProfile()` creates person_registry and auth_users records
- The RLS policy allows authenticated users to query auth_users for verification purposes

## 4) Optional User Foreign-Key Compatibility Layer
To avoid dependency on a specific auth schema, user FK constraints are added conditionally:
- Uses `public.users` if present
- Falls back to `auth.users` if present
- Skips FK creation if neither exists (with notice)

Conditional FKs (constraint names):
- `fk_person_registry_linked_user`
- `fk_person_registry_created_by`
- `fk_school_operator_roles_user_id`
- `fk_school_operator_roles_assigned_by`
- `fk_vehicle_sessions_opened_by`
- `fk_vehicle_sessions_closed_by`
- `fk_access_events_operator_user_id`
- `fk_manifests_created_by`
- `fk_override_logs_operator_user_id`
- `fk_override_logs_approved_by`

## 5) Functions
- `public.update_updated_at_column()`
  - Trigger helper that sets `NEW.updated_at = NOW()`
- `public.update_auth_users_updated_at()`
  - Trigger helper for auth_users table that sets `NEW.updated_at = NOW()`
- `public.has_school_operator_role(p_user_id uuid, p_role text)`
  - Returns whether user has active operator role
  - `Taker` includes both `Taker` and `Admin`
- `public.prevent_duplicate_direction()`
  - Anti-passback trigger guard for `access_events`
  - Prevents consecutive identical directions unless manual override
- `public.create_person_registry_record(user_full_name text, user_email text, user_person_type text)`
  - SECURITY DEFINER function to create person_registry records during signup
  - Bypasses RLS policies to allow new user registration
  - Returns UUID of newly created person record
- `public.create_auth_users_record(user_id uuid, person_uuid uuid, user_email text, user_role_id uuid)`
  - SECURITY DEFINER function to create auth_users bridge records
  - Bypasses RLS policies and verifies user exists in auth.users
  - Links authenticated users to person_registry and school_operator_roles
- `public.get_person_full_name(user_id uuid)`
  - SECURITY DEFINER function to fetch person_registry full_name by user_id
  - Bypasses RLS policies for safe data retrieval during OAuth flow
  - Queries through auth_users bridge to find associated person_registry record
  - Returns TEXT (full_name) or NULL if user not found in auth_users
  - Used in AuthContext to display registered full_name instead of OAuth provider name

## 6) Triggers
`BEFORE UPDATE` (maintain `updated_at`):
- `trg_person_registry_updated_at`
- `trg_school_operator_roles_updated_at`
- `trg_gates_updated_at`
- `trg_access_devices_updated_at`
- `trg_vehicle_registry_updated_at`
- `trg_vehicle_sessions_updated_at`
- `trg_access_events_updated_at`
- `trg_manifests_updated_at`
- `update_auth_users_updated_at` on `public.auth_users`

`BEFORE INSERT`:
- `trg_prevent_duplicate_direction` on `public.access_events`

## 7) Views
- `public.current_population_inside`
  - Latest event per person where latest direction is `IN`
- `public.vehicle_session_summary`
  - Vehicle sessions with plate, gate, and passenger count

## 8) Row-Level Security (RLS)
RLS is enabled on:
- `person_registry`
- `school_operator_roles`
- `gates`
- `access_devices`
- `vehicle_registry`
- `vehicle_sessions`
- `access_events`
- `vehicle_passengers`
- `manifests`
- `manifest_entries`
- `override_logs`
- `auth_users`

Policy pattern summary:
- Taker role: read/insert operational records
- Admin role: full mutation on configuration/role tables and privileged updates
- Enforcement helper: `public.has_school_operator_role(auth.uid(), <role>)`

## 9) Seed Data
Default gates inserted idempotently:
- `GATE-01` Main Gate (pedestrian)
- `GATE-02` Vehicle Gate (vehicle lane)

## 10) Operational Notes
- Script is additive and designed to be idempotent.
- Existing attendance schema is not dropped/replaced.
- Visitors/Special Guests remain in `person_registry` and do not require direct app user accounts.
- Trigger block is self-contained and recreates required trigger functions before trigger creation.
