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
NEXT_PUBLIC_NFC_API_BASE_URL=...
NFC_API_BASE_URL=... # optional server override
NFC_API_KEY=...      # optional x-api-key sent to NFC API
```

`SUPABASE_SERVICE_ROLE_KEY` is required for admin member management actions (deactivate and permanent account deletion). Keep it server-only and never expose it to client components.

`NEXT_PUBLIC_NFC_API_BASE_URL` points to your separate NFC backend API deployment used for member tag registration/status actions.

For full external API integration details, see `INTEGRATE_WITH_EXTERNAL_WEBAPP.md`.

## NFC Testing Mode (Temporary)

For current testing, this app allows scans to proceed even when the tag payload does not include `cnt` (counter mirror).

- Tag registration/linking still works (`set`, `replace`, `deactivate`).
- UID-based scans and activity logging can still run.
- Manual counter fallback may be used during testing.

Important limitation:

- Without a real mirrored `cnt` value from NTAG counter mirror configuration, anti-clone verification is not cryptographically reliable.
- Treat this mode as development/testing only.

When moving to production, configure tags with proper mirror settings and require real `cnt` values for scan verification.

3. Use the initialized clients:

- Browser/client components: `lib/supabase/client.ts`
- Server components/actions: `lib/supabase/server.ts`

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
