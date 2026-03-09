'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ToggleSwitch } from '@/components/ui/toggle-switch';
import type { BookingEngineFormData } from './booking-engine-client';

// ─── Collapsible Section ─────────────────────────────────────────────────────

interface CollapsibleSectionProps {
  icon: string;
  iconBg: string;
  title: string;
  description: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function CollapsibleSection({ icon, iconBg, title, description, defaultOpen = false, children }: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="bg-white dark:bg-[#1a2632] rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${iconBg}`}>
            <span className="material-icons text-xl">{icon}</span>
          </div>
          <div className="text-left">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{description}</p>
          </div>
        </div>
        <span className={`material-icons text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>
          expand_more
        </span>
      </button>
      {open && (
        <div className="border-t border-slate-100 dark:border-slate-700/50">
          <div className="px-6 py-5">{children}</div>
        </div>
      )}
    </div>
  );
}

// ─── Radio Option ────────────────────────────────────────────────────────────

interface RadioOptionProps {
  name: string;
  value: string;
  selected: boolean;
  onChange: (value: string) => void;
  label: string;
  description?: string;
}

function RadioOption({ name, value, selected, onChange, label, description }: RadioOptionProps) {
  return (
    <label
      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
        selected
          ? 'border-primary/30 bg-primary/5 dark:bg-primary/10'
          : 'border-slate-200 dark:border-slate-700 hover:border-primary/30 hover:bg-primary/5 dark:hover:bg-primary/10'
      }`}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={selected}
        onChange={() => onChange(value)}
        className="w-4 h-4 text-primary border-slate-300 dark:border-slate-600 focus:ring-primary"
      />
      <div>
        <span className="text-sm font-medium text-slate-900 dark:text-white">{label}</span>
        {description && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{description}</p>}
      </div>
    </label>
  );
}

// ─── Toggle Row ──────────────────────────────────────────────────────────────

interface ToggleRowProps {
  label: string;
  description?: string;
  tooltip?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  showDivider?: boolean;
}

function ToggleRow({ label, description, tooltip, checked, onChange, showDivider = true }: ToggleRowProps) {
  return (
    <>
      <div className="flex items-center justify-between py-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div>
            <span className="text-sm font-medium text-slate-900 dark:text-white">{label}</span>
            {description && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{description}</p>}
          </div>
          {tooltip && (
            <button type="button" className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 flex-shrink-0" title={tooltip}>
              <span className="material-icons text-base">info_outline</span>
            </button>
          )}
        </div>
        <ToggleSwitch checked={checked} onChange={onChange} />
      </div>
      {showDivider && <div className="border-t border-slate-100 dark:border-slate-700/50" />}
    </>
  );
}

// ─── Languages ───────────────────────────────────────────────────────────────

const LANGUAGES = [
  { value: 'es', label: 'Español' },
  { value: 'en', label: 'English' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
  { value: 'it', label: 'Italiano' },
  { value: 'pt', label: 'Português' },
];

// ─── Props ───────────────────────────────────────────────────────────────────

interface SettingsTabProps {
  data: BookingEngineFormData;
  onChange: <K extends keyof BookingEngineFormData>(key: K, value: BookingEngineFormData[K]) => void;
  onSave: () => void;
  isPending: boolean;
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function SettingsTab({ data, onChange, onSave, isPending }: SettingsTabProps) {
  const t = useTranslations('bookingEngine.settings');
  const tRoot = useTranslations('bookingEngine');

  // Bridge RadioOption string → typed onChange
  const radioChange = <K extends keyof BookingEngineFormData>(key: K) =>
    (value: string) => onChange(key, value as BookingEngineFormData[K]);

  return (
    <div className="space-y-4">

      {/* 1. Disponibilidad y Alojamiento */}
      <CollapsibleSection
        icon="visibility"
        iconBg="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
        title={t('availability.title')}
        description={t('availability.description')}
        defaultOpen
      >
        <div className="space-y-6">
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3 block">{t('availability.viewLabel')}</label>
            <div className="space-y-2">
              <RadioOption name="availability-view" value="collapsed" selected={data.availabilityView === 'collapsed'} onChange={radioChange('availabilityView')} label={t('availability.collapsed')} description={t('availability.collapsedDesc')} />
              <RadioOption name="availability-view" value="expanded" selected={data.availabilityView === 'expanded'} onChange={radioChange('availabilityView')} label={t('availability.expanded')} description={t('availability.expandedDesc')} />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3 block">{t('availability.priceLabel')}</label>
            <div className="space-y-2">
              <RadioOption name="price-format" value="lowest_night" selected={data.priceFormat === 'lowest_night'} onChange={radioChange('priceFormat')} label={t('availability.lowestNight')} description={t('availability.lowestNightDesc')} />
              <RadioOption name="price-format" value="total_stay" selected={data.priceFormat === 'total_stay'} onChange={radioChange('priceFormat')} label={t('availability.totalStay')} description={t('availability.totalStayDesc')} />
            </div>
          </div>
          <div className="flex items-center justify-between p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <span className="material-icons text-slate-400 text-lg">bed</span>
              <div>
                <span className="text-sm font-medium text-slate-900 dark:text-white">{t('availability.specificRoom')}</span>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t('availability.specificRoomDesc')}</p>
              </div>
            </div>
            <ToggleSwitch checked={data.specificRoom} onChange={(v) => onChange('specificRoom', v)} />
          </div>
        </div>
      </CollapsibleSection>

      {/* 2. Complementos */}
      <CollapsibleSection icon="add_shopping_cart" iconBg="bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400" title={t('addons.title')} description={t('addons.description')}>
        <div>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3 block">{t('addons.label')}</label>
          <div className="space-y-2">
            <RadioOption name="addons" value="before" selected={data.addonsDisplay === 'before'} onChange={radioChange('addonsDisplay')} label={t('addons.beforeCheckout')} description={t('addons.beforeCheckoutDesc')} />
            <RadioOption name="addons" value="after" selected={data.addonsDisplay === 'after'} onChange={radioChange('addonsDisplay')} label={t('addons.afterCheckout')} description={t('addons.afterCheckoutDesc')} />
          </div>
        </div>
      </CollapsibleSection>

      {/* 3. Filtro de huéspedes */}
      <CollapsibleSection icon="group" iconBg="bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400" title={t('guestFilter.title')} description={t('guestFilter.description')}>
        <div>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3 block">{t('guestFilter.label')}</label>
          <div className="space-y-2">
            <RadioOption name="guest-filter" value="full" selected={data.guestFilter === 'full'} onChange={radioChange('guestFilter')} label={t('guestFilter.full')} description={t('guestFilter.fullDesc')} />
            <RadioOption name="guest-filter" value="adults_children" selected={data.guestFilter === 'adults_children'} onChange={radioChange('guestFilter')} label={t('guestFilter.adultsChildren')} description={t('guestFilter.adultsChildrenDesc')} />
            <RadioOption name="guest-filter" value="none" selected={data.guestFilter === 'none'} onChange={radioChange('guestFilter')} label={t('guestFilter.none')} description={t('guestFilter.noneDesc')} />
          </div>
        </div>
      </CollapsibleSection>

      {/* 4. Ajustes de ocupación */}
      <CollapsibleSection icon="person" iconBg="bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400" title={t('occupancy.title')} description={t('occupancy.description')}>
        <div className="max-w-xs">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">{t('occupancy.defaultAdults')}</label>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => onChange('defaultAdults', Math.max(1, data.defaultAdults - 1))} className="w-9 h-9 flex items-center justify-center rounded-lg border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
              <span className="material-icons text-lg">remove</span>
            </button>
            <input type="number" value={data.defaultAdults} min={1} max={10} onChange={(e) => onChange('defaultAdults', Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))} className="w-16 text-center bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-semibold py-2 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-slate-900 dark:text-white" />
            <button type="button" onClick={() => onChange('defaultAdults', Math.min(10, data.defaultAdults + 1))} className="w-9 h-9 flex items-center justify-center rounded-lg border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
              <span className="material-icons text-lg">add</span>
            </button>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">{t('occupancy.defaultAdultsDesc')}</p>
        </div>
      </CollapsibleSection>

      {/* 5. Ajustes de alojamiento */}
      <CollapsibleSection icon="bedroom_parent" iconBg="bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400" title={t('accommodation.title')} description={t('accommodation.description')}>
        <div className="space-y-0">
          <ToggleRow label={t('accommodation.showUnavailable')} description={t('accommodation.showUnavailableDesc')} tooltip={t('accommodation.showUnavailableTooltip')} checked={data.showUnavailable} onChange={(v) => onChange('showUnavailable', v)} />
          <ToggleRow label={t('accommodation.autoAssign')} description={t('accommodation.autoAssignDesc')} checked={data.autoAssign} onChange={(v) => onChange('autoAssign', v)} />
          <ToggleRow label={t('accommodation.limitByType')} description={t('accommodation.limitByTypeDesc')} checked={data.limitByType} onChange={(v) => onChange('limitByType', v)} />
          <ToggleRow label={t('accommodation.showRestrictions')} description={t('accommodation.showRestrictionsDesc')} checked={data.showRestrictions} onChange={(v) => onChange('showRestrictions', v)} />
          <ToggleRow label={t('accommodation.showRates')} description={t('accommodation.showRatesDesc')} tooltip={t('accommodation.showRatesTooltip')} checked={data.showRates} onChange={(v) => onChange('showRates', v)} showDivider={false} />
        </div>
      </CollapsibleSection>

      {/* 6. Información del huésped */}
      <CollapsibleSection icon="contact_mail" iconBg="bg-cyan-50 dark:bg-cyan-900/20 text-cyan-600 dark:text-cyan-400" title={t('guestInfo.title')} description={t('guestInfo.description')}>
        <div className="space-y-0">
          <ToggleRow label={t('guestInfo.postalAddress')} checked={data.fieldPostalAddress} onChange={(v) => onChange('fieldPostalAddress', v)} />
          <ToggleRow label={t('guestInfo.nationality')} checked={data.fieldNationality} onChange={(v) => onChange('fieldNationality', v)} />
          <ToggleRow label={t('guestInfo.gender')} checked={data.fieldGender} onChange={(v) => onChange('fieldGender', v)} />
          <ToggleRow label={t('guestInfo.idDocument')} description={t('guestInfo.idDocumentDesc')} checked={data.fieldIdDocument} onChange={(v) => onChange('fieldIdDocument', v)} />
          <ToggleRow label={t('guestInfo.company')} checked={data.fieldCompany} onChange={(v) => onChange('fieldCompany', v)} />
          <ToggleRow label={t('guestInfo.phone')} checked={data.fieldPhone} onChange={(v) => onChange('fieldPhone', v)} />
          <ToggleRow label={t('guestInfo.arrivalTime')} description={t('guestInfo.arrivalTimeDesc')} checked={data.fieldArrivalTime} onChange={(v) => onChange('fieldArrivalTime', v)} />
          <ToggleRow label={t('guestInfo.termsAndConditions')} description={t('guestInfo.termsAndConditionsDesc')} checked={data.fieldTermsAndConditions} onChange={(v) => onChange('fieldTermsAndConditions', v)} showDivider={false} />
        </div>
      </CollapsibleSection>

      {/* 7. Marketing */}
      <CollapsibleSection icon="campaign" iconBg="bg-pink-50 dark:bg-pink-900/20 text-pink-600 dark:text-pink-400" title={t('marketing.title')} description={t('marketing.description')}>
        <div className="space-y-0">
          <ToggleRow label={t('marketing.autoConfirmEmail')} description={t('marketing.autoConfirmEmailDesc')} checked={data.autoConfirmEmail} onChange={(v) => onChange('autoConfirmEmail', v)} />
          <ToggleRow label={t('marketing.redirectConfirmation')} description={t('marketing.redirectConfirmationDesc')} checked={data.redirectConfirmation} onChange={(v) => onChange('redirectConfirmation', v)} showDivider={false} />
          {data.redirectConfirmation && (
            <div className="pt-3">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">{t('marketing.redirectUrl')}</label>
              <input type="url" value={data.redirectUrl} onChange={(e) => onChange('redirectUrl', e.target.value)} placeholder={t('marketing.redirectUrlPlaceholder')} className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm px-4 py-2.5 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none placeholder:text-slate-400 text-slate-900 dark:text-white" />
            </div>
          )}
        </div>
      </CollapsibleSection>

      {/* 8. Pago */}
      <CollapsibleSection icon="payment" iconBg="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400" title={t('payment.title')} description={t('payment.description')}>
        <ToggleRow label={t('payment.requireCvv')} description={t('payment.requireCvvDesc')} tooltip={t('payment.requireCvvTooltip')} checked={data.requireCvv} onChange={(v) => onChange('requireCvv', v)} showDivider={false} />
      </CollapsibleSection>

      {/* 9. Idioma */}
      <CollapsibleSection icon="translate" iconBg="bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400" title={t('language.title')} description={t('language.description')}>
        <div className="max-w-xs">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">{t('language.label')}</label>
          <div className="relative">
            <select value={data.language} onChange={(e) => onChange('language', e.target.value)} className="appearance-none w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 pl-4 pr-10 py-2.5 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none cursor-pointer">
              {LANGUAGES.map((lang) => (
                <option key={lang.value} value={lang.value}>{lang.label}</option>
              ))}
            </select>
            <span className="material-icons absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg pointer-events-none">expand_more</span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">{t('language.hint')}</p>
        </div>
      </CollapsibleSection>

      {/* Save bar */}
      <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-200 dark:border-slate-700">
        <button type="button" className="px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
          {tRoot('discard')}
        </button>
        <button type="button" onClick={onSave} disabled={isPending} className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors shadow-sm shadow-primary/30 disabled:opacity-50 disabled:cursor-not-allowed">
          <span className="material-icons text-lg">{isPending ? 'hourglass_empty' : 'save'}</span>
          {tRoot('save')}
        </button>
      </div>
    </div>
  );
}
