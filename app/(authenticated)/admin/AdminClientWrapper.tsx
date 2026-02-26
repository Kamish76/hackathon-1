'use client';

import AdminRoute from '@/components/AdminRoute';

export default function AdminClientWrapper({ children }: { children: React.ReactNode }) {
  return <AdminRoute>{children}</AdminRoute>;
}
