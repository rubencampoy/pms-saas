'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { AirbnbOnboarding } from '@/components/settings/airbnb-onboarding';
import {
  saveIntegrationConfig,
  validateConnection,
  saveRoomTypeMappings,
  saveRatePlanMappings,
  toggleIntegration,
  triggerFullSync,
  getIntegrationLogs,
  provisionChannelContent,
} from '@/server/actions/integrations';
import type { CMConfig, ExternalRoomType, ExternalRatePlan } from '@/lib/channel-manager/types';

interface Integration {
  id: string;
  provider: string;
  isActive: boolean;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  webhookToken: string;
}

interface RoomTypeMapping {
  id: string;
  roomTypeId: string;
  externalRoomTypeId: string;
  externalRoomTypeName: string;
}

interface RatePlanMapping {
  id: string;
  ratePlanId: string;
  externalRatePlanId: string;
  externalRatePlanName: string;
}

interface LocalRoomType {
  id: string;
  name: string;
  code: string;
}

interface LocalRatePlan {
  id: string;
  name: string;
  code: string;
}

interface PropertyIntegration {
  property: { id: string; name: string; code: string };
  integration: Integration | null;
  decryptedCredentials: CMConfig | null;
  roomTypeMappings: RoomTypeMapping[];
  ratePlanMappings: RatePlanMapping[];
  localRoomTypes: LocalRoomType[];
  localRatePlans: LocalRatePlan[];
  airbnbHost?: {
    id: string;
    hostStatus: string;
    hostStatusCode: string | null;
    oauthCompletedAt: string | null;
  } | null;
  airbnbListings?: Array<{
    id: string;
    airbnbListingId: string;
    listingName: string | null;
    propertyType: string | null;
    isActivated: boolean;
    roomTypeId: string | null;
    propertyId: string | null;
  }>;
}

interface LogEntry {
  id: string;
  direction: string;
  action: string;
  status: string;
  errorMessage: string | null;
  durationMs: number | null;
  createdAt: Date;
}

interface Props {
  propertyIntegrations: PropertyIntegration[];
}

export function ChannelsClient({ propertyIntegrations }: Props) {
  const t = useTranslations('channels');
  const tc = useTranslations('common');

  const [selectedPropertyIdx, setSelectedPropertyIdx] = useState(0);
  const current = propertyIntegrations[selectedPropertyIdx]!;

  // Form state
  const [apiUser, setApiUser] = useState(current.decryptedCredentials?.apiUser ?? '');
  const [apiPassword, setApiPassword] = useState(current.decryptedCredentials?.apiPassword ?? '');
  const [ccPassword, setCcPassword] = useState(current.decryptedCredentials?.ccPassword ?? '');
  const [hotelId, setHotelId] = useState(current.decryptedCredentials?.hotelId ?? '');
  const [endpointUrl, setEndpointUrl] = useState(current.decryptedCredentials?.endpointUrl ?? '');
  const [accessType, setAccessType] = useState<'api_call' | 'webhook'>(current.decryptedCredentials?.accessType ?? 'webhook');
  const [zodomusWebhookUrl, setZodomusWebhookUrl] = useState(current.decryptedCredentials?.zodomusWebhookUrl ?? '');
  const [zodomusWebhookKey, setZodomusWebhookKey] = useState(current.decryptedCredentials?.zodomusWebhookKey ?? '');
  const [airbnbWebhookUrl, setAirbnbWebhookUrl] = useState(current.decryptedCredentials?.airbnbWebhookUrl ?? '');
  const [airbnbWebhookKey, setAirbnbWebhookKey] = useState(current.decryptedCredentials?.airbnbWebhookKey ?? '');
  const [isTestMode, setIsTestMode] = useState(current.decryptedCredentials?.isTestMode === true);

  // Status
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [provisioning, setProvisioning] = useState(false);
  const [provisionResult, setProvisionResult] = useState<{ success: boolean; message: string; details?: string } | null>(null);
  const [showProvisionDetails, setShowProvisionDetails] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // External entities — reconstructed from saved mappings on load, refreshed by Test Connection
  const [externalRoomTypes, setExternalRoomTypes] = useState<ExternalRoomType[]>(() => {
    const map = new Map<string, ExternalRoomType>();
    for (const m of current.roomTypeMappings) {
      if (m.externalRoomTypeId && !map.has(m.externalRoomTypeId)) {
        map.set(m.externalRoomTypeId, { id: m.externalRoomTypeId, name: m.externalRoomTypeName || m.externalRoomTypeId });
      }
    }
    return Array.from(map.values());
  });
  const [externalRatePlans, setExternalRatePlans] = useState<ExternalRatePlan[]>(() => {
    const map = new Map<string, ExternalRatePlan>();
    for (const m of current.ratePlanMappings) {
      if (m.externalRatePlanId && !map.has(m.externalRatePlanId)) {
        map.set(m.externalRatePlanId, { id: m.externalRatePlanId, name: m.externalRatePlanName || m.externalRatePlanId, roomTypeId: '' });
      }
    }
    return Array.from(map.values());
  });

  // Mapping state
  const [rtMappings, setRtMappings] = useState<Record<string, { externalId: string; externalName: string }>>(
    () => {
      const map: Record<string, { externalId: string; externalName: string }> = {};
      for (const m of current.roomTypeMappings) {
        map[m.roomTypeId] = { externalId: m.externalRoomTypeId, externalName: m.externalRoomTypeName };
      }
      return map;
    },
  );

  const [rpMappings, setRpMappings] = useState<Record<string, { externalId: string; externalName: string }>>(
    () => {
      const map: Record<string, { externalId: string; externalName: string }> = {};
      for (const m of current.ratePlanMappings) {
        map[m.ratePlanId] = { externalId: m.externalRatePlanId, externalName: m.externalRatePlanName };
      }
      return map;
    },
  );

  // Logs
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logsPage, setLogsPage] = useState(0);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logFilter, setLogFilter] = useState<{ direction?: string; status?: string }>({});

  const handlePropertyChange = useCallback(
    (idx: number) => {
      setSelectedPropertyIdx(idx);
      const pi = propertyIntegrations[idx]!;
      setApiUser(pi.decryptedCredentials?.apiUser ?? '');
      setApiPassword(pi.decryptedCredentials?.apiPassword ?? '');
      setCcPassword(pi.decryptedCredentials?.ccPassword ?? '');
      setHotelId(pi.decryptedCredentials?.hotelId ?? '');
      setEndpointUrl(pi.decryptedCredentials?.endpointUrl ?? '');
      setAccessType(pi.decryptedCredentials?.accessType ?? 'webhook');
      setZodomusWebhookUrl(pi.decryptedCredentials?.zodomusWebhookUrl ?? '');
      setZodomusWebhookKey(pi.decryptedCredentials?.zodomusWebhookKey ?? '');
      setAirbnbWebhookUrl(pi.decryptedCredentials?.airbnbWebhookUrl ?? '');
      setAirbnbWebhookKey(pi.decryptedCredentials?.airbnbWebhookKey ?? '');
      setIsTestMode(pi.decryptedCredentials?.isTestMode === true);
      setTestResult(null);
      setMessage(null);

      // Reconstruct external entities from saved mappings
      const extRooms = new Map<string, ExternalRoomType>();
      for (const m of pi.roomTypeMappings) {
        if (m.externalRoomTypeId && !extRooms.has(m.externalRoomTypeId)) {
          extRooms.set(m.externalRoomTypeId, { id: m.externalRoomTypeId, name: m.externalRoomTypeName || m.externalRoomTypeId });
        }
      }
      setExternalRoomTypes(Array.from(extRooms.values()));

      const extRates = new Map<string, ExternalRatePlan>();
      for (const m of pi.ratePlanMappings) {
        if (m.externalRatePlanId && !extRates.has(m.externalRatePlanId)) {
          extRates.set(m.externalRatePlanId, { id: m.externalRatePlanId, name: m.externalRatePlanName || m.externalRatePlanId, roomTypeId: '' });
        }
      }
      setExternalRatePlans(Array.from(extRates.values()));

      const rtMap: Record<string, { externalId: string; externalName: string }> = {};
      for (const m of pi.roomTypeMappings) {
        rtMap[m.roomTypeId] = { externalId: m.externalRoomTypeId, externalName: m.externalRoomTypeName };
      }
      setRtMappings(rtMap);

      const rpMap: Record<string, { externalId: string; externalName: string }> = {};
      for (const m of pi.ratePlanMappings) {
        rpMap[m.ratePlanId] = { externalId: m.externalRatePlanId, externalName: m.externalRatePlanName };
      }
      setRpMappings(rpMap);
      setLogs([]);
      setLogsTotal(0);
      setLogsPage(0);
    },
    [propertyIntegrations],
  );

  const buildCredentials = () => ({
    apiUser,
    apiPassword,
    ccPassword: ccPassword || undefined,
    hotelId,
    endpointUrl,
    accessType,
    isTestMode,
    zodomusWebhookUrl: zodomusWebhookUrl || undefined,
    zodomusWebhookKey: zodomusWebhookKey || undefined,
    airbnbWebhookUrl: airbnbWebhookUrl || undefined,
    airbnbWebhookKey: airbnbWebhookKey || undefined,
  });

  const canSave = apiUser && apiPassword && hotelId && endpointUrl;

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);

    const result = await validateConnection({
      propertyId: current.property.id,
      provider: 'zodomus' as const,
      credentials: buildCredentials(),
    });

    if (result.success) {
      setTestResult({ success: true, message: `${t('connected')}${result.data.hotelName ? ` — ${result.data.hotelName}` : ''}` });
      setExternalRoomTypes(result.data.roomTypes);
      setExternalRatePlans(result.data.ratePlans);
    } else {
      setTestResult({ success: false, message: result.error });
    }
    setTesting(false);
  };

  const handleSaveConfig = async () => {
    setSaving(true);
    setMessage(null);

    const result = await saveIntegrationConfig({
      propertyId: current.property.id,
      provider: 'zodomus' as const,
      credentials: buildCredentials(),
    });

    if (result.success) {
      setMessage({ type: 'success', text: t('configSaved') });
    } else {
      setMessage({ type: 'error', text: result.error });
    }
    setSaving(false);
  };

  const handleToggle = async () => {
    if (!current.integration) return;
    const result = await toggleIntegration({
      integrationId: current.integration.id,
      isActive: !current.integration.isActive,
    });
    if (!result.success) {
      setMessage({ type: 'error', text: result.error });
    }
  };

  const handleSaveRoomTypeMappings = async () => {
    if (!current.integration) return;
    setSaving(true);

    const mappings = Object.entries(rtMappings)
      .filter(([, v]) => v.externalId)
      .map(([roomTypeId, v]) => ({
        roomTypeId,
        externalRoomTypeId: v.externalId,
        externalRoomTypeName: v.externalName,
      }));

    const result = await saveRoomTypeMappings({
      integrationId: current.integration.id,
      mappings,
    });

    if (result.success) {
      setMessage({ type: 'success', text: t('mappingsSaved') });
    } else {
      setMessage({ type: 'error', text: result.error });
    }
    setSaving(false);
  };

  const handleSaveRatePlanMappings = async () => {
    if (!current.integration) return;
    setSaving(true);

    const mappings = Object.entries(rpMappings)
      .filter(([, v]) => v.externalId)
      .map(([ratePlanId, v]) => {
        const extRp = externalRatePlans.find((rp) => rp.id === v.externalId);
        return {
          ratePlanId,
          externalRatePlanId: v.externalId,
          externalRatePlanName: v.externalName,
          externalRoomTypeId: extRp?.roomTypeId || undefined,
        };
      });

    const result = await saveRatePlanMappings({
      integrationId: current.integration.id,
      mappings,
    });

    if (result.success) {
      setMessage({ type: 'success', text: t('mappingsSaved') });
    } else {
      setMessage({ type: 'error', text: result.error });
    }
    setSaving(false);
  };

  const handleProvisionContent = async () => {
    if (!current.integration) return;
    setProvisioning(true);
    setProvisionResult(null);

    const result = await provisionChannelContent(
      current.integration.id,
      current.localRoomTypes.map((rt) => ({ id: rt.id, name: rt.name, code: rt.code })),
      current.localRatePlans.map((rp) => ({ name: rp.name, code: rp.code })),
    );

    if (result.success) {
      const data = result.data;
      const hasErrors = !!data.errorMessage;
      setProvisionResult({
        success: !hasErrors,
        message: hasErrors
          ? `${t('provisionSuccess', { rooms: data.roomsCreated, rates: data.ratesCreated })} — ${data.errorMessage}`
          : t('provisionSuccess', { rooms: data.roomsCreated, rates: data.ratesCreated }),
        details: data.details,
      });
      // After provisioning, re-fetch external entities so dropdowns update
      const creds = buildCredentials();
      const validateResult = await validateConnection({
        propertyId: current.property.id,
        provider: 'zodomus' as const,
        credentials: creds,
      });
      if (validateResult.success) {
        setExternalRoomTypes(validateResult.data.roomTypes);
        setExternalRatePlans(validateResult.data.ratePlans);
      }
    } else {
      setProvisionResult({ success: false, message: result.error });
    }
    setProvisioning(false);
  };

  const handleFullSync = async () => {
    if (!current.integration) return;
    setSyncing(true);

    const result = await triggerFullSync({ integrationId: current.integration.id });
    if (result.success) {
      setMessage({ type: 'success', text: t('syncTriggered') });
    } else {
      setMessage({ type: 'error', text: result.error });
    }
    setSyncing(false);
  };

  const loadLogs = async (page = 0) => {
    if (!current.integration) return;
    setLogsLoading(true);

    const result = await getIntegrationLogs({
      integrationId: current.integration.id,
      limit: 20,
      offset: page * 20,
      direction: logFilter.direction as 'inbound' | 'outbound' | undefined,
      status: logFilter.status as 'success' | 'error' | undefined,
    });

    if (result.success) {
      setLogs(result.data.logs as unknown as LogEntry[]);
      setLogsTotal(result.data.total);
      setLogsPage(page);
    }
    setLogsLoading(false);
  };

  const webhookUrl = current.integration
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/api/channel-manager/webhook/zodomus`
    : '';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{t('title')}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t('subtitle')}</p>
        </div>
      </div>

      {/* Property selector */}
      {propertyIntegrations.length > 1 && (
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {t('property')}
          </label>
          <select
            value={selectedPropertyIdx}
            onChange={(e) => handlePropertyChange(Number(e.target.value))}
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1a2632] text-sm px-3 py-2 text-slate-900 dark:text-white"
          >
            {propertyIntegrations.map((pi, idx) => (
              <option key={pi.property.id} value={idx}>
                {pi.property.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Message banner */}
      {message && (
        <div
          className={`rounded-lg px-4 py-3 text-sm font-medium ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
              : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Section 1: Connection Setup */}
      <div className="bg-white dark:bg-[#1a2632] rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="material-icons text-primary">cloud_sync</span>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t('connectionSetup')}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">{t('connectionDesc')}</p>
            </div>
          </div>
          {current.integration && (
            <button
              onClick={handleToggle}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                current.integration.isActive ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  current.integration.isActive ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          )}
        </div>

        {/* API Keys Section */}
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="material-icons text-sm text-slate-400">vpn_key</span>
            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('apiKeys')}</h4>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                {t('provider')}
              </label>
              <select
                disabled
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm px-3 py-2 text-slate-900 dark:text-white"
              >
                <option value="zodomus">Zodomus</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                {t('hotelId')}
              </label>
              <input
                type="text"
                value={hotelId}
                onChange={(e) => setHotelId(e.target.value)}
                placeholder={t('hotelIdPlaceholder')}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0d1b2a] text-sm px-3 py-2 text-slate-900 dark:text-white placeholder:text-slate-400"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                {t('endpointUrl')}
              </label>
              <input
                type="url"
                value={endpointUrl}
                onChange={(e) => setEndpointUrl(e.target.value)}
                placeholder={t('endpointUrlPlaceholder')}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0d1b2a] text-sm px-3 py-2 text-slate-900 dark:text-white placeholder:text-slate-400"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isTestMode"
                checked={isTestMode}
                onChange={(e) => setIsTestMode(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-[#137fec] focus:ring-[#137fec]"
              />
              <label htmlFor="isTestMode" className="text-sm text-slate-700 dark:text-slate-300">
                Test / Demo mode (Zodomus sandbox)
              </label>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                {t('apiUser')}
              </label>
              <input
                type="text"
                value={apiUser}
                onChange={(e) => setApiUser(e.target.value)}
                placeholder={t('apiUserPlaceholder')}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0d1b2a] text-sm px-3 py-2 text-slate-900 dark:text-white placeholder:text-slate-400"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                {t('apiPassword')}
              </label>
              <input
                type="password"
                value={apiPassword}
                onChange={(e) => setApiPassword(e.target.value)}
                placeholder={t('apiPasswordPlaceholder')}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0d1b2a] text-sm px-3 py-2 text-slate-900 dark:text-white placeholder:text-slate-400"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                {t('ccPassword')}
              </label>
              <input
                type="password"
                value={ccPassword}
                onChange={(e) => setCcPassword(e.target.value)}
                placeholder={t('ccPasswordPlaceholder')}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0d1b2a] text-sm px-3 py-2 text-slate-900 dark:text-white placeholder:text-slate-400"
              />
              <p className="text-xs text-slate-400 mt-1">{t('ccPasswordHint')}</p>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-slate-200 dark:border-slate-700 my-5" />

        {/* Access Type Section */}
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="material-icons text-sm text-slate-400">settings_ethernet</span>
            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('accessType')}</h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            <button
              type="button"
              onClick={() => setAccessType('api_call')}
              className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors ${
                accessType === 'api_call'
                  ? 'border-[#137fec] bg-blue-50 dark:bg-blue-900/20'
                  : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <span className={`material-icons text-lg ${accessType === 'api_call' ? 'text-[#137fec]' : 'text-slate-400'}`}>
                api
              </span>
              <div>
                <div className={`text-sm font-medium ${accessType === 'api_call' ? 'text-[#137fec]' : 'text-slate-700 dark:text-slate-300'}`}>
                  {t('accessApiCall')}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">{t('accessApiCallDesc')}</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setAccessType('webhook')}
              className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors ${
                accessType === 'webhook'
                  ? 'border-[#137fec] bg-blue-50 dark:bg-blue-900/20'
                  : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <span className={`material-icons text-lg ${accessType === 'webhook' ? 'text-[#137fec]' : 'text-slate-400'}`}>
                webhook
              </span>
              <div>
                <div className={`text-sm font-medium ${accessType === 'webhook' ? 'text-[#137fec]' : 'text-slate-700 dark:text-slate-300'}`}>
                  {t('accessWebhook')}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">{t('accessWebhookDesc')}</div>
              </div>
            </button>
          </div>

          {accessType === 'webhook' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pl-1">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  {t('zodomusWebhookUrl')}
                </label>
                <input
                  type="url"
                  value={zodomusWebhookUrl}
                  onChange={(e) => setZodomusWebhookUrl(e.target.value)}
                  placeholder={t('zodomusWebhookUrlPlaceholder')}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0d1b2a] text-sm px-3 py-2 text-slate-900 dark:text-white placeholder:text-slate-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  {t('zodomusWebhookKey')}
                </label>
                <input
                  type="text"
                  value={zodomusWebhookKey}
                  onChange={(e) => setZodomusWebhookKey(e.target.value)}
                  placeholder={t('zodomusWebhookKeyPlaceholder')}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0d1b2a] text-sm px-3 py-2 text-slate-900 dark:text-white placeholder:text-slate-400"
                />
              </div>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="border-t border-slate-200 dark:border-slate-700 my-5" />

        {/* Airbnb Webhook Section */}
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="material-icons text-sm text-slate-400">house</span>
            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('airbnbWebhook')}</h4>
            <span className="text-xs text-slate-400 ml-1">{t('optional')}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                {t('airbnbWebhookUrlLabel')}
              </label>
              <input
                type="url"
                value={airbnbWebhookUrl}
                onChange={(e) => setAirbnbWebhookUrl(e.target.value)}
                placeholder={t('airbnbWebhookUrlPlaceholder')}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0d1b2a] text-sm px-3 py-2 text-slate-900 dark:text-white placeholder:text-slate-400"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                {t('airbnbWebhookKeyLabel')}
              </label>
              <input
                type="text"
                value={airbnbWebhookKey}
                onChange={(e) => setAirbnbWebhookKey(e.target.value)}
                placeholder={t('airbnbWebhookKeyPlaceholder')}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0d1b2a] text-sm px-3 py-2 text-slate-900 dark:text-white placeholder:text-slate-400"
              />
            </div>
          </div>
        </div>

        {/* Chamelio PMS Webhook URL (read-only — for inbound reservations) */}
        {current.integration && (
          <div className="mb-1">
            <div className="border-t border-slate-200 dark:border-slate-700 my-5" />
            <div className="flex items-center gap-2 mb-3">
              <span className="material-icons text-sm text-slate-400">link</span>
              <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('inboundWebhook')}</h4>
            </div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
              {t('webhookUrl')}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={webhookUrl}
                className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm px-3 py-2 text-slate-500 dark:text-slate-400"
              />
              <span className="text-xs text-slate-400">
                Token: {current.integration.webhookToken.slice(0, 8)}...
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">{t('inboundWebhookHint')}</p>
          </div>
        )}

        {/* Test result */}
        {testResult && (
          <div
            className={`mt-4 rounded-lg px-4 py-2 text-sm ${
              testResult.success
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
                : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
            }`}
          >
            <span className="material-icons text-sm align-middle mr-1">
              {testResult.success ? 'check_circle' : 'error'}
            </span>
            {testResult.message}
          </div>
        )}

        {/* Last sync info */}
        {current.integration?.lastSyncAt && (
          <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            {t('lastSync')}: {new Date(current.integration.lastSyncAt).toLocaleString()}{' '}
            <span
              className={`inline-flex items-center gap-1 ${
                current.integration.lastSyncStatus === 'success' ? 'text-emerald-600' : 'text-red-500'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current" />
              {current.integration.lastSyncStatus}
            </span>
          </div>
        )}

        <div className="flex items-center gap-3 mt-5">
          <button
            onClick={handleTestConnection}
            disabled={testing || !canSave}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors"
          >
            <span className="material-icons text-sm">{testing ? 'hourglass_top' : 'wifi_tethering'}</span>
            {testing ? t('testing') : t('testConnection')}
          </button>
          <button
            onClick={handleSaveConfig}
            disabled={saving || !canSave}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-[#137fec] text-white hover:bg-[#1171d4] disabled:opacity-50 transition-colors"
          >
            <span className="material-icons text-sm">save</span>
            {saving ? t('saving') : tc('save')}
          </button>
        </div>
      </div>

      {/* Section 2: Room Type Mapping */}
      {current.integration && (
        <div className="bg-white dark:bg-[#1a2632] rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="material-icons text-primary">meeting_room</span>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t('roomTypeMapping')}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">{t('roomTypeMappingDesc')}</p>
              </div>
            </div>

            {/* Provision button — always visible so content can be re-provisioned */}
            <button
              onClick={handleProvisionContent}
              disabled={provisioning}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 transition-colors"
            >
              <span className="material-icons text-sm">{provisioning ? 'hourglass_top' : 'cloud_upload'}</span>
              {provisioning ? t('provisioning') : t('provisionContent')}
            </button>
          </div>

          {/* Provision result message */}
          {provisionResult && (
            <div className="mb-4">
              <div
                className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm ${
                  provisionResult.success
                    ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
                    : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                }`}
              >
                <span className="material-icons text-sm">
                  {provisionResult.success ? 'check_circle' : 'error'}
                </span>
                <span className="flex-1">{provisionResult.message}</span>
                {provisionResult.details && (
                  <button
                    onClick={() => setShowProvisionDetails((prev) => !prev)}
                    className="ml-2 text-xs underline opacity-70 hover:opacity-100"
                  >
                    {showProvisionDetails ? t('hideDetails') : t('showDetails')}
                  </button>
                )}
              </div>
              {showProvisionDetails && provisionResult.details && (
                <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-slate-900 text-slate-200 text-xs p-3 font-mono whitespace-pre-wrap">
                  {provisionResult.details}
                </pre>
              )}
            </div>
          )}

          {/* Empty state — no external rooms to map */}
          {externalRoomTypes.length === 0 && !provisionResult && (
            <div className="text-center py-8 text-sm text-slate-400 dark:text-slate-500">
              <span className="material-icons text-3xl mb-2 block">cloud_off</span>
              {t('noExternalRooms')}
            </div>
          )}

          {externalRoomTypes.length > 0 && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700">
                      <th className="text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 py-2 px-3 bg-slate-50 dark:bg-slate-800/50">
                        Chamelio PMS
                      </th>
                      <th className="text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 py-2 px-3 bg-slate-50 dark:bg-slate-800/50">
                        {t('externalRoomType')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {current.localRoomTypes.map((rt) => (
                      <tr key={rt.id} className="border-b border-slate-100 dark:border-slate-700/50">
                        <td className="py-2.5 px-3 text-sm text-slate-900 dark:text-white">
                          {rt.name} <span className="text-slate-400">({rt.code})</span>
                        </td>
                        <td className="py-2.5 px-3">
                          <select
                            value={rtMappings[rt.id]?.externalId ?? ''}
                            onChange={(e) => {
                              const ext = externalRoomTypes.find((x) => x.id === e.target.value);
                              setRtMappings((prev) => ({
                                ...prev,
                                [rt.id]: {
                                  externalId: e.target.value,
                                  externalName: ext?.name ?? e.target.value,
                                },
                              }));
                            }}
                            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0d1b2a] text-sm px-3 py-1.5 text-slate-900 dark:text-white"
                          >
                            <option value="">{t('selectMapping')}</option>
                            {externalRoomTypes.map((ext) => (
                              <option key={ext.id} value={ext.id}>
                                {ext.name} ({ext.id})
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button
                onClick={handleSaveRoomTypeMappings}
                disabled={saving}
                className="mt-4 flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-[#137fec] text-white hover:bg-[#1171d4] disabled:opacity-50 transition-colors"
              >
                <span className="material-icons text-sm">save</span>
                {t('saveMappings')}
              </button>
            </>
          )}
        </div>
      )}

      {/* Section 3: Rate Plan Mapping */}
      {current.integration && (
        <div className="bg-white dark:bg-[#1a2632] rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-5">
          <div className="flex items-center gap-3 mb-4">
            <span className="material-icons text-primary">paid</span>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t('ratePlanMapping')}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">{t('ratePlanMappingDesc')}</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 py-2 px-3 bg-slate-50 dark:bg-slate-800/50">
                    Chamelio PMS
                  </th>
                  <th className="text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 py-2 px-3 bg-slate-50 dark:bg-slate-800/50">
                    {t('externalRatePlan')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {current.localRatePlans.map((rp) => (
                  <tr key={rp.id} className="border-b border-slate-100 dark:border-slate-700/50">
                    <td className="py-2.5 px-3 text-sm text-slate-900 dark:text-white">
                      {rp.name} <span className="text-slate-400">({rp.code})</span>
                    </td>
                    <td className="py-2.5 px-3">
                      <select
                        value={rpMappings[rp.id]?.externalId ?? ''}
                        onChange={(e) => {
                          const ext = externalRatePlans.find((x) => x.id === e.target.value);
                          setRpMappings((prev) => ({
                            ...prev,
                            [rp.id]: {
                              externalId: e.target.value,
                              externalName: ext?.name ?? e.target.value,
                            },
                          }));
                        }}
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0d1b2a] text-sm px-3 py-1.5 text-slate-900 dark:text-white"
                      >
                        <option value="">{t('selectMapping')}</option>
                        {externalRatePlans.map((ext) => (
                          <option key={ext.id} value={ext.id}>
                            {ext.name} ({ext.id})
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            onClick={handleSaveRatePlanMappings}
            disabled={saving}
            className="mt-4 flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-[#137fec] text-white hover:bg-[#1171d4] disabled:opacity-50 transition-colors"
          >
            <span className="material-icons text-sm">save</span>
            {t('saveMappings')}
          </button>
        </div>
      )}

      {/* Section 4: Sync Logs */}
      {current.integration && (
        <div className="bg-white dark:bg-[#1a2632] rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="material-icons text-primary">history</span>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t('syncLogs')}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">{t('syncLogsDesc')}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleFullSync}
                disabled={syncing}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-[#137fec] text-white hover:bg-[#1171d4] disabled:opacity-50 transition-colors"
              >
                <span className="material-icons text-sm">{syncing ? 'hourglass_top' : 'sync'}</span>
                {syncing ? t('syncing') : t('fullSync')}
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-3 mb-4">
            <select
              value={logFilter.direction ?? ''}
              onChange={(e) => setLogFilter((prev) => ({ ...prev, direction: e.target.value || undefined }))}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0d1b2a] text-sm px-3 py-1.5 text-slate-900 dark:text-white"
            >
              <option value="">{t('allDirections')}</option>
              <option value="inbound">{t('inbound')}</option>
              <option value="outbound">{t('outbound')}</option>
            </select>
            <select
              value={logFilter.status ?? ''}
              onChange={(e) => setLogFilter((prev) => ({ ...prev, status: e.target.value || undefined }))}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0d1b2a] text-sm px-3 py-1.5 text-slate-900 dark:text-white"
            >
              <option value="">{t('allStatuses')}</option>
              <option value="success">{t('statusSuccess')}</option>
              <option value="error">{t('statusError')}</option>
            </select>
            <button
              onClick={() => loadLogs(0)}
              disabled={logsLoading}
              className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <span className="material-icons text-sm">refresh</span>
              {t('loadLogs')}
            </button>
          </div>

          {/* Log table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 py-2 px-3 bg-slate-50 dark:bg-slate-800/50">
                    {t('logTimestamp')}
                  </th>
                  <th className="text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 py-2 px-3 bg-slate-50 dark:bg-slate-800/50">
                    {t('logDirection')}
                  </th>
                  <th className="text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 py-2 px-3 bg-slate-50 dark:bg-slate-800/50">
                    {t('logAction')}
                  </th>
                  <th className="text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 py-2 px-3 bg-slate-50 dark:bg-slate-800/50">
                    {t('logStatus')}
                  </th>
                  <th className="text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 py-2 px-3 bg-slate-50 dark:bg-slate-800/50">
                    {t('logDuration')}
                  </th>
                  <th className="text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 py-2 px-3 bg-slate-50 dark:bg-slate-800/50">
                    {t('logError')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-sm text-slate-400">
                      {t('noLogs')}
                    </td>
                  </tr>
                )}
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800/30">
                    <td className="py-2 px-3 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="py-2 px-3">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium ${
                        log.direction === 'inbound' ? 'text-blue-600 dark:text-blue-400' : 'text-amber-600 dark:text-amber-400'
                      }`}>
                        <span className="material-icons text-xs">
                          {log.direction === 'inbound' ? 'arrow_downward' : 'arrow_upward'}
                        </span>
                        {log.direction}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-sm text-slate-900 dark:text-white">
                      {log.action.replace(/_/g, ' ')}
                    </td>
                    <td className="py-2 px-3">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                        log.status === 'success'
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
                          : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                      }`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        {log.status}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                      {log.durationMs ? `${log.durationMs}ms` : '—'}
                    </td>
                    <td className="py-2 px-3 text-xs text-red-500 max-w-[200px] truncate">
                      {log.errorMessage ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {logsTotal > 20 && (
            <div className="flex items-center justify-between mt-4">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {t('showingLogs', { from: logsPage * 20 + 1, to: Math.min((logsPage + 1) * 20, logsTotal), total: logsTotal })}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => loadLogs(logsPage - 1)}
                  disabled={logsPage === 0 || logsLoading}
                  className="px-3 py-1 text-sm rounded border border-slate-200 dark:border-slate-700 disabled:opacity-50"
                >
                  {t('prev')}
                </button>
                <button
                  onClick={() => loadLogs(logsPage + 1)}
                  disabled={(logsPage + 1) * 20 >= logsTotal || logsLoading}
                  className="px-3 py-1 text-sm rounded border border-slate-200 dark:border-slate-700 disabled:opacity-50"
                >
                  {t('next')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Airbnb Integration ── */}
      {current.integration && (
        <AirbnbOnboarding
          integrationId={current.integration.id}
          propertyId={current.property.id}
          airbnbHost={current.airbnbHost ?? null}
          airbnbListings={current.airbnbListings ?? []}
          localRoomTypes={current.localRoomTypes.map((rt) => ({ id: rt.id, name: rt.name }))}
        />
      )}
    </div>
  );
}
