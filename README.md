This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Supabase Setup

1. Install dependencies:

```bash
npm install @supabase/supabase-js @supabase/ssr
```

2. Copy `.env.example` to `.env.local` and set your project values:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

`SUPABASE_SERVICE_ROLE_KEY` is required for admin member management actions (deactivate and permanent account deletion). Keep it server-only and never expose it to client components.

## NFC / Attendance Target Architecture (Current Goal)

The project is now moving to the unified design in `NFC_TAG_WRITE_TO_SCAN_IMPLEMENTATION_REFERENCE.md`.

Canonical direction:

- One identifier for both NFC and QR payloads: `tag_id` (UUID)
- Two-phase tag programming flow only: `prepare` -> physical write -> `confirm`
- Internal-only backend flow (no external NFC webapp dependency)
- Canonical audit trail: `user_tag_pending`, `user_tag_writes`, `event_attendance`

Phase 1 foundation implemented:

- New migration: `supabase/migrations/06_unified_tag_and_attendance_foundation.sql`
- New endpoints:
	- `GET /api/user/tag/can-write`
	- `POST /api/user/tag/prepare`
	- `POST /api/user/tag/confirm`
	- `GET /api/user/tag/history?limit=10`
	- `GET /api/user/by-tag?tag_id={uuid}`
	- `POST /api/attendance`
	- `GET /api/attendance?event_id={uuid}`

Legacy routes are deprecated and now return `410 Gone`:

- `/api/member/tag`
- `/api/member/tag/set`
- `/api/member/tag/replace`
- `/api/member/tag/deactivate`
- `/api/member/tag/scan`

Remaining implementation work is tracked as refactor steps to migrate UI flows and reports to the new canonical tables and endpoints.

3. Use the initialized clients:

- Browser/client components: `lib/supabase/client.ts`
- Server components/actions: `lib/supabase/server.ts`

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
