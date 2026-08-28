'use client';

import { useState, useCallback, useTransition, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { SettingsTab } from './settings-tab';
import { AnalyticsTab } from './analytics-tab';
import { WidgetsTab } from './widgets-tab';
import { BrandingTab } from './branding-tab';
import { saveBookingEngineSettings } from '@/server/actions/booking-engine-settings';
import { DEFAULT_BRAND_COLOR } from '@/lib/validators/booking-engine-settings';
import { toast } from '@/lib/hooks/use-toast';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Property {
  id: string;
  name: string;
  code: string;
}

/** Shape that matches both DB row and local state */
export interface BookingEngineFormData {
  // Settings tab
  availabilityView: 'collapsed' | 'expanded';
  priceFormat: 'lowest_night' | 'total_stay';
  specificRoom: boolean;
  addonsDisplay: 'before' | 'after';
  guestFilter: 'full' | 'adults_children' | 'none';
  defaultAdults: number;
  showUnavailable: boolean;
  autoAssign: boolean;
  limitByType: boolean;
  showRestrictions: boolean;
  showRates: boolean;
  fieldPostalAddress: boolean;
  fieldNationality: boolean;
  fieldGender: boolean;
  fieldIdDocument: boolean;
  fieldCompany: boolean;
  fieldPhone: boolean;
  fieldArrivalTime: boolean;
  fieldTermsAndConditions: boolean;
  autoConfirmEmail: boolean;
  redirectConfirmation: boolean;
  redirectUrl: string;
  requireCvv: boolean;
  language: string;
  // Analytics tab
  analyticsPlatform: 'ga4' | 'gtm';
  gaTrackingId: string;
  gaDomain: string;
  googleAdsConversionId: string;
  googleAdsConversionLabel: string;
  facebookPixelId: string;
  // Branding tab
  brandDisplayName: string;
  brandPrimaryColor: string;
  brandLogoUrl: string;
  brandFaviconUrl: string;
  brandCoverImageUrl: string;
  brandHideChamelio: boolean;
  brandPrivacyUrl: string;
  brandTermsUrl: string;
  brandCookiesUrl: string;
  // Widgets tab
  widgetType: 'stacked' | 'horizontal' | 'floating' | 'bigButton' | 'smallButton' | 'overlay' | 'immersive';
  widgetLanguage: string;
  widgetOpenNewWindow: boolean;
}

const DEFAULT_FORM_DATA: BookingEngineFormData = {
  availabilityView: 'collapsed',
  priceFormat: 'lowest_night',
  specificRoom: false,
  addonsDisplay: 'before',
  guestFilter: 'full',
  defaultAdults: 2,
  showUnavailable: true,
  autoAssign: true,
  limitByType: false,
  showRestrictions: true,
  showRates: false,
  fieldPostalAddress: true,
  fieldNationality: true,
  fieldGender: false,
  fieldIdDocument: true,
  fieldCompany: false,
  fieldPhone: true,
  fieldArrivalTime: false,
  fieldTermsAndConditions: true,
  autoConfirmEmail: true,
  redirectConfirmation: false,
  redirectUrl: '',
  requireCvv: true,
  language: 'es',
  analyticsPlatform: 'ga4',
  gaTrackingId: '',
  gaDomain: '',
  googleAdsConversionId: '',
  googleAdsConversionLabel: '',
  facebookPixelId: '',
  brandDisplayName: '',
  brandPrimaryColor: DEFAULT_BRAND_COLOR,
  brandLogoUrl: '',
  brandFaviconUrl: '',
  brandCoverImageUrl: '',
  brandHideChamelio: false,
  brandPrivacyUrl: '',
  brandTermsUrl: '',
  brandCookiesUrl: '',
  widgetType: 'stacked',
  widgetLanguage: 'es',
  widgetOpenNewWindow: false,
};

type TabId = 'settings' | 'branding' | 'analytics' | 'widgets';

const TABS: { id: TabId; icon: string; tKey: string }[] = [
  { id: 'settings', icon: 'tune', tKey: 'settings' },
  { id: 'branding', icon: 'palette', tKey: 'branding' },
  { id: 'analytics', icon: 'analytics', tKey: 'analytics' },
  { id: 'widgets', icon: 'widgets', tKey: 'widgets' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function dbRowToFormData(row: Record<string, unknown>): BookingEngineFormData {
  const result = { ...DEFAULT_FORM_DATA };
  for (const key of Object.keys(DEFAULT_FORM_DATA) as (keyof BookingEngineFormData)[]) {
    if (key in row && row[key] !== null && row[key] !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (result as Record<string, unknown>)[key] = row[key] as any;
    }
  }
  return result;
}

// ─── Component ───────────────────────────────────────────────────────────────

interface BookingEngineClientProps {
  organizationSlug: string;
  properties: Property[];
  savedSettings: Record<string, Record<string, unknown> | null | undefined>;
}

export function BookingEngineClient({ organizationSlug, properties, savedSettings }: BookingEngineClientProps) {
  const t = useTranslations('bookingEngine');
  const [activeTab, setActiveTab] = useState<TabId>('settings');
  const [selectedPropertyId, setSelectedPropertyId] = useState(properties[0]?.id ?? '');
  const [isPending, startTransition] = useTransition();

  // Derive form data from saved settings (or defaults)
  const [formData, setFormData] = useState<BookingEngineFormData>(() => {
    const saved = savedSettings[selectedPropertyId];
    return saved ? dbRowToFormData(saved as Record<string, unknown>) : { ...DEFAULT_FORM_DATA };
  });

  // When property changes, load that property's settings
  useEffect(() => {
    const saved = savedSettings[selectedPropertyId];
    setFormData(saved ? dbRowToFormData(saved as Record<string, unknown>) : { ...DEFAULT_FORM_DATA });
  }, [selectedPropertyId, savedSettings]);

  const updateField = useCallback(<K extends keyof BookingEngineFormData>(key: K, value: BookingEngineFormData[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleSave = useCallback(() => {
    startTransition(async () => {
      const result = await saveBookingEngineSettings({
        propertyId: selectedPropertyId,
        ...formData,
      });
      if (result.success) {
        toast({ variant: 'success', title: t('saved') });
      } else {
        toast({ variant: 'error', title: result.error });
      }
    });
  }, [selectedPropertyId, formData, t]);

  const selectedProperty = properties.find((p) => p.id === selectedPropertyId);

  return (
    <div>
      {/* Page header */}
      <div className="mb-6">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">{t('title')}</h2>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{t('subtitle')}</p>
      </div>

      {/* Sub-tabs */}
      <div className="flex items-center gap-1 mb-6 border-b border-slate-200 dark:border-slate-700">
        {TABS.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap ${
                active
                  ? 'text-primary border-primary'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border-transparent hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              <span className={`material-icons text-lg ${active ? 'text-primary' : ''}`}>
                {tab.icon}
              </span>
              {t(`tabs.${tab.tKey}`)}
            </button>
          );
        })}
      </div>

      {/* Property selector */}
      <div className="flex items-center gap-3 mb-6">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('property')}:</span>
        <div className="relative">
          <select
            value={selectedPropertyId}
            onChange={(e) => setSelectedPropertyId(e.target.value)}
            className="appearance-none bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 pl-4 pr-10 py-2 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none cursor-pointer"
          >
            {properties.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <span className="material-icons absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 text-lg pointer-events-none">
            expand_more
          </span>
        </div>
      </div>

      {/* Tab content */}
      {activeTab === 'settings' && (
        <SettingsTab data={formData} onChange={updateField} onSave={handleSave} isPending={isPending} />
      )}
      {activeTab === 'branding' && (
        <BrandingTab
          data={formData}
          onChange={updateField}
          onSave={handleSave}
          isPending={isPending}
          propertyId={selectedPropertyId}
          propertyName={selectedProperty?.name ?? ''}
        />
      )}
      {activeTab === 'analytics' && (
        <AnalyticsTab data={formData} onChange={updateField} onSave={handleSave} isPending={isPending} />
      )}
      {activeTab === 'widgets' && (
        <WidgetsTab
          data={formData}
          onChange={updateField}
          organizationSlug={organizationSlug}
          propertyCode={selectedProperty?.code ?? ''}
        />
      )}
    </div>
  );
}
