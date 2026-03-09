import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { Sidebar } from '@/components/shared/sidebar';
import { Toaster } from '@/components/ui/toast';
import { propertyRepo } from '@/server/repositories/property.repo';
import { getSelectedPropertyId } from '@/server/actions/property-switch';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect('/login');

  const orgId = session.user.organizationId;

  // Fetch all properties for the org + resolve active property
  const [propertiesList, selectedPropertyId] = await Promise.all([
    propertyRepo.findAll(orgId),
    getSelectedPropertyId(),
  ]);

  // Validate: if cookie value isn't in the list, fall back to first property
  const isValid = selectedPropertyId && propertiesList.some((p) => p.id === selectedPropertyId);
  const activePropertyId = isValid ? selectedPropertyId : propertiesList[0]?.id ?? '';

  return (
    <div className="flex h-screen">
      <Sidebar
        userName={session.user.name ?? ''}
        userRole={session.user.role}
        properties={propertiesList.map((p) => ({ id: p.id, name: p.name, code: p.code }))}
        activePropertyId={activePropertyId}
      />

      {/* Main content — pt-14 on mobile for the fixed header bar */}
      <main className="flex-1 overflow-y-auto bg-background-light dark:bg-background-dark pt-14 lg:pt-0">
        {children}
      </main>

      <Toaster />
    </div>
  );
}
