import { redirect, notFound } from 'next/navigation';
import { bookingEngineService } from '@/server/services/booking-engine.service';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function BookingOrgPage({ params }: Props) {
  const { slug } = await params;
  const t = await getTranslations('bookingEnginePublic');

  let resolved;
  try {
    resolved = await bookingEngineService.resolveProperty(slug);
  } catch {
    notFound();
  }

  const { properties } = resolved;

  // If only 1 property, redirect directly
  if (properties.length === 1 && properties[0]) {
    redirect(`/book/${slug}/${properties[0].code}`);
  }

  if (properties.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <span className="material-icons text-5xl text-slate-300 dark:text-slate-600 mb-4">hotel</span>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
          {t('noProperties')}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {t('noPropertiesDesc')}
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
          {t('selectProperty')}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {t('selectPropertyDesc')}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {properties.map((prop) => {
          const address = prop.address as Record<string, string> | null;
          return (
            <Link
              key={prop.id}
              href={`/book/${slug}/${prop.code}`}
              className="bg-white dark:bg-[#1a2632] rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 hover:shadow-md hover:border-primary/30 transition-all group"
            >
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                  <span className="material-icons text-2xl">hotel</span>
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white group-hover:text-primary transition-colors">
                    {prop.name}
                  </h2>
                  {address?.city && (
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                      <span className="material-icons text-sm align-middle mr-1">location_on</span>
                      {address.city}
                    </p>
                  )}
                </div>
                <span className="material-icons text-slate-300 dark:text-slate-600 group-hover:text-primary transition-colors">
                  chevron_right
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
