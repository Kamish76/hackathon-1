'use client';

import GuestRoute from '@/components/GuestRoute';

export default function UnauthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <GuestRoute>{children}</GuestRoute>;
}
