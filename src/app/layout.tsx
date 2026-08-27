import type { Metadata } from 'next';
import { Manrope } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { SessionProvider } from '@/components/providers/session-provider';
import './globals.css';

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
  display: 'swap',
});

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://pms.chamelioguest.com';

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: 'Chamelio PMS — Property Management System',
    template: '%s — Chamelio PMS',
  },
  description: 'SaaS PMS multi-tenant para gestión hotelera',
  applicationName: 'Chamelio PMS',
  openGraph: {
    title: 'Chamelio PMS',
    description: 'SaaS PMS multi-tenant para gestión hotelera',
    url: APP_URL,
    siteName: 'Chamelio PMS',
    type: 'website',
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <link
          href="https://fonts.googleapis.com/icon?family=Material+Icons|Material+Icons+Round|Material+Icons+Outlined"
          rel="stylesheet"
        />
      </head>
      <body className={`${manrope.variable} font-sans antialiased`}>
        <SessionProvider>
          <NextIntlClientProvider messages={messages}>
            {children}
          </NextIntlClientProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
