# NFC / QR Attendance & Access Management System

A web application for managing NFC and QR-based attendance and access control in schools and organizations. The system supports multiple roles (Admin, Officer, Member/Student), provides real-time scanning, and maintains a full audit trail of tag operations and attendance events.

## Features

- **NFC & QR Tag Management** — Generate, program, and manage unique NFC/QR tags for members using a safe two-phase write flow (`prepare` → physical write → `confirm`).
- **Attendance Tracking** — Record and review member entry/exit events in real time via NFC or QR code scans.
- **Role-Based Dashboards** — Separate interfaces for Admins, Officers, and Members/Students.
- **Officer Scanning Interface** — Dedicated page for officers to scan tags and record attendance at gates.
- **Admin Dashboard** — Manage members, officers, gate configuration, NFC settings, and view reports.
- **Anti-Clone Protection** — Write cooldown window and immutable audit trail prevent tag duplication.
- **Google OAuth & Email/Password Auth** — Flexible sign-in with automatic profile completion for OAuth users.
- **Emergency Mode** — Emergency access-control override capability.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | [Next.js](https://nextjs.org) (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Backend / Database | [Supabase](https://supabase.com) (PostgreSQL + Auth + RLS) |
| QR Scanning | [html5-qrcode](https://github.com/mebjas/html5-qrcode) |
| QR Generation | [qrcode.react](https://github.com/zpao/qrcode.react) |
| Icons | [lucide-react](https://lucide.dev) |

## Project Structure

```
hackathon-1/
├── app/
│   ├── (authenticated)/        # Protected routes (admin, officer, member, events, people)
│   ├── (unauthenticated)/      # Public routes (login, registration, OAuth callback)
│   ├── api/                    # REST API endpoints
│   │   ├── admin/              # Member & NFC settings management
│   │   ├── attendance/         # Attendance recording & retrieval
│   │   ├── officer/            # Scanning & gate operations
│   │   └── user/               # Tag prepare/confirm/history endpoints
│   └── globals.css
├── components/                 # Reusable React components (sidebars, route guards, QR scanner)
├── contexts/
│   └── AuthContext.tsx         # Global authentication & role state
├── hooks/
│   └── useOfficerGate.ts
├── lib/
│   └── supabase/               # Browser, server, and admin Supabase clients
├── supabase/
│   └── migrations/             # Ordered SQL migrations (run 01 → 07)
└── docs/                       # Architecture & implementation planning documents
```

## Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://app.supabase.com) project

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy `.env.example` to `.env.local` (or create `.env.local`) and fill in your Supabase project values:

```bash
NEXT_PUBLIC_SUPABASE_URL=<your-supabase-project-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-supabase-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-supabase-service-role-key>
```

> `SUPABASE_SERVICE_ROLE_KEY` is used server-side only for admin operations (member deactivation, permanent deletion). Never expose it in client components.

### 3. Set up the database

Run the SQL migrations in order in your Supabase project's SQL Editor:

```
supabase/migrations/01_create_users_table.sql
supabase/migrations/02_...sql
...
supabase/migrations/06_unified_tag_and_attendance_foundation.sql
supabase/migrations/07_...sql
```

See [DATABASE_SETUP.md](DATABASE_SETUP.md) for detailed instructions and troubleshooting.

### 4. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Lint

```bash
npm run lint
```

### Build for production

```bash
npm run build
npm start
```

## API Reference

### Tag Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/user/tag/can-write` | Check if the current user is allowed to write a tag |
| `POST` | `/api/user/tag/prepare` | Phase 1: reserve a tag ID in the database |
| `POST` | `/api/user/tag/confirm` | Phase 2: activate the tag after physical NFC write |
| `GET` | `/api/user/tag/history?limit=10` | Retrieve tag write history |
| `GET` | `/api/user/by-tag?tag_id={uuid}` | Look up a user by their tag ID |

### Attendance

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/attendance` | Record an attendance event |
| `GET` | `/api/attendance?event_id={uuid}` | Retrieve attendance records for an event |

### Officer Operations

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/officer/scan` | Process an officer scan |
| `GET` | `/api/officer/gates` | Get gate information |

### Admin

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/admin/members` | List all members |
| `POST` | `/api/admin/members` | Create a new member |
| `PATCH` | `/api/admin/members/[memberId]` | Update a member |
| `GET` | `/api/admin/nfc-tag-settings` | Get NFC configuration |
| `PATCH` | `/api/admin/nfc-tag-settings` | Update NFC configuration |

> **Legacy routes** (`/api/member/tag`, `/api/member/tag/set`, `/api/member/tag/replace`, `/api/member/tag/deactivate`, `/api/member/tag/scan`) are deprecated and return `410 Gone`.

## Architecture Notes

The system uses a **unified tag identifier** (`tag_id` UUID) that works for both NFC and QR payloads, eliminating the need for separate identifiers per medium.

Tag programming follows a **two-phase flow**:
1. **Prepare** — A pending tag ID is reserved in `user_tag_pending`.
2. **Physical Write** — The tag ID is written to the NFC chip on the user's device.
3. **Confirm** — The tag is activated and linked to the user's profile; an immutable record is appended to `user_tag_writes`.

For a full technical reference see [NFC_TAG_WRITE_TO_SCAN_IMPLEMENTATION_REFERENCE.md](NFC_TAG_WRITE_TO_SCAN_IMPLEMENTATION_REFERENCE.md).

## Deployment

Deploy to [Vercel](https://vercel.com) with one click:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme)

Add the three environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) in your Vercel project settings before deploying.
