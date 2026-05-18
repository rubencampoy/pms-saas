import type { Metadata } from 'next';
import Link from 'next/link';
import { LoginForm } from '@/components/auth/login-form';
import { HotelOSLogo } from '@/components/shared/hotel-os-logo';

export const metadata: Metadata = {
  title: 'Iniciar sesión — HotelOS',
};

export default function LoginPage() {
  return (
    <div className="flex min-h-screen">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#0a1118] to-[#1a2632] flex-col justify-between p-12">
        <div className="flex items-center gap-3">
          <HotelOSLogo className="h-10 w-10" />
          <span className="text-xl font-bold text-white">HotelOS</span>
        </div>

        <div className="space-y-6">
          <h1 className="text-4xl font-bold text-white leading-tight">
            Gestiona tu alojamiento
            <br />
            de forma inteligente.
          </h1>
          <p className="text-lg text-slate-400 max-w-md">
            Reservas, check-in, housekeeping, facturación y mucho más.
            Todo en una sola plataforma.
          </p>
          <div className="flex items-center gap-8 pt-4">
            <div>
              <p className="text-2xl font-bold text-white">500+</p>
              <p className="text-sm text-slate-500">Propiedades</p>
            </div>
            <div className="h-10 w-px bg-slate-700" />
            <div>
              <p className="text-2xl font-bold text-white">12K+</p>
              <p className="text-sm text-slate-500">Reservas/mes</p>
            </div>
            <div className="h-10 w-px bg-slate-700" />
            <div>
              <p className="text-2xl font-bold text-white">99.9%</p>
              <p className="text-sm text-slate-500">Uptime</p>
            </div>
          </div>
        </div>

        <p className="text-xs text-slate-600">
          &copy; {new Date().getFullYear()} HotelOS. Todos los derechos reservados.
        </p>
      </div>

      {/* Right panel — login form */}
      <div className="flex w-full lg:w-1/2 items-center justify-center bg-background-light dark:bg-background-dark p-8">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 lg:hidden">
            <HotelOSLogo className="h-10 w-10" />
            <span className="text-xl font-bold text-slate-900 dark:text-white">HotelOS</span>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
              Iniciar sesión
            </h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Introduce tus credenciales para acceder al panel.
            </p>
          </div>

          <LoginForm />

          <div className="text-center text-xs text-slate-400 space-y-2">
            <p>
              ¿Problemas para acceder?{' '}
              <a href="/forgot-password" className="text-primary hover:underline">
                Recuperar contraseña
              </a>
            </p>
            <p>
              ¿Aún no tienes cuenta?{' '}
              <Link href="/register" className="text-primary hover:underline">
                Crear una nueva organización
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
