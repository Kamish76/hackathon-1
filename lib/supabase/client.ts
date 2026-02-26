// `@supabase/ssr` occasionally causes resolution errors in Next.js build passes.
// It's simpler to import directly from the core package unless you need advanced
// server helpers. The browser client factory is exported from
// `@supabase/supabase-js` as well.
import { createClient as createBrowserClient } from "@supabase/supabase-js";

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    // Return a minimal mock client to avoid runtime crashes when env vars
    // are not configured (e.g. during local dev without .env). The mock only
    // implements the auth methods used by the app and returns sane defaults.
    const noop = async () => ({ data: { user: null }, error: null });

    return {
      auth: {
        getUser: noop,
        onAuthStateChange: (_handler: any) => ({
          data: { subscription: { unsubscribe: () => {} } },
        }),
        signInWithPassword: async () => ({ error: { message: 'Supabase not configured' } }),
        signInWithOAuth: async () => ({ error: { message: 'Supabase not configured' } }),
        signOut: async () => ({ error: null }),
      },
    } as any;
  }

  return createBrowserClient(supabaseUrl, anonKey);
}
