import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  console.log('[AdminLayout] Checking server auth for /admin routes');
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  console.log('[AdminLayout] getUser result', {
    hasUser: Boolean(user),
    userId: user?.id ?? null,
    hasError: Boolean(userError),
    errorMessage: userError?.message ?? null,
  });

  if (!user) {
    console.log('[AdminLayout] No user in server session; redirecting to /auth/login');
    redirect('/auth/login');
  }

  const { data: adminRole, error } = await supabase
    .from('school_operator_roles')
    .select('operator_role, is_active')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .eq('operator_role', 'Admin')
    .maybeSingle();

  console.log('[AdminLayout] Admin role lookup', {
    hasAdminRole: Boolean(adminRole),
    hasError: Boolean(error),
    errorMessage: error?.message ?? null,
  });

  if (error || !adminRole) {
    console.log('[AdminLayout] User is not active Admin; redirecting to /events');
    redirect('/events');
  }

  console.log('[AdminLayout] Access granted to admin route');
  return <>{children}</>;
}