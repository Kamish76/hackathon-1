# Integrate NFC API with a Separate Web App

## Status: Legacy Reference

This document is kept for historical context only.

Current implementation direction is internal-only, using the unified `tag_id` architecture and two-phase write flow documented in `NFC_TAG_WRITE_TO_SCAN_IMPLEMENTATION_REFERENCE.md`.

Use the new internal endpoints instead of external NFC webapp integration for active development.

This project can call a separate NFC backend API for tag registration, scan verification, and tag lifecycle actions.

## 1) Deploy and configure the NFC backend API

Deploy your NFC API project (the separate backend) and copy its base URL:

- Example: `https://nfc-scan-counter-mirror.vercel.app`

In that API deployment, configure:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `WEBAPP_ORIGIN=https://your-frontend-domain.com`

Use exact origin values (`https://domain.com`, no trailing slash).

## 2) Configure this app (frontend/admin app)

Set these environment variables in this project:

```env
NEXT_PUBLIC_NFC_API_BASE_URL=https://nfc-scan-counter-mirror.vercel.app
# Optional server override (if different from public value)
NFC_API_BASE_URL=https://nfc-scan-counter-mirror.vercel.app
# Optional API key passed as x-api-key header to NFC backend
NFC_API_KEY=...
```

## 3) Internal API routes added in this app

Member routes (authenticated):

- `GET /api/member/tag` — tag status + cooldown + external reachability
- `POST /api/member/tag/set` — set or re-activate tag with `{ uid }`
- `PATCH /api/member/tag/replace` — replace active tag with `{ new_uid }`
- `PATCH /api/member/tag/deactivate` — deactivate active tag with `{ reason }`

Admin routes:

- `GET /api/admin/nfc-tag-settings`
- `PATCH /api/admin/nfc-tag-settings` with `{ cooldown_enabled, cooldown_days }`

## 4) Cooldown behavior implemented

- Cooldown applies to:
  - replacing an active tag
  - re-activating (setting a new tag after deactivation)
- Cooldown does **not** apply to first-time tag set (`status = none`)
- Admin can enable/disable cooldown globally and set days

## 5) Member/admin UI locations

- Member tag management UI: `app/(authenticated)/member/page.tsx`
- Admin cooldown control UI: `app/(authenticated)/admin/checkpoints/page.tsx`

## 6) Notes

- Supabase in this app is the source of truth for member tag ownership/status.
- External NFC API is called by server routes in this app.
- Keep `SUPABASE_SERVICE_ROLE_KEY` and `NFC_API_KEY` server-only.

## 7) Temporary testing behavior (`cnt` optional)

For current testing, the officer scanner accepts scans even when `cnt` is missing:

- If `cnt` is present and valid, the app calls external `/api/scan` and performs anti-clone verification.
- If `cnt` is missing, the app still records an NFC scan log/event in local `access_events` and marks it as testing mode.

Important:

- `cnt`-missing scans are for testing workflow only and should not be treated as clone-protected verification.
- Re-enable strict counter-required validation before production rollout.