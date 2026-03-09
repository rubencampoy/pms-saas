import { useTranslations } from 'next-intl';

function BookingEngineHeader() {
  return (
    <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="text-primary size-8">
              <svg fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M36.7273 44C33.9891 44 31.6043 39.8386 30.3636 33.69C29.123 39.8386 26.7382 44 24 44C21.2618 44 18.877 39.8386 17.6364 33.69C16.3957 39.8386 14.0109 44 11.2727 44C7.25611 44 4 35.0457 4 24C4 12.9543 7.25611 4 11.2727 4C14.0109 4 16.3957 8.16144 17.6364 14.31C18.877 8.16144 21.2618 4 24 4C26.7382 4 29.123 8.16144 30.3636 14.31C31.6043 8.16144 33.9891 4 36.7273 4C40.7439 4 44 12.9543 44 24C44 35.0457 40.7439 44 36.7273 44Z"
                  fill="currentColor"
                />
              </svg>
            </div>
            <span className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              HotelOS
            </span>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-6">
            <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
              <span className="material-icons text-xl text-slate-600 dark:text-slate-400">
                language
              </span>
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                ES/EN
              </span>
            </button>
            <div className="h-10 w-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
              <span className="material-icons text-slate-600 dark:text-slate-400">person</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

function BookingEngineFooter() {
  const t = useTranslations('bookingEnginePublic');

  return (
    <footer className="mt-auto border-t border-slate-200 dark:border-slate-800 py-8 bg-white dark:bg-slate-900">
      <div className="max-w-7xl mx-auto px-4 text-center">
        <div className="flex flex-col md:flex-row justify-center items-center gap-4 md:gap-8 mb-4 text-sm font-medium">
          <a className="text-slate-500 hover:text-primary transition-colors" href="#">
            {t('privacyPolicy')}
          </a>
          <span className="hidden md:inline text-slate-300 dark:text-slate-700">&bull;</span>
          <a className="text-slate-500 hover:text-primary transition-colors" href="#">
            {t('termsOfService')}
          </a>
          <span className="hidden md:inline text-slate-300 dark:text-slate-700">&bull;</span>
          <a className="text-slate-500 hover:text-primary transition-colors" href="#">
            {t('cookies')}
          </a>
        </div>
        <p className="text-slate-400 text-xs">
          &copy; {new Date().getFullYear()} HotelOS. {t('allRightsReserved')}
        </p>
      </div>
    </footer>
  );
}

export default function BookingEngineLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark flex flex-col">
      <BookingEngineHeader />
      <main className="flex-grow">{children}</main>
      <BookingEngineFooter />
    </div>
  );
}
