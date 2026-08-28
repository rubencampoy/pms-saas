'use client';

import { useCallback, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { ToggleSwitch } from '@/components/ui/toggle-switch';
import { toast } from '@/lib/hooks/use-toast';
import { BRAND_ASSET_RULES, type BrandAssetKind } from '@/lib/validators/brand-asset';
import { BOOKING_HEADER_STYLES, DEFAULT_BRAND_COLOR } from '@/lib/validators/booking-engine-settings';
import { headerLogoUrl, headerPalette } from '@/lib/utils/booking-header';
import { contrastRatio, hasReadableWhiteText, readableForeground, LIGHT_FOREGROUND } from '@/lib/utils/color';
import type { BookingEngineFormData } from './booking-engine-client';

// ─── Paleta sugerida ─────────────────────────────────────────────────────────

/** Atajos habituales; el cliente siempre puede usar el selector o teclear el hex. */
const COLOR_PRESETS = [
  DEFAULT_BRAND_COLOR,
  '#0f766e',
  '#b91c1c',
  '#a16207',
  '#7c3aed',
  '#be185d',
  '#0f172a',
];

// ─── Card ────────────────────────────────────────────────────────────────────

interface CardProps {
  icon: string;
  iconBg: string;
  title: string;
  description: string;
  children: React.ReactNode;
}

function Card({ icon, iconBg, title, description, children }: CardProps) {
  return (
    <div className="bg-white dark:bg-[#1a2632] rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-4">
        <div className={`p-2 rounded-lg ${iconBg}`}>
          <span className="material-icons text-xl">{icon}</span>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{description}</p>
        </div>
      </div>
      <div className="border-t border-slate-100 dark:border-slate-700/50 px-6 py-5">{children}</div>
    </div>
  );
}

// ─── Campo de texto ──────────────────────────────────────────────────────────

interface TextFieldProps {
  label: string;
  hint?: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}

function TextField({ label, hint, value, placeholder, onChange }: TextFieldProps) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-900 dark:text-white">{label}</span>
      {hint && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{hint}</p>}
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-200 px-3 py-2 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
      />
    </label>
  );
}

// ─── Subida de assets ────────────────────────────────────────────────────────

interface AssetUploaderProps {
  kind: BrandAssetKind;
  propertyId: string;
  label: string;
  hint: string;
  emptyLabel: string;
  removeLabel: string;
  value: string;
  onChange: (url: string) => void;
  /** Alto de la vista previa; un favicon y una portada no se enseñan igual. */
  previewClassName: string;
  /**
   * Fondo de la vista previa. El logo inverso es claro por definición: sobre el
   * gris del recuadro no se vería, así que se enseña sobre su cabecera real.
   */
  previewStyle?: React.CSSProperties;
}

function AssetUploader({
  kind,
  propertyId,
  label,
  hint,
  emptyLabel,
  removeLabel,
  value,
  onChange,
  previewClassName,
  previewStyle,
}: AssetUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const rule = BRAND_ASSET_RULES[kind];

  const handleFile = useCallback(
    async (file: File) => {
      setIsUploading(true);
      try {
        const body = new FormData();
        body.append('file', file);
        body.append('propertyId', propertyId);
        body.append('kind', kind);

        const res = await fetch('/api/upload/brand-asset', { method: 'POST', body });
        const json: { success: boolean; error?: string; data?: { url: string } } = await res.json();

        if (!json.success || !json.data) {
          toast({ variant: 'error', title: json.error ?? 'Error al subir el fichero' });
          return;
        }
        onChange(json.data.url);
      } catch {
        toast({ variant: 'error', title: 'Error de red al subir el fichero' });
      } finally {
        setIsUploading(false);
      }
    },
    [kind, propertyId, onChange],
  );

  return (
    <div>
      <span className="text-sm font-medium text-slate-900 dark:text-white">{label}</span>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{hint}</p>

      <div className="mt-3 flex items-center gap-4">
        <div
          style={previewStyle}
          className={`relative flex items-center justify-center rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 overflow-hidden ${previewClassName}`}
        >
          {value ? (
            <Image
              src={value}
              alt={label}
              fill
              unoptimized
              className="object-contain p-2"
            />
          ) : (
            <span className="material-icons text-2xl text-slate-300 dark:text-slate-600">
              add_photo_alternate
            </span>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <input
            ref={inputRef}
            type="file"
            accept={rule.types.join(',')}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
              // Permite volver a elegir el mismo fichero tras un fallo
              e.target.value = '';
            }}
          />
          <button
            type="button"
            disabled={isUploading || !propertyId}
            onClick={() => inputRef.current?.click()}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="material-icons text-lg">
              {isUploading ? 'hourglass_empty' : 'upload'}
            </span>
            {emptyLabel}
          </button>
          {value && (
            <button
              type="button"
              onClick={() => onChange('')}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            >
              <span className="material-icons text-lg">delete_outline</span>
              {removeLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Componente principal ────────────────────────────────────────────────────

interface BrandingTabProps {
  data: BookingEngineFormData;
  onChange: <K extends keyof BookingEngineFormData>(key: K, value: BookingEngineFormData[K]) => void;
  onSave: () => void;
  isPending: boolean;
  propertyId: string;
  propertyName: string;
}

export function BrandingTab({
  data,
  onChange,
  onSave,
  isPending,
  propertyId,
  propertyName,
}: BrandingTabProps) {
  const t = useTranslations('bookingEngine.branding');
  const tRoot = useTranslations('bookingEngine');

  const color = data.brandPrimaryColor;
  const whiteTextIsReadable = hasReadableWhiteText(color);
  const ratio = contrastRatio(color, LIGHT_FOREGROUND);
  const headerName = data.brandDisplayName || propertyName;

  // La cabecera del motor y la de la vista previa se pintan con las mismas
  // funciones que usa el chrome público, así que lo que se ve aquí es lo que
  // verá el huésped.
  const palette = headerPalette({ headerStyle: data.brandHeaderStyle, primaryColor: color });
  const previewLogoUrl = headerLogoUrl(
    { logoUrl: data.brandLogoUrl, logoInverseUrl: data.brandLogoInverseUrl },
    palette !== null,
  );
  const missingInverseLogo =
    palette !== null && data.brandLogoUrl !== '' && data.brandLogoInverseUrl === '';

  /** Etiquetas de los tres estilos, sin claves de traducción dinámicas. */
  const headerStyleLabels = {
    light: t('header.styles.light'),
    brand: t('header.styles.brand'),
    dark: t('header.styles.dark'),
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">

      {/* COLUMNA IZQUIERDA: configuración */}
      <div className="space-y-4">

        {/* Identidad */}
        <Card
          icon="badge"
          iconBg="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
          title={t('identity.title')}
          description={t('identity.description')}
        >
          <div className="space-y-5">
            <TextField
              label={t('identity.displayName')}
              hint={t('identity.displayNameHint')}
              value={data.brandDisplayName}
              placeholder={propertyName}
              onChange={(v) => onChange('brandDisplayName', v)}
            />

            <AssetUploader
              kind="logo"
              propertyId={propertyId}
              label={t('identity.logo')}
              hint={t('identity.logoHint')}
              emptyLabel={t('upload')}
              removeLabel={t('remove')}
              value={data.brandLogoUrl}
              onChange={(v) => onChange('brandLogoUrl', v)}
              previewClassName="h-16 w-32"
            />

            <AssetUploader
              kind="favicon"
              propertyId={propertyId}
              label={t('identity.favicon')}
              hint={t('identity.faviconHint')}
              emptyLabel={t('upload')}
              removeLabel={t('remove')}
              value={data.brandFaviconUrl}
              onChange={(v) => onChange('brandFaviconUrl', v)}
              previewClassName="h-16 w-16"
            />
          </div>
        </Card>

        {/* Color */}
        <Card
          icon="palette"
          iconBg="bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400"
          title={t('color.title')}
          description={t('color.description')}
        >
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={color}
              onChange={(e) => onChange('brandPrimaryColor', e.target.value)}
              className="h-11 w-14 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent cursor-pointer"
              aria-label={t('color.title')}
            />
            <input
              type="text"
              value={color}
              onChange={(e) => onChange('brandPrimaryColor', e.target.value)}
              className="w-32 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-mono text-slate-700 dark:text-slate-200 px-3 py-2 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
            />
            <div className="flex items-center gap-1.5">
              {COLOR_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => onChange('brandPrimaryColor', preset)}
                  style={{ backgroundColor: preset }}
                  className={`h-7 w-7 rounded-full border-2 transition-transform hover:scale-110 ${
                    color.toLowerCase() === preset.toLowerCase()
                      ? 'border-slate-900 dark:border-white'
                      : 'border-transparent'
                  }`}
                  aria-label={preset}
                />
              ))}
            </div>
          </div>

          {/* El cliente elige el color libremente: si el texto blanco encima no
              se lee, hay que decírselo antes de que lo publique. */}
          {!whiteTextIsReadable && (
            <div className="mt-4 flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-3 py-2.5">
              <span className="material-icons text-base text-amber-600 dark:text-amber-400 mt-0.5">
                warning_amber
              </span>
              <p className="text-xs text-amber-800 dark:text-amber-300">
                {t('color.lowContrast', { ratio: ratio ? ratio.toFixed(1) : '—' })}
              </p>
            </div>
          )}
        </Card>

        {/* Cabecera */}
        <Card
          icon="web_asset"
          iconBg="bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400"
          title={t('header.title')}
          description={t('header.description')}
        >
          <div className="space-y-5">
            <div className="grid grid-cols-3 gap-2">
              {BOOKING_HEADER_STYLES.map((style) => {
                const swatch = headerPalette({ headerStyle: style, primaryColor: color });
                const selected = data.brandHeaderStyle === style;
                return (
                  <button
                    key={style}
                    type="button"
                    onClick={() => onChange('brandHeaderStyle', style)}
                    className={`rounded-lg border-2 p-2 transition-colors ${
                      selected
                        ? 'border-primary'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <span
                      style={
                        swatch
                          ? { backgroundColor: swatch.background, color: swatch.foreground }
                          : undefined
                      }
                      className={`flex h-9 items-center gap-1.5 rounded-md px-2 ${
                        swatch ? '' : 'bg-white text-slate-900 border border-slate-200'
                      }`}
                    >
                      <span className="material-icons text-sm">hotel</span>
                      <span className="h-1.5 flex-1 rounded-full bg-current opacity-40" />
                    </span>
                    <span
                      className={`mt-2 block text-xs font-medium ${
                        selected ? 'text-primary' : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {headerStyleLabels[style]}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* El logo inverso solo tiene sentido con la cabecera pintada */}
            {palette && (
              <>
                <AssetUploader
                  kind="logoInverse"
                  propertyId={propertyId}
                  label={t('header.logoInverse')}
                  hint={t('header.logoInverseHint')}
                  emptyLabel={t('upload')}
                  removeLabel={t('remove')}
                  value={data.brandLogoInverseUrl}
                  onChange={(v) => onChange('brandLogoInverseUrl', v)}
                  previewClassName="h-16 w-32"
                  previewStyle={{ backgroundColor: palette.background }}
                />

                {/* Un logo de tinta oscura sobre la cabecera pintada desaparece:
                    conviene avisar antes de que el motor salga así publicado. */}
                {missingInverseLogo && (
                  <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-3 py-2.5">
                    <span className="material-icons text-base text-amber-600 dark:text-amber-400 mt-0.5">
                      warning_amber
                    </span>
                    <p className="text-xs text-amber-800 dark:text-amber-300">
                      {t('header.missingInverse')}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </Card>

        {/* Portada */}
        <Card
          icon="image"
          iconBg="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400"
          title={t('cover.title')}
          description={t('cover.description')}
        >
          <AssetUploader
            kind="cover"
            propertyId={propertyId}
            label={t('cover.image')}
            hint={t('cover.imageHint')}
            emptyLabel={t('upload')}
            removeLabel={t('remove')}
            value={data.brandCoverImageUrl}
            onChange={(v) => onChange('brandCoverImageUrl', v)}
            previewClassName="h-20 w-36"
          />
        </Card>

        {/* Pie */}
        <Card
          icon="link"
          iconBg="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
          title={t('footer.title')}
          description={t('footer.description')}
        >
          <div className="space-y-4">
            <TextField
              label={t('footer.privacy')}
              value={data.brandPrivacyUrl}
              placeholder="https://tuhotel.com/privacidad"
              onChange={(v) => onChange('brandPrivacyUrl', v)}
            />
            <TextField
              label={t('footer.terms')}
              value={data.brandTermsUrl}
              placeholder="https://tuhotel.com/terminos"
              onChange={(v) => onChange('brandTermsUrl', v)}
            />
            <TextField
              label={t('footer.cookies')}
              value={data.brandCookiesUrl}
              placeholder="https://tuhotel.com/cookies"
              onChange={(v) => onChange('brandCookiesUrl', v)}
            />

            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-700/50">
              <div>
                <span className="text-sm font-medium text-slate-900 dark:text-white">
                  {t('footer.hideChamelio')}
                </span>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {t('footer.hideChamelioHint')}
                </p>
              </div>
              <ToggleSwitch
                checked={data.brandHideChamelio}
                onChange={(v) => onChange('brandHideChamelio', v)}
              />
            </div>
          </div>
        </Card>
      </div>

      {/* COLUMNA DERECHA: vista previa */}
      <div className="xl:sticky xl:top-6">
        <Card
          icon="visibility"
          iconBg="bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400"
          title={t('preview.title')}
          description={t('preview.description')}
        >
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            {/* Cabecera del motor */}
            <div
              style={
                palette
                  ? {
                      backgroundColor: palette.background,
                      color: palette.foreground,
                      borderColor: `${palette.foreground}26`,
                    }
                  : undefined
              }
              className={`flex items-center justify-between border-b px-4 h-14 ${
                palette ? '' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                {previewLogoUrl ? (
                  <span className="relative h-8 w-24 flex-shrink-0">
                    <Image
                      src={previewLogoUrl}
                      alt={headerName}
                      fill
                      unoptimized
                      className="object-contain object-left"
                    />
                  </span>
                ) : (
                  <>
                    <span
                      className="material-icons text-2xl flex-shrink-0"
                      style={palette ? undefined : { color }}
                    >
                      hotel
                    </span>
                    <span
                      className={`text-base font-extrabold tracking-tight truncate ${
                        palette ? '' : 'text-slate-900 dark:text-white'
                      }`}
                    >
                      {headerName || t('preview.yourHotel')}
                    </span>
                  </>
                )}
              </div>
              <span
                className={`material-icons text-xl ${palette ? 'opacity-80' : 'text-slate-400'}`}
              >
                language
              </span>
            </div>

            {/* Portada */}
            {data.brandCoverImageUrl && (
              <div className="relative h-24 w-full bg-slate-100 dark:bg-slate-800">
                <Image
                  src={data.brandCoverImageUrl}
                  alt={t('cover.image')}
                  fill
                  unoptimized
                  className="object-cover"
                />
              </div>
            )}

            {/* Cuerpo */}
            <div className="bg-slate-50 dark:bg-slate-900/50 px-4 py-5 space-y-3">
              <div className="flex items-center gap-2">
                <div
                  className="h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-bold"
                  style={{ backgroundColor: color, color: readableForeground(color) }}
                >
                  1
                </div>
                <div className="h-1 flex-1 rounded-full" style={{ backgroundColor: color }} />
                <div className="h-6 w-6 rounded-full bg-slate-200 dark:bg-slate-700" />
                <div className="h-1 flex-1 rounded-full bg-slate-200 dark:bg-slate-700" />
                <div className="h-6 w-6 rounded-full bg-slate-200 dark:bg-slate-700" />
              </div>

              <div className="bg-white dark:bg-[#1a2632] rounded-lg border border-slate-200 dark:border-slate-700 p-3 flex items-center gap-3">
                <div className="flex-1 space-y-1.5">
                  <div className="h-2 w-16 rounded bg-slate-200 dark:bg-slate-700" />
                  <div className="h-2 w-24 rounded bg-slate-100 dark:bg-slate-800" />
                </div>
                <button
                  type="button"
                  tabIndex={-1}
                  className="px-4 py-2 rounded-lg text-xs font-semibold pointer-events-none"
                  style={{ backgroundColor: color, color: LIGHT_FOREGROUND }}
                >
                  {t('preview.search')}
                </button>
              </div>
            </div>

            {/* Pie */}
            <div className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-4 py-3 text-center">
              <div className="flex items-center justify-center gap-3 text-[10px] font-medium text-slate-500">
                {[data.brandPrivacyUrl, data.brandTermsUrl, data.brandCookiesUrl].some(Boolean) ? (
                  <>
                    {data.brandPrivacyUrl && <span>{t('footer.privacyShort')}</span>}
                    {data.brandTermsUrl && <span>{t('footer.termsShort')}</span>}
                    {data.brandCookiesUrl && <span>{t('footer.cookiesShort')}</span>}
                  </>
                ) : (
                  <span className="text-slate-300 dark:text-slate-600">
                    {t('preview.noFooterLinks')}
                  </span>
                )}
              </div>
              {!data.brandHideChamelio && (
                <p className="mt-1.5 text-[10px] text-slate-400">{t('preview.poweredBy')}</p>
              )}
            </div>
          </div>
        </Card>

        {/* Barra de guardado */}
        <div className="flex items-center justify-end gap-3 pt-6">
          <button
            type="button"
            onClick={onSave}
            disabled={isPending}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors shadow-sm shadow-primary/30 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="material-icons text-lg">{isPending ? 'hourglass_empty' : 'save'}</span>
            {tRoot('save')}
          </button>
        </div>
      </div>
    </div>
  );
}
