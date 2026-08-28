import { cache } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { resolvePropertyCached, getBrandingCached } from '@/server/services/booking-engine-cache';
import { BookingChrome } from '@/components/booking-engine/booking-chrome';
import type { BookingBranding } from '@/types/booking-engine';

interface Props {
  params: Promise<{ slug: string; propertyCode: string }>;
  children: React.ReactNode;
}

/**
 * El layout y las páginas de debajo necesitan lo mismo (propiedad + marca), y
 * `generateMetadata` lo pide una tercera vez. `cache()` hace que las tres
 * llamadas de un mismo request compartan una sola consulta.
 */
export const getBranding = cache(
  async (slug: string, propertyCode: string): Promise<BookingBranding | null> => {
    try {
      const { organization, property } = await resolvePropertyCached(slug, propertyCode);
      if (!property) return null;
      return getBrandingCached(organization.id, property.id, property.name);
    } catch {
      return null;
    }
  },
);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, propertyCode } = await params;
  const branding = await getBranding(slug, propertyCode);
  if (!branding) return {};

  return {
    // `absolute` esquiva la plantilla "%s — Chamelio PMS" del layout raíz: en un
    // motor con marca blanca la pestaña no debe delatar a Chamelio.
    title: { absolute: branding.displayName },
    // Solo se sobrescribe el icono si el cliente ha subido uno; si no, se hereda
    // el del layout raíz.
    ...(branding.faviconUrl ? { icons: { icon: branding.faviconUrl } } : {}),
  };
}

export default async function PropertyBookingLayout({ params, children }: Props) {
  const { slug, propertyCode } = await params;
  const branding = await getBranding(slug, propertyCode);
  if (!branding) notFound();

  return <BookingChrome branding={branding}>{children}</BookingChrome>;
}
