import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { propertyRepo } from '@/server/repositories/property.repo';
import { getClientIp } from '@/lib/security/ip-guard';
import { IpRestrictionClient } from '@/components/settings/ip-restriction-client';

export default async function SecuritySettingsPage() {
  const session = await auth();
  if (!session) redirect('/login');

  const orgId = session.user.organizationId;
  const canManage = ['owner', 'admin'].includes(session.user.role);

  const [propertiesList, currentIp] = await Promise.all([
    propertyRepo.findIpSettingsByOrg(orgId),
    getClientIp(),
  ]);

  return (
    <IpRestrictionClient
      properties={propertiesList.map((p) => ({
        id: p.id,
        name: p.name,
        code: p.code,
        ipRestrictionEnabled: p.ipRestrictionEnabled,
        allowedIps: p.allowedIps ?? [],
      }))}
      currentIp={currentIp}
      canManage={canManage}
    />
  );
}
