import Link from 'next/link';
import { CreateOrganizationForm } from '@/components/admin/create-organization-form';

export default function NewOrganizationPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
      <div>
        <Link
          href="/admin/organizations"
          className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 flex items-center gap-1 mb-2"
        >
          <span className="material-icons text-[16px]">arrow_back</span>
          Volver a organizaciones
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Nueva organización</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Crea la organización y se generará un link de invitación para enviar al owner.
          La cuenta queda inactiva hasta que acepte la invitación.
        </p>
      </div>

      <CreateOrganizationForm />
    </div>
  );
}
