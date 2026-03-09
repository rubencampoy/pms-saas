'use client';

import { useState, useTransition } from 'react';
import { format, addDays, parseISO, differenceInDays } from 'date-fns';
import {
  createRatePlan,
  updateRatePlan,
  deleteRatePlan,
  createSeason,
  updateSeason,
  deleteSeason,
  createSupplement,
  updateSupplement,
  deleteSupplement,
} from '@/server/actions/rates';
import { RateGridTab } from '@/components/settings/rate-grid/rate-grid-tab';

interface Property {
  id: string;
  name: string;
  code: string;
}

interface RoomType {
  id: string;
  name: string;
  code: string;
  sortOrder: number;
}

interface RatePlan {
  id: string;
  propertyId: string;
  name: string;
  code: string;
  description: string | null;
  cancellationPolicy: string;
  cancellationHours: number;
  isActive: boolean;
  priority: number;
}

interface Rate {
  id: string;
  ratePlanId: string;
  roomTypeId: string;
  date: string;
  amount: string;
  currency: string;
  minStay: number;
  maxStay: number | null;
  closedToArrival: boolean;
  closedToDeparture: boolean;
}

interface Season {
  id: string;
  propertyId: string;
  name: string;
  startDate: string;
  endDate: string;
  color: string;
}

interface Supplement {
  id: string;
  propertyId: string;
  name: string;
  type: string;
  amount: string;
  taxRate: string;
  isActive: boolean;
}

interface RatesClientProps {
  properties: Property[];
  defaultPropertyId: string;
  roomTypes: RoomType[];
  ratePlans: RatePlan[];
  rates: Rate[];
  seasons: Season[];
  supplements: Supplement[];
  startDate: string;
  endDate: string;
  initialPlanId?: string;
}

const CANCELLATION_LABELS: Record<string, string> = {
  free: 'Free Cancellation',
  moderate: 'Moderate',
  strict: 'Strict',
  non_refundable: 'Non-Refundable',
};

const SUPPLEMENT_TYPE_LABELS: Record<string, string> = {
  per_night: 'Per Night',
  per_stay: 'Per Stay',
  per_person_per_night: 'Per Person/Night',
  one_time: 'One Time',
};

type ActiveTab = 'plans' | 'grid' | 'seasons' | 'supplements';

export function RatesClient({
  roomTypes,
  ratePlans,
  rates,
  seasons,
  supplements,
  defaultPropertyId,
  startDate,
  endDate,
  initialPlanId,
}: RatesClientProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('plans');

  const tabs: Array<{ key: ActiveTab; label: string; icon: string }> = [
    { key: 'plans', label: 'Rate Plans', icon: 'sell' },
    { key: 'grid', label: 'Rate Grid', icon: 'grid_on' },
    { key: 'seasons', label: 'Seasons', icon: 'date_range' },
    { key: 'supplements', label: 'Supplements', icon: 'add_shopping_cart' },
  ];

  return (
    <div>
      {/* Sub-tabs */}
      <div className="flex items-center gap-1 mb-6 border-b border-slate-200 dark:border-slate-700">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === tab.key
                ? 'text-primary border-primary'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border-transparent hover:border-slate-300 dark:hover:border-slate-600'
            }`}
          >
            <span className={`material-icons text-lg ${activeTab === tab.key ? 'text-primary' : ''}`}>
              {tab.icon}
            </span>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'plans' && (
        <RatePlansTab ratePlans={ratePlans} propertyId={defaultPropertyId} />
      )}
      {activeTab === 'grid' && (
        <RateGridTab
          ratePlans={ratePlans}
          roomTypes={roomTypes}
          rates={rates}
          seasons={seasons}
          startDate={startDate}
          endDate={endDate}
          propertyId={defaultPropertyId}
          initialPlanId={initialPlanId}
        />
      )}
      {activeTab === 'seasons' && (
        <SeasonsTab seasons={seasons} propertyId={defaultPropertyId} />
      )}
      {activeTab === 'supplements' && (
        <SupplementsTab supplements={supplements} propertyId={defaultPropertyId} />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════
   RATE PLANS TAB
   ═══════════════════════════════════════════ */

function RatePlansTab({ ratePlans, propertyId }: { ratePlans: RatePlan[]; propertyId: string }) {
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [editingPlan, setEditingPlan] = useState<RatePlan | null>(null);

  function handleDelete(id: string) {
    if (!confirm('Delete this rate plan? All associated rates will be lost.')) return;
    startTransition(async () => {
      await deleteRatePlan(id);
    });
  }

  function handleToggleActive(plan: RatePlan) {
    startTransition(async () => {
      await updateRatePlan({ id: plan.id, isActive: !plan.isActive });
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Rate Plans</h3>
        <button
          onClick={() => { setEditingPlan(null); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors shadow-sm shadow-primary/30"
        >
          <span className="material-icons text-lg">add</span>
          New Rate Plan
        </button>
      </div>

      <div className="bg-white dark:bg-[#1a2632] rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 dark:bg-white/5">
              <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Name</th>
              <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Code</th>
              <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Cancellation</th>
              <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
              <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Priority</th>
              <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {ratePlans.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-sm text-slate-400">
                  No rate plans yet. Create your first rate plan.
                </td>
              </tr>
            )}
            {ratePlans.map((plan) => (
              <tr key={plan.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <td className="p-4">
                  <div className="font-semibold text-slate-900 dark:text-white text-sm">{plan.name}</div>
                  {plan.description && (
                    <div className="text-xs text-slate-500 truncate max-w-[200px]">{plan.description}</div>
                  )}
                </td>
                <td className="p-4">
                  <span className="text-xs font-mono bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-slate-600 dark:text-slate-300">
                    {plan.code}
                  </span>
                </td>
                <td className="p-4 text-sm text-slate-600 dark:text-slate-300">
                  {CANCELLATION_LABELS[plan.cancellationPolicy] ?? plan.cancellationPolicy}
                  {plan.cancellationPolicy !== 'non_refundable' && plan.cancellationHours > 0 && (
                    <span className="text-xs text-slate-400 ml-1">({plan.cancellationHours}h)</span>
                  )}
                </td>
                <td className="p-4">
                  <button
                    onClick={() => handleToggleActive(plan)}
                    disabled={isPending}
                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors ${
                      plan.isActive
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${plan.isActive ? 'bg-green-500' : 'bg-slate-400'}`}></span>
                    {plan.isActive ? 'Active' : 'Inactive'}
                  </button>
                </td>
                <td className="p-4 text-sm text-slate-600 dark:text-slate-300 tabular-nums">{plan.priority}</td>
                <td className="p-4">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => { setEditingPlan(plan); setShowForm(true); }}
                      className="p-1.5 text-slate-400 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    >
                      <span className="material-icons text-lg">edit</span>
                    </button>
                    <button
                      onClick={() => handleDelete(plan.id)}
                      disabled={isPending}
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
                    >
                      <span className="material-icons text-lg">delete</span>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <RatePlanFormDialog
          ratePlan={editingPlan}
          propertyId={propertyId}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  );
}

function RatePlanFormDialog({
  ratePlan,
  propertyId,
  onClose,
}: {
  ratePlan: RatePlan | null;
  propertyId: string;
  onClose: () => void;
}) {
  const isEdit = !!ratePlan;
  const [name, setName] = useState(ratePlan?.name ?? '');
  const [code, setCode] = useState(ratePlan?.code ?? '');
  const [description, setDescription] = useState(ratePlan?.description ?? '');
  const [cancellationPolicy, setCancellationPolicy] = useState(ratePlan?.cancellationPolicy ?? 'free');
  const [cancellationHours, setCancellationHours] = useState(ratePlan?.cancellationHours ?? 24);
  const [priority, setPriority] = useState(ratePlan?.priority ?? 0);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = isEdit
        ? await updateRatePlan({ id: ratePlan.id, name, code, description: description || undefined, cancellationPolicy: cancellationPolicy as 'free' | 'moderate' | 'strict' | 'non_refundable', cancellationHours, priority })
        : await createRatePlan({ propertyId, name, code, description: description || undefined, cancellationPolicy: cancellationPolicy as 'free' | 'moderate' | 'strict' | 'non_refundable', cancellationHours, priority });
      if (result.success) {
        onClose();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose}></div>
      <div className="relative bg-white dark:bg-[#1a2632] rounded-xl shadow-2xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            {isEdit ? 'Edit Rate Plan' : 'New Rate Plan'}
          </h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
            <span className="material-icons">close</span>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">{error}</div>}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} required className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Code</label>
              <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} required maxLength={10} className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-mono focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Cancellation Policy</label>
              <select value={cancellationPolicy} onChange={(e) => setCancellationPolicy(e.target.value)} className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none">
                <option value="free">Free</option>
                <option value="moderate">Moderate</option>
                <option value="strict">Strict</option>
                <option value="non_refundable">Non-Refundable</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Cancel Hours</label>
              <input type="number" value={cancellationHours} onChange={(e) => setCancellationHours(Number(e.target.value))} min={0} max={720} className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Priority</label>
            <input type="number" value={priority} onChange={(e) => setPriority(Number(e.target.value))} min={0} max={100} className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">Cancel</button>
            <button type="submit" disabled={isPending} className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors shadow-sm shadow-primary/30 disabled:opacity-50">
              {isPending ? 'Saving...' : isEdit ? 'Save Changes' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   SEASONS TAB
   ═══════════════════════════════════════════ */

function SeasonsTab({ seasons, propertyId }: { seasons: Season[]; propertyId: string }) {
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [editingSeason, setEditingSeason] = useState<Season | null>(null);

  function handleDelete(id: string) {
    if (!confirm('Delete this season?')) return;
    startTransition(async () => {
      await deleteSeason(id);
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Seasons</h3>
        <button
          onClick={() => { setEditingSeason(null); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors shadow-sm shadow-primary/30"
        >
          <span className="material-icons text-lg">add</span>
          New Season
        </button>
      </div>

      {seasons.length === 0 ? (
        <div className="p-8 text-center text-sm text-slate-400 bg-white dark:bg-[#1a2632] rounded-xl border border-slate-200 dark:border-slate-800">
          No seasons defined. Seasons help organize rate periods.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {seasons.map((season) => (
            <div
              key={season.id}
              className="bg-white dark:bg-[#1a2632] rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden"
            >
              <div className="h-2" style={{ backgroundColor: season.color }}></div>
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">{season.name}</h4>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => { setEditingSeason(season); setShowForm(true); }}
                      className="p-1 text-slate-400 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                    >
                      <span className="material-icons text-sm">edit</span>
                    </button>
                    <button
                      onClick={() => handleDelete(season.id)}
                      disabled={isPending}
                      className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors disabled:opacity-50"
                    >
                      <span className="material-icons text-sm">delete</span>
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span className="material-icons text-sm">date_range</span>
                  {format(parseISO(season.startDate), 'MMM d, yyyy')} — {format(parseISO(season.endDate), 'MMM d, yyyy')}
                </div>
                <div className="mt-2 text-xs text-slate-400">
                  {differenceInDays(parseISO(season.endDate), parseISO(season.startDate)) + 1} days
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <SeasonFormDialog
          season={editingSeason}
          propertyId={propertyId}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  );
}

function SeasonFormDialog({
  season,
  propertyId,
  onClose,
}: {
  season: Season | null;
  propertyId: string;
  onClose: () => void;
}) {
  const isEdit = !!season;
  const [name, setName] = useState(season?.name ?? '');
  const [sStartDate, setSStartDate] = useState(season?.startDate ?? format(new Date(), 'yyyy-MM-dd'));
  const [sEndDate, setSEndDate] = useState(season?.endDate ?? format(addDays(new Date(), 30), 'yyyy-MM-dd'));
  const [color, setColor] = useState(season?.color ?? '#3B82F6');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = isEdit
        ? await updateSeason({ id: season.id, name, startDate: sStartDate, endDate: sEndDate, color })
        : await createSeason({ propertyId, name, startDate: sStartDate, endDate: sEndDate, color });
      if (result.success) {
        onClose();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose}></div>
      <div className="relative bg-white dark:bg-[#1a2632] rounded-xl shadow-2xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            {isEdit ? 'Edit Season' : 'New Season'}
          </h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
            <span className="material-icons">close</span>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">{error}</div>}
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} required className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" placeholder="Summer 2026" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Color</label>
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-12 h-10 rounded-lg border border-slate-300 dark:border-slate-700 cursor-pointer" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Start Date</label>
              <input type="date" value={sStartDate} onChange={(e) => setSStartDate(e.target.value)} className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">End Date</label>
              <input type="date" value={sEndDate} onChange={(e) => setSEndDate(e.target.value)} className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">Cancel</button>
            <button type="submit" disabled={isPending} className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors shadow-sm shadow-primary/30 disabled:opacity-50">
              {isPending ? 'Saving...' : isEdit ? 'Save Changes' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   SUPPLEMENTS TAB
   ═══════════════════════════════════════════ */

function SupplementsTab({ supplements, propertyId }: { supplements: Supplement[]; propertyId: string }) {
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [editingSupplement, setEditingSupplement] = useState<Supplement | null>(null);

  function handleDelete(id: string) {
    if (!confirm('Delete this supplement?')) return;
    startTransition(async () => {
      await deleteSupplement(id);
    });
  }

  function handleToggleActive(supp: Supplement) {
    startTransition(async () => {
      await updateSupplement({ id: supp.id, isActive: !supp.isActive });
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Supplements & Extras</h3>
        <button
          onClick={() => { setEditingSupplement(null); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors shadow-sm shadow-primary/30"
        >
          <span className="material-icons text-lg">add</span>
          New Supplement
        </button>
      </div>

      <div className="bg-white dark:bg-[#1a2632] rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 dark:bg-white/5">
              <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Name</th>
              <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Type</th>
              <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Amount</th>
              <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tax Rate</th>
              <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
              <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {supplements.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-sm text-slate-400">
                  No supplements. Add extras like Breakfast, Parking, etc.
                </td>
              </tr>
            )}
            {supplements.map((supp) => (
              <tr key={supp.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <td className="p-4 text-sm font-semibold text-slate-900 dark:text-white">{supp.name}</td>
                <td className="p-4 text-sm text-slate-600 dark:text-slate-300">
                  {SUPPLEMENT_TYPE_LABELS[supp.type] ?? supp.type}
                </td>
                <td className="p-4 text-sm font-semibold text-slate-900 dark:text-white tabular-nums">
                  {parseFloat(supp.amount).toFixed(2)}€
                </td>
                <td className="p-4 text-sm text-slate-600 dark:text-slate-300 tabular-nums">
                  {parseFloat(supp.taxRate).toFixed(0)}%
                </td>
                <td className="p-4">
                  <button
                    onClick={() => handleToggleActive(supp)}
                    disabled={isPending}
                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors ${
                      supp.isActive
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${supp.isActive ? 'bg-green-500' : 'bg-slate-400'}`}></span>
                    {supp.isActive ? 'Active' : 'Inactive'}
                  </button>
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => { setEditingSupplement(supp); setShowForm(true); }}
                      className="p-1.5 text-slate-400 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    >
                      <span className="material-icons text-lg">edit</span>
                    </button>
                    <button
                      onClick={() => handleDelete(supp.id)}
                      disabled={isPending}
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
                    >
                      <span className="material-icons text-lg">delete</span>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <SupplementFormDialog
          supplement={editingSupplement}
          propertyId={propertyId}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  );
}

function SupplementFormDialog({
  supplement,
  propertyId,
  onClose,
}: {
  supplement: Supplement | null;
  propertyId: string;
  onClose: () => void;
}) {
  const isEdit = !!supplement;
  const [name, setName] = useState(supplement?.name ?? '');
  const [type, setType] = useState(supplement?.type ?? 'per_night');
  const [amount, setAmount] = useState(supplement?.amount ?? '');
  const [taxRate, setTaxRate] = useState(supplement?.taxRate ?? '10');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = isEdit
        ? await updateSupplement({ id: supplement.id, name, type: type as 'per_night' | 'per_stay' | 'per_person_per_night' | 'one_time', amount, taxRate })
        : await createSupplement({ propertyId, name, type: type as 'per_night' | 'per_stay' | 'per_person_per_night' | 'one_time', amount, taxRate });
      if (result.success) {
        onClose();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose}></div>
      <div className="relative bg-white dark:bg-[#1a2632] rounded-xl shadow-2xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            {isEdit ? 'Edit Supplement' : 'New Supplement'}
          </h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
            <span className="material-icons">close</span>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" placeholder="Breakfast" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Charge Type</label>
            <select value={type} onChange={(e) => setType(e.target.value)} className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none">
              <option value="per_night">Per Night</option>
              <option value="per_stay">Per Stay</option>
              <option value="per_person_per_night">Per Person / Night</option>
              <option value="one_time">One Time</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Amount (EUR)</label>
              <input type="text" value={amount} onChange={(e) => setAmount(e.target.value)} required placeholder="12.00" className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm tabular-nums focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Tax Rate (%)</label>
              <input type="text" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} placeholder="10" className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm tabular-nums focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">Cancel</button>
            <button type="submit" disabled={isPending} className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors shadow-sm shadow-primary/30 disabled:opacity-50">
              {isPending ? 'Saving...' : isEdit ? 'Save Changes' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
