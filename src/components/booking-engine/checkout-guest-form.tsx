'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { useBookingStore } from '@/lib/hooks/use-booking-store';
import { checkoutGuestSchema, type CheckoutGuestInput } from '@/lib/validators/booking-checkout';
import type { BookingEngineSettings } from '@/types/booking-engine';

/** Nacionalidades que ofrece el desplegable, en códigos ISO 3166-1 alfa-2. */
const NATIONALITY_CODES = ['US', 'GB', 'CA', 'DE', 'FR', 'ES', 'NL'] as const;

interface CheckoutGuestFormProps {
  settings: BookingEngineSettings;
  slug: string;
  propertyCode: string;
  translations: {
    guestDetails: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    nationality: string;
    gender: string;
    genderMale: string;
    genderFemale: string;
    genderOther: string;
    genderPreferNot: string;
    documentType: string;
    documentNumber: string;
    passport: string;
    nationalId: string;
    drivingLicense: string;
    otherDocument: string;
    company: string;
    postalAddress: string;
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    arrivalTime: string;
    specialRequests: string;
    specialRequestsPlaceholder: string;
    acceptTerms: string;
    termsRequired: string;
    confirmBooking: string;
    bookingFailed: string;
    noAvailabilityError: string;
  };
}

export function CheckoutGuestForm({
  settings,
  slug,
  propertyCode,
  translations: t,
}: CheckoutGuestFormProps) {
  const router = useRouter();
  const locale = useLocale();
  const { createBooking, isBooking, bookingError, clearBookingError } = useBookingStore();

  // Los nombres de país los pone el navegador a partir del código ISO, para no
  // mantener una tabla de nacionalidades por idioma.
  const nationalities = useMemo(() => {
    const names = new Intl.DisplayNames([locale], { type: 'region' });
    return NATIONALITY_CODES.map((code) => ({
      code,
      name: names.of(code) ?? code,
    }));
  }, [locale]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CheckoutGuestInput>({
    resolver: zodResolver(checkoutGuestSchema),
    defaultValues: {
      acceptTerms: false,
    },
  });

  const onSubmit = async (data: CheckoutGuestInput) => {
    clearBookingError();

    if (settings.fieldTermsAndConditions && !data.acceptTerms) {
      return;
    }

    const confirmation = await createBooking(data);
    if (confirmation) {
      router.push(`/book/${slug}/${propertyCode}/confirmation/${confirmation.confirmationCodes[0]}`);
    }
  };

  const inputClass =
    'w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent focus:ring-primary focus:border-primary px-4 py-3 text-sm text-slate-900 dark:text-white placeholder-slate-400 outline-none transition-colors';
  const labelClass =
    'text-xs font-bold uppercase text-slate-500 dark:text-slate-400 tracking-wider';
  const errorClass = 'text-xs text-red-500 mt-1';

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      {/* Guest Information section */}
      <section className="bg-white dark:bg-slate-900 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3 mb-6">
          <span className="material-icons text-primary">person</span>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t.guestDetails}</h1>
        </div>

        {/* Error banner */}
        {bookingError && (
          <div className="mb-6 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2">
            <span className="material-icons text-red-500 text-lg">error</span>
            <p className="text-sm text-red-700 dark:text-red-300">
              {bookingError.includes('availability') ? t.noAvailabilityError : t.bookingFailed}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* First Name */}
          <div className="space-y-2">
            <label className={labelClass}>{t.firstName} *</label>
            <input {...register('firstName')} className={inputClass} />
            {errors.firstName && <p className={errorClass}>{errors.firstName.message}</p>}
          </div>

          {/* Last Name */}
          <div className="space-y-2">
            <label className={labelClass}>{t.lastName} *</label>
            <input {...register('lastName')} className={inputClass} />
            {errors.lastName && <p className={errorClass}>{errors.lastName.message}</p>}
          </div>

          {/* Email */}
          <div className="space-y-2">
            <label className={labelClass}>{t.email} *</label>
            <input type="email" {...register('email')} className={inputClass} />
            {errors.email && <p className={errorClass}>{errors.email.message}</p>}
          </div>

          {/* Phone (conditional) */}
          {settings.fieldPhone && (
            <div className="space-y-2">
              <label className={labelClass}>{t.phone}</label>
              <input type="tel" {...register('phone')} className={inputClass} />
            </div>
          )}

          {/* Nationality (conditional) */}
          {settings.fieldNationality && (
            <div className="space-y-2 md:col-span-2">
              <label className={labelClass}>{t.nationality}</label>
              <select {...register('nationality')} className={inputClass}>
                <option value="">—</option>
                {nationalities.map((nationality) => (
                  <option key={nationality.code} value={nationality.code}>
                    {nationality.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Gender (conditional) */}
          {settings.fieldGender && (
            <div className="space-y-2">
              <label className={labelClass}>{t.gender}</label>
              <select {...register('gender')} className={inputClass}>
                <option value="">—</option>
                <option value="male">{t.genderMale}</option>
                <option value="female">{t.genderFemale}</option>
                <option value="other">{t.genderOther}</option>
                <option value="prefer_not_to_say">{t.genderPreferNot}</option>
              </select>
            </div>
          )}

          {/* ID Document (conditional) */}
          {settings.fieldIdDocument && (
            <>
              <div className="space-y-2">
                <label className={labelClass}>{t.documentType}</label>
                <select {...register('documentType')} className={inputClass}>
                  <option value="">—</option>
                  <option value="passport">{t.passport}</option>
                  <option value="national_id">{t.nationalId}</option>
                  <option value="driving_license">{t.drivingLicense}</option>
                  <option value="other">{t.otherDocument}</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className={labelClass}>{t.documentNumber}</label>
                <input {...register('documentNumber')} className={inputClass} />
              </div>
            </>
          )}

          {/* Company (conditional) */}
          {settings.fieldCompany && (
            <div className="space-y-2 md:col-span-2">
              <label className={labelClass}>{t.company}</label>
              <input {...register('company')} className={inputClass} />
            </div>
          )}

          {/* Postal address (conditional) */}
          {settings.fieldPostalAddress && (
            <div className="space-y-2 md:col-span-2">
              <label className={labelClass}>{t.postalAddress}</label>
              <div className="space-y-3 mt-1">
                <input {...register('address.street')} placeholder={t.street} className={inputClass} />
                <div className="grid grid-cols-2 gap-3">
                  <input {...register('address.city')} placeholder={t.city} className={inputClass} />
                  <input {...register('address.state')} placeholder={t.state} className={inputClass} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input {...register('address.postalCode')} placeholder={t.postalCode} className={inputClass} />
                  <input {...register('address.country')} placeholder={t.country} className={inputClass} />
                </div>
              </div>
            </div>
          )}

          {/* Arrival time (conditional) */}
          {settings.fieldArrivalTime && (
            <div className="space-y-2">
              <label className={labelClass}>{t.arrivalTime}</label>
              <input type="time" {...register('arrivalTime')} className={inputClass} />
            </div>
          )}

          {/* Special requests (always visible, full width) */}
          <div className="space-y-2 md:col-span-2">
            <label className={labelClass}>{t.specialRequests}</label>
            <textarea
              {...register('specialRequests')}
              rows={4}
              placeholder={t.specialRequestsPlaceholder}
              className={inputClass}
            />
          </div>
        </div>
      </section>

      {/* Terms and conditions + Submit */}
      <div className="space-y-6">
        {/* Terms and conditions (conditional) */}
        {settings.fieldTermsAndConditions && (
          <div>
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                {...register('acceptTerms')}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
              />
              <span className="text-sm text-slate-700 dark:text-slate-300">
                {t.acceptTerms} *
              </span>
            </label>
            {errors.acceptTerms && <p className={errorClass}>{t.termsRequired}</p>}
          </div>
        )}

        {/* Submit button */}
        <button
          type="submit"
          disabled={isBooking}
          className="w-full py-4 bg-primary hover:bg-primary/90 text-white rounded-xl font-bold text-lg shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isBooking ? (
            <>
              <span className="material-icons animate-spin text-xl">progress_activity</span>
              {t.confirmBooking}...
            </>
          ) : (
            <>
              {t.confirmBooking}
              <span className="material-icons">arrow_forward</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}
