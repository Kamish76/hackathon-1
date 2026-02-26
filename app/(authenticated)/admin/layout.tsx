import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  const { data: adminRole, error } = await supabase
    .from('school_operator_roles')
    .select('operator_role, is_active')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .eq('operator_role', 'Admin')
    .maybeSingle();

  if (error || !adminRole) {
    redirect('/events');
  }

  return <>{children}</>;
}