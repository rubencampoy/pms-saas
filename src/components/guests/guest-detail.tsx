'use client';

interface GuestData {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  documentType: string | null;
  documentNumber: string | null;
  nationality: string | null;
  dateOfBirth: string | null;
  address: Record<string, string> | null;
  vipStatus: string;
  notes: string | null;
  totalStays: number;
  totalRevenue: string;
  createdAt: string;
}

interface ReservationRow {
  id: string;
  confirmationCode: string;
  status: string;
  source: string;
  checkInDate: string;
  checkOutDate: string;
  nights: number;
  totalAmount: string;
  currency: string;
  propertyName: string;
  roomTypeName: string;
}

interface GuestDetailProps {
  guest: GuestData;
  reservations: ReservationRow[];
}

const STATUS_CONFIG: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  confirmed: {
    bg: 'bg-blue-100 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800',
    text: 'text-blue-800 dark:text-blue-300',
    dot: 'bg-blue-500',
    label: 'Confirmed',
  },
  checked_in: {
    bg: 'bg-emerald-100 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800',
    text: 'text-emerald-800 dark:text-emerald-400',
    dot: 'bg-emerald-500',
    label: 'Checked In',
  },
  checked_out: {
    bg: 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700',
    text: 'text-slate-800 dark:text-slate-300',
    dot: 'bg-slate-500',
    label: 'Checked Out',
  },
  cancelled: {
    bg: 'bg-red-100 dark:bg-red-900/30 border-red-200 dark:border-red-800',
    text: 'text-red-800 dark:text-red-300',
    dot: 'bg-red-500',
    label: 'Cancelled',
  },
  no_show: {
    bg: 'bg-amber-100 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800',
    text: 'text-amber-800 dark:text-amber-300',
    dot: 'bg-amber-500',
    label: 'No Show',
  },
};

const VIP_CONFIG: Record<string, { label: string; color: string }> = {
  gold: { label: 'VIP Gold', color: 'text-amber-600 dark:text-amber-400' },
  platinum: { label: 'VIP Platinum', color: 'text-purple-600 dark:text-purple-400' },
  diamond: { label: 'VIP Diamond', color: 'text-cyan-600 dark:text-cyan-400' },
};

const DOC_TYPE_LABELS: Record<string, string> = {
  passport: 'Passport',
  id_card: 'ID Card',
  drivers_license: "Driver's License",
};

function fmtDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtCurrency(amount: string, currency: string = 'EUR'): string {
  const sym = currency === 'EUR' ? '\u20AC' : currency;
  return `${sym}${Number(amount).toLocaleString('es-ES', { minimumFractionDigits: 2 })}`;
}

export function GuestDetail({ guest, reservations }: GuestDetailProps) {
  const vipConf = guest.vipStatus !== 'none' ? VIP_CONFIG[guest.vipStatus] : null;

  return (
    <div className="p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <a
              href="/guests"
              className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-primary transition-colors mb-2"
            >
              <span className="material-icons text-[16px] mr-1">arrow_back</span>
              Back to Guests
            </a>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xl border-4 border-slate-50 dark:border-slate-800">
                {guest.firstName.charAt(0)}{guest.lastName.charAt(0)}
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                    {guest.firstName} {guest.lastName}
                  </h1>
                  {vipConf && (
                    <span className={`flex items-center gap-1 text-xs font-bold uppercase tracking-wider ${vipConf.color}`}>
                      <span className="material-icons text-sm">stars</span>
                      {vipConf.label}
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Guest since {new Date(guest.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left column - Profile */}
          <div className="lg:col-span-4 space-y-6">
            {/* Stats Card */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                  <div className="text-2xl font-bold text-slate-900 dark:text-white">{guest.totalStays}</div>
                  <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mt-1">Total Stays</div>
                </div>
                <div className="text-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                  <div className="text-2xl font-bold text-primary">{fmtCurrency(guest.totalRevenue)}</div>
                  <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mt-1">Total Revenue</div>
                </div>
              </div>
            </div>

            {/* Contact Info Card */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900">
                <h2 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="material-icons text-primary text-[20px]">person</span>
                  Contact Information
                </h2>
              </div>
              <div className="p-6 space-y-4">
                {guest.email && (
                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                      <span className="material-icons text-slate-400 text-[18px]">email</span>
                    </div>
                    <a href={`mailto:${guest.email}`} className="text-slate-600 dark:text-slate-300 hover:text-primary transition-colors truncate">
                      {guest.email}
                    </a>
                  </div>
                )}
                {guest.phone && (
                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                      <span className="material-icons text-slate-400 text-[18px]">phone</span>
                    </div>
                    <span className="text-slate-600 dark:text-slate-300">{guest.phone}</span>
                  </div>
                )}
                {guest.nationality && (
                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                      <span className="material-icons text-slate-400 text-[18px]">flag</span>
                    </div>
                    <span className="text-slate-600 dark:text-slate-300">{guest.nationality}</span>
                  </div>
                )}
                {guest.dateOfBirth && (
                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                      <span className="material-icons text-slate-400 text-[18px]">cake</span>
                    </div>
                    <span className="text-slate-600 dark:text-slate-300">{fmtDate(guest.dateOfBirth)}</span>
                  </div>
                )}
                {guest.documentType && guest.documentNumber && (
                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                      <span className="material-icons text-slate-400 text-[18px]">badge</span>
                    </div>
                    <div>
                      <span className="text-slate-600 dark:text-slate-300">{guest.documentNumber}</span>
                      <span className="text-xs text-slate-400 ml-2">
                        ({DOC_TYPE_LABELS[guest.documentType] ?? guest.documentType})
                      </span>
                    </div>
                  </div>
                )}
                {guest.address && Object.values(guest.address).some(Boolean) && (
                  <div className="flex items-start gap-3 text-sm">
                    <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0">
                      <span className="material-icons text-slate-400 text-[18px]">home</span>
                    </div>
                    <span className="text-slate-600 dark:text-slate-300">
                      {[guest.address.street, guest.address.city, guest.address.state, guest.address.postalCode, guest.address.country]
                        .filter(Boolean)
                        .join(', ')}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Notes Card */}
            {guest.notes && (
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900">
                  <h2 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <span className="material-icons text-primary text-[20px]">sticky_note_2</span>
                    Notes
                  </h2>
                </div>
                <div className="p-6">
                  <p className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap">{guest.notes}</p>
                </div>
              </div>
            )}
          </div>

          {/* Right column - Reservations */}
          <div className="lg:col-span-8">
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="material-icons text-primary text-[20px]">calendar_month</span>
                  Reservation History
                </h2>
                <span className="text-xs font-medium text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                  {reservations.length} reservation{reservations.length !== 1 ? 's' : ''}
                </span>
              </div>

              {reservations.length === 0 ? (
                <div className="p-8 text-center">
                  <span className="material-icons text-4xl text-slate-300 dark:text-slate-600 mb-2 block">
                    event_busy
                  </span>
                  <p className="text-sm text-slate-500 dark:text-slate-400">No reservations yet.</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 dark:bg-white/5">
                    <tr>
                      <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Confirmation</th>
                      <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Property</th>
                      <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Dates</th>
                      <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Room Type</th>
                      <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                      <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {reservations.map((res) => {
                      const sc = STATUS_CONFIG[res.status];
                      return (
                        <tr key={res.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="p-4">
                            <a
                              href={`/reservations/${res.id}`}
                              className="text-sm font-semibold text-primary hover:underline"
                            >
                              {res.confirmationCode}
                            </a>
                          </td>
                          <td className="p-4 text-sm text-slate-700 dark:text-slate-300">
                            {res.propertyName}
                          </td>
                          <td className="p-4">
                            <div className="text-sm text-slate-700 dark:text-slate-300">
                              {fmtDate(res.checkInDate)} — {fmtDate(res.checkOutDate)}
                            </div>
                            <div className="text-xs text-slate-500">{res.nights} night{res.nights !== 1 ? 's' : ''}</div>
                          </td>
                          <td className="p-4 text-sm text-slate-700 dark:text-slate-300">
                            {res.roomTypeName}
                          </td>
                          <td className="p-4">
                            {sc && (
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${sc.bg} ${sc.text}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${sc.dot} mr-1.5`} />
                                {sc.label}
                              </span>
                            )}
                          </td>
                          <td className="p-4 text-sm font-medium text-slate-900 dark:text-white text-right tabular-nums">
                            {fmtCurrency(res.totalAmount, res.currency)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
