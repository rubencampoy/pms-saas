'use client';

import { useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { ToggleSwitch } from '@/components/ui/toggle-switch';
import { toast } from '@/lib/hooks/use-toast';
import type { BookingEngineFormData } from './booking-engine-client';

// ─── Widget Types ────────────────────────────────────────────────────────────

type WidgetType = 'stacked' | 'horizontal' | 'floating' | 'bigButton' | 'smallButton' | 'overlay' | 'immersive';

const WIDGET_TYPES: { id: WidgetType; tKey: string }[] = [
  { id: 'stacked', tKey: 'stacked' },
  { id: 'horizontal', tKey: 'horizontal' },
  { id: 'floating', tKey: 'floating' },
  { id: 'bigButton', tKey: 'bigButton' },
  { id: 'smallButton', tKey: 'smallButton' },
  { id: 'overlay', tKey: 'overlay' },
  { id: 'immersive', tKey: 'immersive' },
];

const LANGUAGES = [
  { value: 'es', label: 'Español' },
  { value: 'en', label: 'English' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
  { value: 'it', label: 'Italiano' },
  { value: 'pt', label: 'Português' },
];

// ─── Widget Thumbnail ────────────────────────────────────────────────────────

function WidgetThumbnail({ type }: { type: WidgetType }) {
  switch (type) {
    case 'stacked':
      return (
        <div className="w-14 h-10 rounded-lg bg-slate-100 dark:bg-slate-700 flex flex-col items-center justify-center gap-0.5">
          <div className="w-10 h-1.5 rounded-full bg-primary/40" />
          <div className="w-10 h-1.5 rounded-full bg-primary/40" />
          <div className="w-6 h-2 rounded bg-primary mt-0.5" />
        </div>
      );
    case 'horizontal':
      return (
        <div className="w-14 h-10 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center gap-1">
          <div className="w-3 h-5 rounded bg-primary/30" />
          <div className="w-3 h-5 rounded bg-primary/30" />
          <div className="w-4 h-3 rounded bg-primary" />
        </div>
      );
    case 'floating':
      return (
        <div className="w-14 h-10 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-end justify-end p-1">
          <div className="w-6 h-6 rounded-full bg-primary shadow-md flex items-center justify-center">
            <span className="text-white text-[8px] font-bold">R</span>
          </div>
        </div>
      );
    case 'bigButton':
      return (
        <div className="w-14 h-10 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
          <div className="w-10 h-5 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-white text-[7px] font-bold">RESERVAR</span>
          </div>
        </div>
      );
    case 'smallButton':
      return (
        <div className="w-14 h-10 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
          <div className="w-7 h-3.5 rounded bg-primary flex items-center justify-center">
            <span className="text-white text-[6px] font-bold">Book</span>
          </div>
        </div>
      );
    case 'overlay':
      return (
        <div className="w-14 h-10 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
          <div className="w-10 h-7 rounded bg-white dark:bg-slate-600 shadow-md border border-slate-200 dark:border-slate-500 flex items-center justify-center">
            <div className="w-6 h-1.5 rounded-full bg-primary/40" />
          </div>
        </div>
      );
    case 'immersive':
      return (
        <div className="w-14 h-10 rounded-lg bg-gradient-to-br from-primary to-blue-700 flex items-center justify-center">
          <div className="w-8 h-5 rounded bg-white/20 flex flex-col items-center justify-center gap-0.5">
            <div className="w-5 h-1 rounded-full bg-white/50" />
            <div className="w-5 h-1 rounded-full bg-white/50" />
          </div>
        </div>
      );
  }
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface WidgetsTabProps {
  data: BookingEngineFormData;
  onChange: <K extends keyof BookingEngineFormData>(key: K, value: BookingEngineFormData[K]) => void;
  /** Slug de la organización — primer segmento de la ruta del motor de reservas */
  organizationSlug: string;
  /** Código exacto de la propiedad (case-sensitive: así se busca en BD) */
  propertyCode: string;
}

// ─── Main Component ──────────────────────────────────────────────────────────

const WIDGET_CDN_URL =
  process.env.NEXT_PUBLIC_WIDGET_CDN_URL ?? 'https://cdn.chamelioguest.com';
const BOOKING_URL = process.env.NEXT_PUBLIC_BOOKING_URL ?? 'https://book.chamelioguest.com';

export function WidgetsTab({ data, onChange, organizationSlug, propertyCode }: WidgetsTabProps) {
  const t = useTranslations('bookingEngine.widgets');
  const tPreview = useTranslations('bookingEngine.widgets.preview');

  const embedCode = useMemo(() => {
    return `<!-- Chamelio Booking Engine Widget -->
<div id="chamelioBE"
     data-org="${organizationSlug}"
     data-property="${propertyCode}"
     data-lang="${data.widgetLanguage}"
     data-type="${data.widgetType}"></div>
<script src="${WIDGET_CDN_URL}/widget.js"
        async></script>`;
  }, [organizationSlug, propertyCode, data.widgetLanguage, data.widgetType]);

  const directUrl = `${BOOKING_URL}/${organizationSlug}/${propertyCode}?lang=${data.widgetLanguage}`;

  /** Solo decorativo: simula el dominio del hotel en la vista previa del widget */
  const previewSlug = (organizationSlug || propertyCode || 'mi-hotel').toLowerCase();

  const handleCopyCode = useCallback(() => {
    navigator.clipboard.writeText(embedCode).then(() => {
      toast({ variant: 'success', title: t('embedCode.copied') });
    });
  }, [embedCode, t]);

  const handleCopyUrl = useCallback(() => {
    navigator.clipboard.writeText(directUrl).then(() => {
      toast({ variant: 'success', title: t('embedCode.copied') });
    });
  }, [directUrl, t]);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

      {/* LEFT COLUMN: Configuration */}
      <div className="space-y-6">

        {/* Widget Type Selector */}
        <div className="bg-white dark:bg-[#1a2632] rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">{t('type.title')}</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">{t('type.description')}</p>

          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {WIDGET_TYPES.map((wt) => {
              const active = data.widgetType === wt.id;
              return (
                <button
                  key={wt.id}
                  type="button"
                  onClick={() => onChange('widgetType', wt.id)}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                    active
                      ? 'border-primary bg-primary/5 dark:bg-primary/10 shadow-sm'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <WidgetThumbnail type={wt.id} />
                  <span className={`text-[11px] ${active ? 'font-semibold text-slate-900 dark:text-white' : 'font-medium text-slate-700 dark:text-slate-400'}`}>
                    {t(`type.${wt.tKey}`)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Widget Options */}
        <div className="bg-white dark:bg-[#1a2632] rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-5">{t('options.title')}</h3>
          <div className="space-y-5">
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">{t('options.language')}</label>
              <div className="relative max-w-xs">
                <select value={data.widgetLanguage} onChange={(e) => onChange('widgetLanguage', e.target.value)} className="appearance-none w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 pl-4 pr-10 py-2.5 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none cursor-pointer">
                  {LANGUAGES.map((lang) => (
                    <option key={lang.value} value={lang.value}>{lang.label}</option>
                  ))}
                </select>
                <span className="material-icons absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg pointer-events-none">expand_more</span>
              </div>
            </div>
            <div className="flex items-center justify-between py-2">
              <div>
                <span className="text-sm font-medium text-slate-900 dark:text-white">{t('options.openNewWindow')}</span>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t('options.openNewWindowDesc')}</p>
              </div>
              <ToggleSwitch checked={data.widgetOpenNewWindow} onChange={(v) => onChange('widgetOpenNewWindow', v)} />
            </div>
          </div>
        </div>

        {/* Embed Code */}
        <div className="bg-white dark:bg-[#1a2632] rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{t('embedCode.title')}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t('embedCode.description')}</p>
            </div>
            <button type="button" onClick={handleCopyCode} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary bg-primary/10 rounded-lg hover:bg-primary/20 transition-colors">
              <span className="material-icons text-sm">content_copy</span>
              {t('embedCode.copy')}
            </button>
          </div>
          <div className="bg-slate-900 dark:bg-slate-950 rounded-lg p-4 overflow-x-auto">
            <pre className="text-xs text-slate-300 leading-relaxed whitespace-pre font-mono">{embedCode}</pre>
          </div>
        </div>

        {/* Direct URL */}
        <div className="bg-white dark:bg-[#1a2632] rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">{t('directUrl.title')}</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">{t('directUrl.description')}</p>
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2.5 min-w-0">
              <span className="material-icons text-slate-400 text-lg mr-2">link</span>
              <span className="text-sm text-slate-700 dark:text-slate-300 truncate font-mono">{directUrl}</span>
            </div>
            <button type="button" onClick={handleCopyUrl} className="flex-shrink-0 flex items-center px-3 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
              <span className="material-icons text-lg">content_copy</span>
            </button>
            <a href={directUrl} target="_blank" rel="noopener noreferrer" className="flex-shrink-0 flex items-center px-3 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
              <span className="material-icons text-lg">open_in_new</span>
            </a>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: Live Preview */}
      <div className="space-y-6">
        <div className="bg-white dark:bg-[#1a2632] rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden sticky top-8">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/30">
            <div className="flex items-center gap-2">
              <span className="material-icons text-slate-500 dark:text-slate-400 text-lg">preview</span>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{tPreview('title')}</h3>
            </div>
            <div className="flex items-center gap-1.5">
              <button type="button" className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors" title="Desktop">
                <span className="material-icons text-lg">desktop_windows</span>
              </button>
              <button type="button" className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 transition-colors" title="Tablet">
                <span className="material-icons text-lg">tablet</span>
              </button>
              <button type="button" className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 transition-colors" title="Mobile">
                <span className="material-icons text-lg">phone_iphone</span>
              </button>
            </div>
          </div>

          <div className="bg-slate-100 dark:bg-slate-900 p-6">
            <div className="bg-white dark:bg-[#1a2632] rounded-xl shadow-lg overflow-hidden border border-slate-200 dark:border-slate-700">
              <div className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-2.5 flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-amber-400" />
                  <div className="w-3 h-3 rounded-full bg-green-400" />
                </div>
                <div className="flex-1 bg-white dark:bg-slate-900 rounded-md border border-slate-200 dark:border-slate-700 px-3 py-1 text-xs text-slate-500 dark:text-slate-400 truncate">
                  {previewSlug}.com
                </div>
              </div>

              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500" />
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300 capitalize">{previewSlug.replace(/-/g, ' ')}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700" />
                    <div className="w-10 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700" />
                    <div className="w-10 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700" />
                  </div>
                </div>

                <div className="w-full h-20 bg-gradient-to-r from-slate-200 to-slate-100 dark:from-slate-700 dark:to-slate-800 rounded-lg mb-6" />

                <div className="border-2 border-dashed border-primary/30 rounded-xl p-1 bg-primary/5 dark:bg-primary/10 relative">
                  <div className="absolute -top-3 left-4 px-2 py-0.5 bg-primary text-white text-[10px] font-bold rounded-full">WIDGET</div>
                  <div className="bg-white dark:bg-[#1a2632] rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-5">
                    <p className="text-sm font-bold text-slate-900 dark:text-white mb-4">{tPreview('bookNow')}</p>
                    <div className="flex gap-3 mb-4">
                      <div className="flex-1">
                        <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">{tPreview('checkIn')}</label>
                        <div className="flex items-center gap-2 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2">
                          <span className="material-icons text-primary text-lg">calendar_today</span>
                          <span className="text-sm font-medium text-slate-900 dark:text-white">19 feb 2026</span>
                        </div>
                      </div>
                      <div className="flex-1">
                        <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">{tPreview('checkOut')}</label>
                        <div className="flex items-center gap-2 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2">
                          <span className="material-icons text-primary text-lg">calendar_today</span>
                          <span className="text-sm font-medium text-slate-900 dark:text-white">22 feb 2026</span>
                        </div>
                      </div>
                    </div>
                    <div className="mb-4">
                      <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">{tPreview('guests')}</label>
                      <div className="flex items-center gap-2 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2">
                        <span className="material-icons text-primary text-lg">person</span>
                        <span className="text-sm font-medium text-slate-900 dark:text-white">{tPreview('adultsCount', { count: 2 })}</span>
                        <span className="material-icons text-slate-400 text-lg ml-auto">expand_more</span>
                      </div>
                    </div>
                    <button type="button" className="w-full py-2.5 bg-primary text-white text-sm font-semibold rounded-lg shadow-sm shadow-primary/30">
                      {tPreview('searchAvailability')}
                    </button>
                    <p className="text-center text-[10px] text-slate-400 mt-3">
                      {tPreview('poweredBy')} <span className="font-semibold text-slate-500 dark:text-slate-400">Chamelio</span>
                    </p>
                  </div>
                </div>

                <div className="mt-6 space-y-3">
                  <div className="w-full h-3 bg-slate-100 dark:bg-slate-700 rounded-full" />
                  <div className="w-3/4 h-3 bg-slate-100 dark:bg-slate-700 rounded-full" />
                  <div className="w-1/2 h-3 bg-slate-100 dark:bg-slate-700 rounded-full" />
                </div>
              </div>
            </div>
          </div>

          <div className="px-6 py-4 bg-slate-50/50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-700/50">
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="material-icons text-sm">info_outline</span>
              {tPreview('hint')}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
