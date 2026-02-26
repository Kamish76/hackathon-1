import { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function OfficerLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect('/auth/login');
  }

  const [{ data: isAdmin }, { data: isOfficer }, { data: isTaker }] = await Promise.all([
    supabase.rpc('has_school_operator_role', { p_user_id: user.id, p_role: 'Admin' }),
    supabase.rpc('has_school_operator_role', { p_user_id: user.id, p_role: 'Officer' }),
    supabase.rpc('has_school_operator_role', { p_user_id: user.id, p_role: 'Taker' }),
  ]);

  if (!isAdmin && !isOfficer && !isTaker) {
    redirect('/member');
  }

  return <>{children}</>;
}
