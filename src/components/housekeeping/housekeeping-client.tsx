'use client';

import { useMemo, useState, useTransition } from 'react';
import {
  updateHousekeepingTaskStatus,
  assignHousekeepingTask,
  updateUnitHousekeepingStatus,
  createHousekeepingTask,
} from '@/server/actions/housekeeping';
import { format } from 'date-fns';

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

interface Unit {
  id: string;
  propertyId: string;
  roomTypeId: string;
  name: string;
  floor: string | null;
  status: string;
  housekeepingStatus: string;
}

interface HousekeepingTask {
  id: string;
  propertyId: string;
  unitId: string;
  type: string;
  status: string;
  priority: string;
  assignedTo: string | null;
  scheduledDate: string;
  startedAt: Date | null;
  completedAt: Date | null;
  notes: string | null;
}

interface StaffMember {
  id: string;
  name: string;
  role: string;
}

interface HkStatusCount {
  status: string;
  count: number;
}

interface HousekeepingClientProps {
  properties: Property[];
  defaultPropertyId: string;
  units: Unit[];
  roomTypes: RoomType[];
  tasks: HousekeepingTask[];
  staff: StaffMember[];
  hkStatusCounts: HkStatusCount[];
  currentDate: string;
}

interface HkStatusConf {
  label: string;
  bg: string;
  text: string;
  dot: string;
  icon: string;
}

const HK_STATUS_CONFIG: Record<string, HkStatusConf> = {
  dirty: {
    label: 'Dirty',
    bg: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
    text: 'text-red-700 dark:text-red-400',
    dot: 'bg-red-500',
    icon: 'warning',
  },
  cleaning: {
    label: 'Cleaning',
    bg: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
    text: 'text-amber-700 dark:text-amber-400',
    dot: 'bg-amber-500',
    icon: 'cleaning_services',
  },
  clean: {
    label: 'Clean',
    bg: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
    text: 'text-green-700 dark:text-green-400',
    dot: 'bg-green-500',
    icon: 'check_circle',
  },
  inspected: {
    label: 'Inspected',
    bg: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
    text: 'text-blue-700 dark:text-blue-400',
    dot: 'bg-blue-500',
    icon: 'verified',
  },
};

const FALLBACK_HK: HkStatusConf = { label: 'Unknown', bg: '', text: 'text-slate-500', dot: 'bg-slate-400', icon: 'help' };

function getHkConf(status: string): HkStatusConf {
  return HK_STATUS_CONFIG[status] ?? FALLBACK_HK;
}

const TASK_TYPE_LABEL: Record<string, string> = {
  checkout_clean: 'Checkout Clean',
  stay_over: 'Stay Over',
  deep_clean: 'Deep Clean',
  inspection: 'Inspection',
};

interface TaskStatusConf { label: string; classes: string }

const TASK_STATUS_CONFIG: Record<string, TaskStatusConf> = {
  pending: { label: 'Pending', classes: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' },
  in_progress: { label: 'In Progress', classes: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' },
  completed: { label: 'Completed', classes: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' },
  skipped: { label: 'Skipped', classes: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400' },
};

const FALLBACK_TASK_STATUS: TaskStatusConf = { label: 'Unknown', classes: 'bg-slate-100 text-slate-500' };

function getTaskStatusConf(status: string): TaskStatusConf {
  return TASK_STATUS_CONFIG[status] ?? FALLBACK_TASK_STATUS;
}

interface PriorityConf { label: string; classes: string }

const PRIORITY_CONFIG: Record<string, PriorityConf> = {
  low: { label: 'Low', classes: 'text-slate-400' },
  normal: { label: 'Normal', classes: 'text-slate-500' },
  high: { label: 'High', classes: 'text-amber-500' },
  urgent: { label: 'Urgent', classes: 'text-red-500' },
};

const FALLBACK_PRIORITY: PriorityConf = { label: 'Normal', classes: 'text-slate-500' };

function getPriorityConf(priority: string): PriorityConf {
  return PRIORITY_CONFIG[priority] ?? FALLBACK_PRIORITY;
}

type ViewMode = 'board' | 'tasks';

export function HousekeepingClient({
  units,
  roomTypes,
  tasks,
  staff,
  hkStatusCounts,
  currentDate,
}: HousekeepingClientProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('board');
  const [taskFilter, setTaskFilter] = useState<string>('all');
  const [isPending, startTransition] = useTransition();
  const [showNewTaskDialog, setShowNewTaskDialog] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);

  // Group units by floor
  const unitsByFloor = useMemo(() => {
    const floors = new Map<string, Unit[]>();
    const sorted = [...units].sort((a, b) => a.name.localeCompare(b.name));
    for (const unit of sorted) {
      const floor = unit.floor ?? 'Other';
      const existing = floors.get(floor) ?? [];
      existing.push(unit);
      floors.set(floor, existing);
    }
    // Sort floors descending (top floors first)
    return Array.from(floors.entries()).sort((a, b) => {
      const numA = parseInt(a[0]);
      const numB = parseInt(b[0]);
      if (!isNaN(numA) && !isNaN(numB)) return numB - numA;
      return b[0].localeCompare(a[0]);
    });
  }, [units]);

  // Map tasks by unitId
  const tasksByUnit = useMemo(() => {
    const map = new Map<string, HousekeepingTask[]>();
    for (const t of tasks) {
      const existing = map.get(t.unitId) ?? [];
      existing.push(t);
      map.set(t.unitId, existing);
    }
    return map;
  }, [tasks]);

  // Room type map
  const roomTypeMap = useMemo(
    () => new Map(roomTypes.map((rt) => [rt.id, rt])),
    [roomTypes],
  );

  // Staff map
  const staffMap = useMemo(
    () => new Map(staff.map((s) => [s.id, s])),
    [staff],
  );

  // Status counts
  const statusCounts = useMemo(() => {
    const map: Record<string, number> = { dirty: 0, cleaning: 0, clean: 0, inspected: 0 };
    for (const item of hkStatusCounts) {
      map[item.status] = item.count;
    }
    return map;
  }, [hkStatusCounts]);

  // Filtered tasks for list view
  const filteredTasks = useMemo(() => {
    if (taskFilter === 'all') return tasks;
    return tasks.filter((t) => t.status === taskFilter);
  }, [tasks, taskFilter]);

  // Task status counts
  const taskStatusCounts = useMemo(() => {
    const map: Record<string, number> = { pending: 0, in_progress: 0, completed: 0, skipped: 0 };
    for (const t of tasks) {
      map[t.status] = (map[t.status] ?? 0) + 1;
    }
    return map;
  }, [tasks]);

  function handleTaskStatusChange(taskId: string, newStatus: string) {
    startTransition(async () => {
      await updateHousekeepingTaskStatus({ id: taskId, status: newStatus as 'pending' | 'in_progress' | 'completed' | 'skipped' });
    });
  }

  function handleAssign(taskId: string, userId: string | null) {
    startTransition(async () => {
      await assignHousekeepingTask({ id: taskId, assignedTo: userId });
    });
  }

  function handleUnitStatusChange(unitId: string, status: string) {
    startTransition(async () => {
      await updateUnitHousekeepingStatus({
        unitId,
        housekeepingStatus: status as 'dirty' | 'cleaning' | 'clean' | 'inspected',
      });
    });
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white dark:bg-[#1a2632] border-b border-slate-200 dark:border-slate-700 px-8 h-20 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Housekeeping</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {format(new Date(currentDate + 'T12:00:00'), 'EEEE, MMMM d, yyyy')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
            <button
              onClick={() => setViewMode('board')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'board'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <span className="material-icons text-lg">grid_view</span>
              Board
            </button>
            <button
              onClick={() => setViewMode('tasks')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'tasks'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <span className="material-icons text-lg">list</span>
              Tasks
            </button>
          </div>
          <button
            onClick={() => setShowNewTaskDialog(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors shadow-sm shadow-primary/30"
          >
            <span className="material-icons text-lg">add</span>
            New Task
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8">
        {/* KPI Cards */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          {(['dirty', 'cleaning', 'clean', 'inspected'] as const).map((status) => {
            const config = getHkConf(status);
            const count = statusCounts[status] ?? 0;
            return (
              <div
                key={status}
                className="bg-white dark:bg-[#1a2632] p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 flex items-center gap-4"
              >
                <div className={`p-3 rounded-lg ${config.bg} ${config.text}`}>
                  <span className="material-icons">{config.icon}</span>
                </div>
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{config.label}</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{count}</p>
                </div>
              </div>
            );
          })}
        </div>

        {viewMode === 'board' ? (
          /* ──────── BOARD VIEW ──────── */
          <div className="space-y-6">
            {unitsByFloor.map(([floor, floorUnits]) => (
              <div key={floor}>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                  Floor {floor}
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                  {floorUnits.map((unit) => {
                    const config = getHkConf(unit.housekeepingStatus);
                    const rt = roomTypeMap.get(unit.roomTypeId);
                    const unitTasks = tasksByUnit.get(unit.id) ?? [];
                    const activeTasks = unitTasks.filter((t) => t.status === 'pending' || t.status === 'in_progress');

                    return (
                      <button
                        key={unit.id}
                        onClick={() => setSelectedUnit(unit)}
                        className={`relative p-4 rounded-xl border-2 ${config.bg} transition-all hover:shadow-md text-left cursor-pointer ${
                          isPending ? 'opacity-60' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-lg font-bold text-slate-900 dark:text-white">
                            {unit.name}
                          </span>
                          <span className={`material-icons text-xl ${config.text}`}>
                            {config.icon}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                          {rt?.name ?? ''}
                        </p>
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${config.dot}`}></span>
                          <span className={`text-xs font-medium ${config.text}`}>
                            {config.label}
                          </span>
                        </div>
                        {activeTasks.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-slate-200/50 dark:border-slate-700/50">
                            {activeTasks.map((task) => (
                              <div key={task.id} className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
                                <span className="material-icons text-xs">
                                  {task.type === 'inspection' ? 'fact_check' : 'cleaning_services'}
                                </span>
                                <span>{TASK_TYPE_LABEL[task.type] ?? task.type}</span>
                                {task.assignedTo && (
                                  <span className="text-primary truncate ml-auto">
                                    {staffMap.get(task.assignedTo)?.name.split(' ')[0] ?? ''}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                        {unit.status === 'out_of_order' && (
                          <div className="absolute top-2 right-2">
                            <span className="material-icons text-sm text-red-500">build</span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* ──────── TASKS LIST VIEW ──────── */
          <div>
            {/* Filter pills */}
            <div className="flex items-center gap-2 mb-6">
              {[
                { key: 'all', label: 'All', count: tasks.length },
                { key: 'pending', label: 'Pending', count: taskStatusCounts.pending ?? 0 },
                { key: 'in_progress', label: 'In Progress', count: taskStatusCounts.in_progress ?? 0 },
                { key: 'completed', label: 'Completed', count: taskStatusCounts.completed ?? 0 },
                { key: 'skipped', label: 'Skipped', count: taskStatusCounts.skipped ?? 0 },
              ].map((item) => (
                <button
                  key={item.key}
                  onClick={() => setTaskFilter(item.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    taskFilter === item.key
                      ? 'bg-primary text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {item.label}
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                    taskFilter === item.key
                      ? 'bg-white/20'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                  }`}>
                    {item.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Tasks table */}
            <div className="bg-white dark:bg-[#1a2632] rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-white/5">
                    <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Room</th>
                    <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Type</th>
                    <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Priority</th>
                    <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Assigned To</th>
                    <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Notes</th>
                    <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredTasks.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-sm text-slate-400">
                        No tasks found for this filter.
                      </td>
                    </tr>
                  )}
                  {filteredTasks.map((task) => {
                    const unit = units.find((u) => u.id === task.unitId);
                    const priorityConf = getPriorityConf(task.priority);
                    const statusConf = getTaskStatusConf(task.status);

                    return (
                      <tr key={task.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="p-4">
                          <div className="font-semibold text-slate-900 dark:text-white text-sm">
                            {unit?.name ?? '—'}
                          </div>
                          <div className="text-xs text-slate-500">
                            {unit ? (roomTypeMap.get(unit.roomTypeId)?.name ?? '') : ''}
                          </div>
                        </td>
                        <td className="p-4">
                          <span className="text-sm text-slate-700 dark:text-slate-300">
                            {TASK_TYPE_LABEL[task.type] ?? task.type}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className={`inline-flex items-center gap-1 text-xs font-medium ${priorityConf.classes}`}>
                            {task.priority === 'urgent' && <span className="material-icons text-xs">priority_high</span>}
                            {task.priority === 'high' && <span className="material-icons text-xs">arrow_upward</span>}
                            {priorityConf.label}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${statusConf.classes}`}>
                            {statusConf.label}
                          </span>
                        </td>
                        <td className="p-4">
                          <select
                            className="text-xs bg-transparent border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                            value={task.assignedTo ?? ''}
                            onChange={(e) => handleAssign(task.id, e.target.value || null)}
                            disabled={isPending}
                          >
                            <option value="">Unassigned</option>
                            {staff.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="p-4">
                          <span className="text-xs text-slate-500 dark:text-slate-400 max-w-[200px] truncate block">
                            {task.notes ?? '—'}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-1">
                            {task.status === 'pending' && (
                              <button
                                onClick={() => handleTaskStatusChange(task.id, 'in_progress')}
                                disabled={isPending}
                                className="text-xs bg-primary text-white px-2 py-1 rounded hover:bg-primary/90 disabled:opacity-50"
                              >
                                Start
                              </button>
                            )}
                            {task.status === 'in_progress' && (
                              <button
                                onClick={() => handleTaskStatusChange(task.id, 'completed')}
                                disabled={isPending}
                                className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700 disabled:opacity-50"
                              >
                                Complete
                              </button>
                            )}
                            {(task.status === 'pending' || task.status === 'in_progress') && (
                              <button
                                onClick={() => handleTaskStatusChange(task.id, 'skipped')}
                                disabled={isPending}
                                className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 px-2 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
                              >
                                Skip
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ──────── Unit detail panel (modal) ──────── */}
      {selectedUnit && (
        <UnitDetailPanel
          unit={selectedUnit}
          roomType={roomTypeMap.get(selectedUnit.roomTypeId)}
          tasks={tasksByUnit.get(selectedUnit.id) ?? []}
          staffMap={staffMap}
          isPending={isPending}
          onStatusChange={handleUnitStatusChange}
          onTaskStatusChange={handleTaskStatusChange}
          onClose={() => setSelectedUnit(null)}
        />
      )}

      {/* ──────── New task dialog ──────── */}
      {showNewTaskDialog && (
        <NewTaskDialog
          units={units}
          roomTypeMap={roomTypeMap}
          defaultPropertyId={units[0]?.propertyId ?? ''}
          currentDate={currentDate}
          staff={staff}
          onClose={() => setShowNewTaskDialog(false)}
        />
      )}
    </div>
  );
}

/* ──────── Unit Detail Panel ──────── */
function UnitDetailPanel({
  unit,
  roomType,
  tasks,
  staffMap,
  isPending,
  onStatusChange,
  onTaskStatusChange,
  onClose,
}: {
  unit: Unit;
  roomType: RoomType | undefined;
  tasks: HousekeepingTask[];
  staffMap: Map<string, StaffMember>;
  isPending: boolean;
  onStatusChange: (unitId: string, status: string) => void;
  onTaskStatusChange: (taskId: string, status: string) => void;
  onClose: () => void;
}) {
  const config = getHkConf(unit.housekeepingStatus);
  const statusFlow: Array<'dirty' | 'cleaning' | 'clean' | 'inspected'> = ['dirty', 'cleaning', 'clean', 'inspected'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose}></div>
      <div className="relative bg-white dark:bg-[#1a2632] rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[80vh] overflow-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Room {unit.name}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {roomType?.name ?? ''} {unit.floor ? `· Floor ${unit.floor}` : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <span className="material-icons">close</span>
          </button>
        </div>

        {/* Current status */}
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <span className={`material-icons text-2xl ${config.text}`}>{config.icon}</span>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Current Status</p>
              <p className={`text-lg font-bold ${config.text}`}>{config.label}</p>
            </div>
          </div>

          {/* Status change buttons */}
          <div className="grid grid-cols-4 gap-2 mb-6">
            {statusFlow.map((status) => {
              const sConf = getHkConf(status);
              const isActive = unit.housekeepingStatus === status;
              return (
                <button
                  key={status}
                  onClick={() => !isActive && onStatusChange(unit.id, status)}
                  disabled={isPending || isActive}
                  className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 text-xs font-medium transition-all ${
                    isActive
                      ? `${sConf.bg} ${sConf.text} ring-2 ring-offset-1 ring-current`
                      : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-300 dark:hover:border-slate-600'
                  } disabled:opacity-50`}
                >
                  <span className="material-icons text-lg">{sConf.icon}</span>
                  {sConf.label}
                </button>
              );
            })}
          </div>

          {/* Tasks for this unit */}
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
              Today&apos;s Tasks
            </h3>
            {tasks.length === 0 ? (
              <p className="text-sm text-slate-400">No tasks scheduled for today.</p>
            ) : (
              <div className="space-y-2">
                {tasks.map((task) => {
                  const statusConf = getTaskStatusConf(task.status);
                  const priorityConf = getPriorityConf(task.priority);
                  const assignee = task.assignedTo ? staffMap.get(task.assignedTo) : undefined;

                  return (
                    <div
                      key={task.id}
                      className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-900 dark:text-white">
                            {TASK_TYPE_LABEL[task.type] ?? task.type}
                          </span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${statusConf.classes}`}>
                            {statusConf.label}
                          </span>
                          <span className={`text-[10px] font-medium ${priorityConf.classes}`}>
                            {priorityConf.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          {assignee && (
                            <span className="text-xs text-slate-500">{assignee.name}</span>
                          )}
                          {task.notes && (
                            <span className="text-xs text-slate-400 truncate">{task.notes}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {task.status === 'pending' && (
                          <button
                            onClick={() => onTaskStatusChange(task.id, 'in_progress')}
                            disabled={isPending}
                            className="text-xs bg-primary text-white px-2 py-1 rounded hover:bg-primary/90 disabled:opacity-50"
                          >
                            Start
                          </button>
                        )}
                        {task.status === 'in_progress' && (
                          <button
                            onClick={() => onTaskStatusChange(task.id, 'completed')}
                            disabled={isPending}
                            className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700 disabled:opacity-50"
                          >
                            Done
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ──────── New Task Dialog ──────── */
function NewTaskDialog({
  units,
  roomTypeMap,
  defaultPropertyId,
  currentDate,
  staff,
  onClose,
}: {
  units: Unit[];
  roomTypeMap: Map<string, RoomType>;
  defaultPropertyId: string;
  currentDate: string;
  staff: StaffMember[];
  onClose: () => void;
}) {
  const [unitId, setUnitId] = useState('');
  const [type, setType] = useState<string>('deep_clean');
  const [priority, setPriority] = useState<string>('normal');
  const [assignedTo, setAssignedTo] = useState('');
  const [notes, setNotes] = useState('');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!unitId) {
      setError('Please select a room.');
      return;
    }

    startTransition(async () => {
      const result = await createHousekeepingTask({
        propertyId: defaultPropertyId,
        unitId,
        type: type as 'checkout_clean' | 'stay_over' | 'deep_clean' | 'inspection',
        priority: priority as 'low' | 'normal' | 'high' | 'urgent',
        assignedTo: assignedTo || undefined,
        scheduledDate: currentDate,
        notes: notes || undefined,
      });
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
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">New Housekeeping Task</h2>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <span className="material-icons">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Room select */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Room</label>
            <select
              value={unitId}
              onChange={(e) => setUnitId(e.target.value)}
              className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-shadow outline-none"
            >
              <option value="">Select a room...</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  Room {u.name} — {roomTypeMap.get(u.roomTypeId)?.name ?? ''}
                </option>
              ))}
            </select>
          </div>

          {/* Task type */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Task Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-shadow outline-none"
            >
              <option value="checkout_clean">Checkout Clean</option>
              <option value="stay_over">Stay Over</option>
              <option value="deep_clean">Deep Clean</option>
              <option value="inspection">Inspection</option>
            </select>
          </div>

          {/* Priority */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-shadow outline-none"
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>

          {/* Assigned to */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Assign To</label>
            <select
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-shadow outline-none"
            >
              <option value="">Unassigned</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-shadow outline-none resize-none"
              placeholder="Special instructions..."
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors shadow-sm shadow-primary/30 disabled:opacity-50"
            >
              {isPending ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
