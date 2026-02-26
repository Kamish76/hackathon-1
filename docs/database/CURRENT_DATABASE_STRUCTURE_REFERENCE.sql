-- ============================================================================
-- CURRENT DATABASE STRUCTURE REFERENCE QUERIES
-- ============================================================================
-- Purpose:
--   Run these queries against your database to inspect the current ingress/egress
--   structure (tables, columns, constraints, indexes, triggers, views, RLS).
--
-- Applied migrations:
--   01_create_users_table.sql
--   02_fix_school_operator_roles_rls_recursion.sql
--   03_rename_taker_to_officer.sql          (operator_role 'Taker' → 'Officer')
--   04_fix_officer_rpc_taker_compat.sql     (has_school_operator_role Taker compat)
--   05_fix_rls_taker_role_alias.sql          (fix p_role='Taker' in existing RLS policy calls)
--   05_fix_rls_taker_role_alias.sql          (officer RLS policies for person_registry, gates, access_events)
--
-- Usage:
--   Execute sections individually in SQL editor.
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1) TABLES (public)
-- --------------------------------------------------------------------------
SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
  AND table_name IN (
    'person_registry',
    'school_operator_roles',
    'gates',
    'access_devices',
    'vehicle_registry',
    'vehicle_sessions',
    'access_events',
    'vehicle_passengers',
    'manifests',
    'manifest_entries',
    'override_logs',
    'auth_users'
  )
ORDER BY table_name;

-- --------------------------------------------------------------------------
-- 2) COLUMNS + TYPES
-- --------------------------------------------------------------------------
SELECT
  c.table_name,
  c.ordinal_position,
  c.column_name,
  c.data_type,
  c.is_nullable,
  c.column_default
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND c.table_name IN (
    'person_registry',
    'school_operator_roles',
    'gates',
    'access_devices',
    'vehicle_registry',
    'vehicle_sessions',
    'access_events',
    'vehicle_passengers',
    'manifests',
    'manifest_entries',
    'override_logs',
    'auth_users'
  )
ORDER BY c.table_name, c.ordinal_position;

-- --------------------------------------------------------------------------
-- 2.1) PERSON REGISTRY: ADDITIONAL / EMERGENCY ATTRIBUTES
-- --------------------------------------------------------------------------
SELECT
  c.column_name,
  c.data_type,
  c.is_nullable,
  c.column_default
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND c.table_name = 'person_registry'
  AND c.column_name IN (
    'birth_date',
    'emergency_contact_name',
    'emergency_contact_phone',
    'emergency_contacts',
    'remarks'
  )
ORDER BY c.column_name;

-- --------------------------------------------------------------------------
-- 3) PRIMARY / UNIQUE / CHECK CONSTRAINTS
-- --------------------------------------------------------------------------
SELECT
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type,
  cc.check_clause
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.check_constraints cc
  ON cc.constraint_name = tc.constraint_name
WHERE tc.table_schema = 'public'
  AND tc.table_name IN (
    'person_registry',
    'school_operator_roles',
    'gates',
    'access_devices',
    'vehicle_registry',
    'vehicle_sessions',
    'access_events',
    'vehicle_passengers',
    'manifests',
    'manifest_entries',
    'override_logs',
    'auth_users'
  )
  AND tc.constraint_type IN ('PRIMARY KEY', 'UNIQUE', 'CHECK')
ORDER BY tc.table_name, tc.constraint_type, tc.constraint_name;

-- --------------------------------------------------------------------------
-- 4) FOREIGN KEYS
-- --------------------------------------------------------------------------
SELECT
  tc.table_name,
  tc.constraint_name,
  kcu.column_name,
  ccu.table_schema AS foreign_table_schema,
  ccu.table_name   AS foreign_table_name,
  ccu.column_name  AS foreign_column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.constraint_schema = tc.table_schema
WHERE tc.table_schema = 'public'
  AND tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name IN (
    'person_registry',
    'school_operator_roles',
    'gates',
    'access_devices',
    'vehicle_registry',
    'vehicle_sessions',
    'access_events',
    'vehicle_passengers',
    'manifests',
    'manifest_entries',
    'override_logs',
    'auth_users'
  )
ORDER BY tc.table_name, tc.constraint_name;

-- --------------------------------------------------------------------------
-- 5) INDEXES
-- --------------------------------------------------------------------------
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN (
    'person_registry',
    'school_operator_roles',
    'gates',
    'access_devices',
    'vehicle_registry',
    'vehicle_sessions',
    'access_events',
    'vehicle_passengers',
    'manifests',
    'manifest_entries',
    'override_logs',
    'auth_users'
  )
ORDER BY tablename, indexname;

-- --------------------------------------------------------------------------
-- 6) FUNCTIONS
-- --------------------------------------------------------------------------
SELECT
  n.nspname AS schema_name,
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS arguments,
  pg_get_function_result(p.oid) AS return_type
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'update_updated_at_column',
    'update_auth_users_updated_at',
    'has_school_operator_role',
    'prevent_duplicate_direction',
    'create_person_registry_record',
    'create_auth_users_record',
    'get_person_full_name'
  )
ORDER BY p.proname;

-- --------------------------------------------------------------------------
-- 7) TRIGGERS
-- --------------------------------------------------------------------------
SELECT
  event_object_table AS table_name,
  trigger_name,
  action_timing,
  event_manipulation,
  action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND event_object_table IN (
    'person_registry',
    'school_operator_roles',
    'gates',
    'access_devices',
    'vehicle_registry',
    'vehicle_sessions',
    'access_events',
    'manifests',
    'auth_users'
  )
ORDER BY event_object_table, trigger_name;

-- --------------------------------------------------------------------------
-- 8) VIEWS
-- --------------------------------------------------------------------------
SELECT schemaname, viewname, definition
FROM pg_views
WHERE schemaname = 'public'
  AND viewname IN ('current_population_inside', 'vehicle_session_summary')
ORDER BY viewname;

-- --------------------------------------------------------------------------
-- 9) RLS ENABLED TABLES
-- --------------------------------------------------------------------------
SELECT schemaname, tablename, rowsecurity, forcerowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'person_registry',
    'school_operator_roles',
    'gates',
    'access_devices',
    'vehicle_registry',
    'vehicle_sessions',
    'access_events',
    'vehicle_passengers',
    'manifests',
    'manifest_entries',
    'override_logs',
    'auth_users'
  )
ORDER BY tablename;

-- --------------------------------------------------------------------------
-- 10) RLS POLICIES
-- --------------------------------------------------------------------------
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'person_registry',
    'school_operator_roles',
    'gates',
    'access_devices',
    'vehicle_registry',
    'vehicle_sessions',
    'access_events',
    'vehicle_passengers',
    'manifests',
    'manifest_entries',
    'override_logs',
    'auth_users'
  )
ORDER BY tablename, policyname;
