import { auth } from '@/lib/auth';
import { notFound } from 'next/navigation';
import { AdminShell } from '@/components/admin/admin-shell';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  // 404 (not 403) so we don't even hint at the existence of the panel
  if (!session?.user?.isSuperAdmin) notFound();

  return (
    <AdminShell userName={session.user.name ?? 'Admin'} userEmail={session.user.email ?? ''}>
      {children}
    </AdminShell>
  );
}
