import type { Metadata } from 'next';
import Link from 'next/link';
import { RegisterForm } from '@/components/auth/register-form';
import { HotelOSLogo } from '@/components/shared/hotel-os-logo';

export const metadata: Metadata = {
  title: 'Crear cuenta — HotelOS',
};

export default function RegisterPage() {
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
            Empieza a gestionar tu
            <br />
            alojamiento en minutos.
          </h1>
          <p className="text-lg text-slate-400 max-w-md">
            Crea tu cuenta, configura tu establecimiento y empieza a recibir reservas.
            Sin tarjeta de crédito.
          </p>
          <ul className="space-y-3 text-sm text-slate-300">
            <li className="flex items-center gap-3">
              <span className="material-icons text-primary text-base">check_circle</span>
              Plan gratuito para empezar
            </li>
            <li className="flex items-center gap-3">
              <span className="material-icons text-primary text-base">check_circle</span>
              Varias propiedades en una sola cuenta
            </li>
            <li className="flex items-center gap-3">
              <span className="material-icons text-primary text-base">check_circle</span>
              Invita a tu equipo cuando quieras
            </li>
          </ul>
        </div>

        <p className="text-xs text-slate-600">
          &copy; {new Date().getFullYear()} HotelOS. Todos los derechos reservados.
        </p>
      </div>

      {/* Right panel — register form */}
      <div className="flex w-full lg:w-1/2 items-center justify-center bg-background-light dark:bg-background-dark p-8">
        <div className="w-full max-w-md space-y-8">
          <div className="flex items-center gap-3 lg:hidden">
            <HotelOSLogo className="h-10 w-10" />
            <span className="text-xl font-bold text-slate-900 dark:text-white">HotelOS</span>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
              Crear cuenta
            </h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Configura tu organización y empieza ahora mismo.
            </p>
          </div>

          <RegisterForm />

          <p className="text-center text-xs text-slate-400">
            ¿Ya tienes cuenta?{' '}
            <Link href="/login" className="text-primary hover:underline">
              Inicia sesión
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
