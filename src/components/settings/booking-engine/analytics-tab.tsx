'use client';

import { useTranslations } from 'next-intl';
import type { BookingEngineFormData } from './booking-engine-client';

interface AnalyticsTabProps {
  data: BookingEngineFormData;
  onChange: <K extends keyof BookingEngineFormData>(key: K, value: BookingEngineFormData[K]) => void;
  onSave: () => void;
  isPending: boolean;
}

export function AnalyticsTab({ data, onChange, onSave, isPending }: AnalyticsTabProps) {
  const t = useTranslations('bookingEngine.analytics');
  const tRoot = useTranslations('bookingEngine');

  return (
    <div className="max-w-3xl space-y-6">

      {/* Platform selector */}
      <div className="bg-white dark:bg-[#1a2632] rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">{t('platform.title')}</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">{t('platform.description')}</p>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => onChange('analyticsPlatform', 'ga4')}
            className={`relative flex flex-col items-center gap-3 p-5 rounded-xl border-2 cursor-pointer transition-all hover:shadow-md ${
              data.analyticsPlatform === 'ga4'
                ? 'border-primary bg-primary/5 dark:bg-primary/10'
                : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
            }`}
          >
            {data.analyticsPlatform === 'ga4' && (
              <div className="absolute top-3 right-3">
                <span className="material-icons text-primary text-lg">check_circle</span>
              </div>
            )}
            <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <span className="material-icons text-amber-600 dark:text-amber-400">analytics</span>
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{t('platform.ga4')}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t('platform.ga4Desc')}</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onChange('analyticsPlatform', 'gtm')}
            className={`relative flex flex-col items-center gap-3 p-5 rounded-xl border-2 cursor-pointer transition-all hover:shadow-md ${
              data.analyticsPlatform === 'gtm'
                ? 'border-primary bg-primary/5 dark:bg-primary/10'
                : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
            }`}
          >
            {data.analyticsPlatform === 'gtm' && (
              <div className="absolute top-3 right-3">
                <span className="material-icons text-primary text-lg">check_circle</span>
              </div>
            )}
            <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <span className="material-icons text-blue-600 dark:text-blue-400">code</span>
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{t('platform.gtm')}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t('platform.gtmDesc')}</p>
            </div>
          </button>
        </div>
      </div>

      {/* Google Analytics */}
      <div className="bg-white dark:bg-[#1a2632] rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400">
            <span className="material-icons text-xl">analytics</span>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{t('ga.title')}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">{t('ga.description')}</p>
          </div>
        </div>
        <div className="space-y-5">
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-2">
              {t('ga.trackingId')}
              <button type="button" className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300" title={t('ga.trackingIdTooltip')}>
                <span className="material-icons text-base">info_outline</span>
              </button>
            </label>
            <input type="text" value={data.gaTrackingId} onChange={(e) => onChange('gaTrackingId', e.target.value)} placeholder={t('ga.trackingIdPlaceholder')} className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm px-4 py-2.5 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none placeholder:text-slate-400 font-mono text-slate-900 dark:text-white" />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-2">
              {t('ga.domain')}
              <button type="button" className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300" title={t('ga.domainTooltip')}>
                <span className="material-icons text-base">info_outline</span>
              </button>
            </label>
            <input type="text" value={data.gaDomain} onChange={(e) => onChange('gaDomain', e.target.value)} placeholder={t('ga.domainPlaceholder')} className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm px-4 py-2.5 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none placeholder:text-slate-400 text-slate-900 dark:text-white" />
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">{t('ga.domainHint')}</p>
          </div>
        </div>
      </div>

      {/* Google Ads */}
      <div className="bg-white dark:bg-[#1a2632] rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400">
            <span className="material-icons text-xl">ads_click</span>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{t('googleAds.title')}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">{t('googleAds.description')}</p>
          </div>
        </div>
        <div className="space-y-5">
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-2">
              {t('googleAds.conversionId')}
              <button type="button" className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300" title={t('googleAds.conversionIdTooltip')}>
                <span className="material-icons text-base">info_outline</span>
              </button>
            </label>
            <input type="text" value={data.googleAdsConversionId} onChange={(e) => onChange('googleAdsConversionId', e.target.value)} placeholder={t('googleAds.conversionIdPlaceholder')} className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm px-4 py-2.5 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none placeholder:text-slate-400 font-mono text-slate-900 dark:text-white" />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">{t('googleAds.conversionLabel')}</label>
            <input type="text" value={data.googleAdsConversionLabel} onChange={(e) => onChange('googleAdsConversionLabel', e.target.value)} placeholder={t('googleAds.conversionLabelPlaceholder')} className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm px-4 py-2.5 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none placeholder:text-slate-400 font-mono text-slate-900 dark:text-white" />
          </div>
        </div>
      </div>

      {/* Facebook Pixel */}
      <div className="bg-white dark:bg-[#1a2632] rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400">
            <span className="material-icons text-xl">share</span>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{t('facebook.title')}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">{t('facebook.description')}</p>
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-2">
            {t('facebook.pixelId')}
            <button type="button" className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300" title={t('facebook.pixelIdTooltip')}>
              <span className="material-icons text-base">info_outline</span>
            </button>
          </label>
          <input type="text" value={data.facebookPixelId} onChange={(e) => onChange('facebookPixelId', e.target.value)} placeholder={t('facebook.pixelIdPlaceholder')} className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm px-4 py-2.5 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none placeholder:text-slate-400 font-mono text-slate-900 dark:text-white" />
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">{t('facebook.pixelIdHint')}</p>
        </div>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
        <span className="material-icons text-blue-600 dark:text-blue-400 text-xl mt-0.5">info</span>
        <div>
          <p className="text-sm font-medium text-blue-900 dark:text-blue-200">{t('eventsInfoTitle')}</p>
          <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">{t('eventsInfo')}</p>
        </div>
      </div>

      {/* Save bar */}
      <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-200 dark:border-slate-700">
        <button type="button" className="px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
          {tRoot('discard')}
        </button>
        <button type="button" onClick={onSave} disabled={isPending} className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors shadow-sm shadow-primary/30 disabled:opacity-50 disabled:cursor-not-allowed">
          <span className="material-icons text-lg">{isPending ? 'hourglass_empty' : 'save'}</span>
          {t('saveAnalytics')}
        </button>
      </div>
    </div>
  );
}
