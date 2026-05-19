import Link from 'next/link';
import { notFound } from 'next/navigation';
import { organizationRepo } from '@/server/repositories/organization.repo';
import { organizationBillingRepo } from '@/server/repositories/organization-billing.repo';
import { propertyRepo } from '@/server/repositories/property.repo';
import { invitationRepo } from '@/server/repositories/invitation.repo';
import { OrganizationDetailClient } from '@/components/admin/organization-detail-client';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AdminOrganizationDetailPage({ params }: Props) {
  const { id } = await params;

  const org = await organizationRepo.findById(id);
  if (!org) notFound();

  const [usage, propertiesList, pendingInvitations, billing] = await Promise.all([
    organizationRepo.getUsage(id),
    propertyRepo.findWithStatsByOrg(id),
    invitationRepo.findPendingByOrg(id),
    organizationBillingRepo.findByOrg(id),
  ]);

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      <div>
        <Link
          href="/admin/organizations"
          className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 flex items-center gap-1 mb-2"
        >
          <span className="material-icons text-[16px]">arrow_back</span>
          Volver
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{org.name}</h1>
          <StatusBadge status={org.status} />
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {org.slug} · Creada {new Date(org.createdAt).toLocaleDateString()}
        </p>
      </div>

      <OrganizationDetailClient
        organization={{
          id: org.id,
          name: org.name,
          status: org.status,
          maxProperties: org.maxProperties,
          maxUsers: org.maxUsers,
          suspendedAt: org.suspendedAt?.toISOString() ?? null,
          suspendedReason: org.suspendedReason ?? null,
        }}
        usage={usage}
        properties={propertiesList.map((p) => ({
          id: p.id,
          name: p.name,
          code: p.code,
          plan: p.plan,
          maxUnits: p.maxUnits,
          unitCount: p.unitCount,
        }))}
        pendingInvitations={pendingInvitations.map((inv) => ({
          id: inv.id,
          email: inv.email,
          role: inv.role,
          token: inv.token,
          expiresAt: inv.expiresAt.toISOString(),
        }))}
        billing={{
          legalName: billing?.legalName ?? '',
          taxId: billing?.taxId ?? '',
          addressLine1: billing?.addressLine1 ?? '',
          addressLine2: billing?.addressLine2 ?? '',
          postalCode: billing?.postalCode ?? '',
          city: billing?.city ?? '',
          state: billing?.state ?? '',
          country: billing?.country ?? 'ES',
          billingEmail: billing?.billingEmail ?? '',
          stripeCustomerId: billing?.stripeCustomerId ?? null,
        }}
      />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'suspended') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300">
        <span className="w-1.5 h-1.5 rounded-full bg-red-600 dark:bg-red-400" />
        Suspendida
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400" />
      Activa
    </span>
  );
}
