# NFC Tag Write-to-Scan Implementation Reference

## Purpose

This document is a single, comprehensive technical reference for implementing an NFC-based attendance system from:

1. Member tag generation and writing
2. NFC/QR tag scanning
3. Attendance marking and reporting

It is designed for replication in a new system while preserving the same architecture and behavior patterns used in this project.

---

## 1. End-to-End Architecture

### 1.1 Core Idea

Use one unified identifier (`tag_id`) for both:

- NFC tag payload
- QR code payload

This allows one scanning pipeline regardless of scan channel.

### 1.2 Write Path (Safe Two-Phase Commit)

Do **not** write directly to active user tag immediately.

Use this sequence:

1. Prepare tag ID in pending state
2. Write tag ID to physical NFC tag
3. Confirm write to commit user active tag

This prevents database/NFC desynchronization.

### 1.3 Scan Path

1. Read tag payload (NFC text record or QR decoded text)
2. Validate tag format (UUID)
3. Lookup user by `tag_id`
4. Mark attendance with scan method (`NFC`, `QR`, `Manual`)
5. Show immediate result (success, duplicate, error)

---

## 2. Data Model (Replication Blueprint)

## 2.1 Primary User Tag Field

### Table: `users`

Required columns for tag flow:

- `id` UUID primary key (aligned with auth user id)
- `tag_id` TEXT UNIQUE (unified live tag id)

Legacy optional columns (for backward compatibility only):

- `nfc_tag_id` TEXT UNIQUE
- `qr_code_data` TEXT UNIQUE

Preferred approach for new builds: use `tag_id` as canonical.

## 2.2 Tag Write History

### Table: `user_tag_writes`

Purpose:

- Enforce cooldown window
- Keep immutable audit history

Recommended columns:

- `id` UUID PK
- `user_id` UUID FK to users
- `tag_id` TEXT
- `written_at` TIMESTAMPTZ
- `created_at` TIMESTAMPTZ

Recommended constraints:

- `CHECK (length(tag_id) > 0)`
- FK `ON DELETE CASCADE`

Recommended indexes:

- `(user_id)`
- `(written_at DESC)`
- `(user_id, written_at DESC)`

## 2.3 Pending Tag State (Two-Phase)

### Table: `user_tag_pending`

Purpose:

- Temporary tag reservation before physical write confirmation

Recommended columns:

- `id` UUID PK
- `user_id` UUID FK
- `tag_id` TEXT
- `created_at` TIMESTAMPTZ
- `expires_at` TIMESTAMPTZ
- `confirmed` BOOLEAN DEFAULT FALSE
- `confirmed_at` TIMESTAMPTZ NULL

Recommended constraints:

- `CHECK (length(tag_id) > 0)`

Recommended indexes:

- `(user_id)`
- `(expires_at)`
- `(confirmed, user_id)`

## 2.4 Attendance Table

### Table: `event_attendance`

Required for scan-to-attendance:

- `id` UUID PK
- `event_id` UUID FK
- `user_id` UUID FK (attendee)
- `marked_at` TIMESTAMPTZ
- `marked_by` UUID FK (scanner operator)
- `scan_method` TEXT CHECK IN (`NFC`, `QR`, `Manual`)
- `location_lat` DECIMAL nullable
- `location_lng` DECIMAL nullable
- `notes` TEXT nullable
- `is_member` BOOLEAN
- `created_at`, `updated_at`

Important constraint:

- `UNIQUE (event_id, user_id)` to prevent duplicate attendance for same event.

---

## 3. Database Functions You Should Implement

## 3.1 Tag Write Eligibility

### `can_user_write_tag(p_user_id UUID) RETURNS JSON`

Returns:

- `can_write`
- `next_available_date`
- `last_write_date`
- `cooldown_days`

Logic:

1. Get last write from `user_tag_writes`
2. If none: can write
3. Else compare now with `(last_write + cooldown)`

## 3.2 Prepare Tag Write

### `prepare_tag_write(p_user_id UUID) RETURNS JSON`

Returns:

- `success`
- `tag_id`
- `pending_id`
- `expires_at`

Logic:

1. Check cooldown via `can_user_write_tag`
2. Remove old unconfirmed pending rows for user
3. Generate new UUID tag
4. Insert into `user_tag_pending` with short expiry (example: +5 minutes)
5. Return payload

## 3.3 Confirm Tag Write

### `confirm_tag_write(p_user_id UUID, p_pending_id UUID) RETURNS JSON`

Returns:

- `success`
- `tag_id`
- `write_record_id`
- `written_at`

Logic:

1. Load pending row for this user
2. Fail if missing, expired, or already confirmed
3. Update `users.tag_id`
4. Insert write history into `user_tag_writes`
5. Mark pending row confirmed
6. Return success payload

## 3.4 Tag Write History

### `get_tag_write_history(p_user_id UUID, p_limit INT) RETURNS JSON`

Returns latest writes for profile UI and audits.

## 3.5 Legacy Function (Optional)

### `generate_and_assign_tag(p_user_id UUID)`

This is the old one-step write.

Keep only if backward compatibility is needed.

For new builds, prefer two-phase only.

## 3.6 Attendance Marking Function

### `mark_attendance(...) RETURNS JSON`

Expected behavior:

- Validate event exists
- Validate marker permission (Attendance Taker or higher)
- Detect duplicate attendance
- Support both members and non-members (guest mode)
- Return attendance id, marked time, and membership status

---

## 4. API Contract Reference

## 4.1 Tag APIs

### `GET /api/user/tag/can-write`

Auth required.

Response:

```json
{
  "can_write": true,
  "next_available_date": null,
  "last_write_date": null,
  "cooldown_days": 14
}
```

### `POST /api/user/tag/prepare`

Auth required.

Response:

```json
{
  "success": true,
  "tag_id": "uuid",
  "pending_id": "uuid",
  "expires_at": "timestamp"
}
```

### `POST /api/user/tag/confirm`

Auth required.

Request:

```json
{
  "pending_id": "uuid"
}
```

Response:

```json
{
  "success": true,
  "tag_id": "uuid",
  "write_record_id": "uuid",
  "written_at": "timestamp"
}
```

### `GET /api/user/tag/history?limit=10`

Auth required.

Response:

```json
{
  "writes": [],
  "total_writes": 0
}
```

### `POST /api/user/tag/generate` (Legacy)

Deprecated one-step flow.

## 4.2 Lookup APIs

### `GET /api/user/by-tag?tag_id={uuid}`

Auth required.

Returns normalized user object for scan pipeline.

### `GET /api/user/by-nfc?tag={raw}`

Legacy compatibility endpoint.

## 4.3 Attendance APIs

### `POST /api/attendance`

Auth required.

Request:

```json
{
  "event_id": "uuid",
  "user_id": "uuid",
  "scan_method": "NFC",
  "location_lat": 0,
  "location_lng": 0,
  "notes": "optional"
}
```

Validation:

- required fields present
- `scan_method` in `NFC|QR|Manual`
- coordinate bounds

### `GET /api/attendance?event_id={uuid}`

Returns attendance list and summary.

### `GET /api/attendance/event/{id}`

Supports normal and detailed view mode.

### `GET /api/attendance/event/{id}/export`

Admin/Owner export to spreadsheet.

---

## 5. Frontend Flow Reference

## 5.1 Profile and Tag Provisioning UI

Recommended profile sections:

- Current tag display (`tag_id`)
- QR rendering from `tag_id`
- Generate/program tag actions
- Recent tag write history

## 5.2 Tag Generation + NFC Write UX

### Recommended sequence

1. User taps “Program New Tag”
2. Client calls prepare endpoint
3. Client prompts NFC tap and writes NDEF text record containing `tag_id`
4. On success, client calls confirm endpoint
5. Refresh profile state and tag history

### Required failure handling

- If NFC write fails, **do not** call confirm
- Show actionable error
- Allow retry

## 5.3 Attendance Scanner UI

Recommended scan modes:

- NFC mode
- QR mode
- Manual mode

Processing behavior:

1. Prevent concurrent scan processing
2. Validate tag UUID format
3. Fetch user by tag
4. Post attendance
5. Add result card with status

Status outcomes:

- `success`
- `duplicate`
- `error`

## 5.4 Geolocation-Restricted Attendance (Optional)

When event has geo radius set:

- Require location permission before marking
- Include current coordinates in attendance POST
- Backend computes distance and rejects out-of-range attempts

---

## 6. Web NFC + QR Technical Notes

## 6.1 NFC Record Format

Use NDEF text records:

- `recordType: "text"`
- `data: tag_id`
- UTF-8 text payload

## 6.2 Browser/Device Support

Web NFC support is limited.

Practical baseline:

- Android Chromium-based browsers for NFC
- Fallback to QR/manual for unsupported devices

## 6.3 QR Strategy

- Generate QR directly from `tag_id`
- Scan decoded text and pass through same tag validation/lookup flow
- Keep both NFC and QR payload schema identical

---

## 7. Security, RLS, and Permissions

## 7.1 Tag Security Rules

- Users can only read/write their own tag write records
- Pending rows tied to user id
- Pending row expires quickly
- Confirm endpoint validates ownership, expiry, and confirmation state
- Cooldown cannot be bypassed

## 7.2 Attendance Permissions

Recommended policy model:

- Org members can read attendance for their org events
- Attendance Taker/Admin/Owner can create attendance
- Admin/Owner can update/delete attendance records

## 7.3 Audit and Immutability

- Keep tag history immutable (no normal update/delete paths)
- Keep attendance update/delete restricted and traceable

---

## 8. Error Model and User Messaging

## 8.1 Tag Flow Errors

- Unauthorized
- Cooldown not elapsed
- Pending ID missing/invalid
- Pending expired
- Pending already confirmed
- NFC permission denied / unsupported / not readable

## 8.2 Scan Flow Errors

- Empty tag
- Invalid UUID format
- Unknown tag (no user)
- Duplicate attendance
- Permission denied
- Location required or outside radius
- Network/parse/server failure

## 8.3 Good UX Principles

- Always return precise error reason
- Distinguish duplicate from generic failure
- Keep scanner active and responsive
- Give retry guidance

---

## 9. Realtime and Reporting

## 9.1 Realtime Attendance

If using Supabase realtime:

1. Add `event_attendance` to publication
2. Set replica identity full for full update/delete payloads
3. Subscribe by `event_id` for targeted updates

## 9.2 Reporting Views

### `attendance_with_details`

Join attendance with attendee, marker, event, and organization.

### `event_attendance_summary`

Aggregate counts:

- total attended
- member vs guest count
- method breakdown (`NFC`, `QR`, `Manual`)
- attendance percentage

---

## 10. Replication Checklist (Implementation Order)

1. Create base auth/user/org/event/attendance tables
2. Add tag tables (`user_tag_writes`, `user_tag_pending`)
3. Add DB helper and attendance/tag functions
4. Add RLS policies for all related tables
5. Implement tag APIs (`can-write`, `prepare`, `confirm`, `history`)
6. Implement user lookup API (`by-tag`)
7. Implement attendance POST/GET APIs
8. Implement profile tag management UI
9. Implement scanner UI (NFC/QR/manual)
10. Add realtime subscriptions and export features
11. Run integration tests for happy path + failure path

---

## 11. Suggested Test Matrix

## 11.1 Tag Provisioning

- First-time tag generation succeeds
- Cooldown blocks immediate re-generation
- Prepare succeeds but no confirm leaves active tag unchanged
- Confirm after expiry fails
- Confirm with wrong user fails

## 11.2 Scan + Attendance

- NFC valid tag marks attendance
- QR valid tag marks attendance
- Invalid format rejected early
- Unknown tag returns not found
- Duplicate attendance returns conflict
- Permission-denied marker rejected
- Geo-restricted event rejects out-of-radius

## 11.3 Security

- User cannot read another user tag history
- User cannot confirm someone else pending row
- Member role boundaries enforced on attendance write/update/delete

---

## 12. Known Pitfalls and How to Avoid Them

1. **Desync bug**: Writing DB before physical NFC write  
   Fix: Always use prepare + confirm flow.

2. **Cooldown mismatch** between frontend and SQL  
   Fix: Keep shared value synchronized in both layers.

3. **Weak scan validation**  
   Fix: Validate UUID format before API calls.

4. **No fallback for unsupported NFC devices**  
   Fix: Always support QR and manual mode.

5. **Incomplete permissions**  
   Fix: Enforce both route-level checks and DB RLS checks.

---

## 13. Minimal SQL Skeleton (Starter)

```sql
-- Canonical user tag
ALTER TABLE users ADD COLUMN IF NOT EXISTS tag_id text UNIQUE;

-- Tag write history
CREATE TABLE IF NOT EXISTS user_tag_writes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tag_id text NOT NULL CHECK (length(tag_id) > 0),
  written_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Pending tag writes
CREATE TABLE IF NOT EXISTS user_tag_pending (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tag_id text NOT NULL CHECK (length(tag_id) > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  confirmed boolean NOT NULL DEFAULT false,
  confirmed_at timestamptz
);
```

Use this only as a base, then add full indexes, policies, and functions described above.

---

## 14. Practical Build Guidance

For a clean new implementation:

- Keep **unified payload** (`tag_id`) across NFC and QR
- Keep **two-phase write** mandatory
- Keep **attendance permissions** in DB functions + RLS
- Keep **scanner loop** resilient with clear status feedback
- Keep **fallback channels** available when NFC is unsupported

This combination gives reliable operations, good UX, and a secure replication of the existing system behavior.
