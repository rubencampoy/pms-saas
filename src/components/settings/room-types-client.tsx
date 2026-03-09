'use client';

import { useState, useTransition } from 'react';
import { RoomTypeFormDialog } from '@/components/settings/room-type-form-dialog';
import { UnitFormDialog } from '@/components/settings/unit-form-dialog';
import { deleteRoomType } from '@/server/actions/room-types';
import { deleteUnit } from '@/server/actions/units';

interface Property {
  id: string;
  name: string;
  code: string;
}

interface RoomType {
  id: string;
  propertyId: string;
  name: string;
  code: string;
  description: string | null;
  baseOccupancy: number;
  maxOccupancy: number;
  amenities: string[] | null;
  sortOrder: number;
  isActive: boolean;
}

interface Unit {
  id: string;
  propertyId: string;
  roomTypeId: string;
  name: string;
  floor: string | null;
  status: string;
  housekeepingStatus: string;
  isActive: boolean;
  sortOrder: number;
  notes: string | null;
}

interface RoomTypesClientProps {
  properties: Property[];
  roomTypes: RoomType[];
  units: Unit[];
}

const HOUSEKEEPING_BADGE: Record<string, string> = {
  clean: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
  dirty: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  cleaning: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  inspected: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
};

const STATUS_BADGE: Record<string, string> = {
  available: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
  maintenance: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  out_of_order: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
};

export function RoomTypesClient({ properties, roomTypes, units }: RoomTypesClientProps) {
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>(
    properties[0]?.id ?? '',
  );
  const [expandedRoomType, setExpandedRoomType] = useState<string | null>(null);
  const [roomTypeDialog, setRoomTypeDialog] = useState<{ open: boolean; editData?: RoomType }>({ open: false });
  const [unitDialog, setUnitDialog] = useState<{ open: boolean; roomTypeId?: string; editData?: Unit }>({ open: false });
  const [isPending, startTransition] = useTransition();

  const selectedProperty = properties.find((p) => p.id === selectedPropertyId);
  const filteredRoomTypes = roomTypes.filter((rt) => rt.propertyId === selectedPropertyId);

  function getUnitsForRoomType(roomTypeId: string) {
    return units.filter((u) => u.roomTypeId === roomTypeId);
  }

  function handleDeleteRoomType(id: string) {
    if (!confirm('Are you sure you want to delete this room type? All associated units will also be deleted.')) return;
    startTransition(async () => {
      await deleteRoomType(id);
    });
  }

  function handleDeleteUnit(id: string) {
    if (!confirm('Are you sure you want to delete this unit?')) return;
    startTransition(async () => {
      await deleteUnit(id);
    });
  }

  return (
    <div>
      {/* Property selector + Add button toolbar */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          {/* Property selector */}
          <div className="relative">
            <span className="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
              apartment
            </span>
            <select
              value={selectedPropertyId}
              onChange={(e) => {
                setSelectedPropertyId(e.target.value);
                setExpandedRoomType(null);
              }}
              className="pl-10 pr-8 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 appearance-none cursor-pointer focus:ring-2 focus:ring-primary/20 focus:border-primary transition-shadow outline-none"
            >
              {properties.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.name} ({property.code})
                </option>
              ))}
            </select>
            <span className="material-icons absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 text-lg pointer-events-none">
              expand_more
            </span>
          </div>
        </div>

        <button
          onClick={() => setRoomTypeDialog({ open: true })}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors shadow-sm shadow-primary/30"
        >
          <span className="material-icons text-lg">add</span>
          New Room Type
        </button>
      </div>

      {/* Property info card */}
      {selectedProperty && (
        <div className="bg-white dark:bg-[#1a2632] rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-5 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400">
                <span className="material-icons">apartment</span>
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  {selectedProperty.name}
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Code: {selectedProperty.code} &middot; {filteredRoomTypes.length} room type{filteredRoomTypes.length !== 1 ? 's' : ''} &middot;{' '}
                  {units.filter((u) => u.propertyId === selectedPropertyId).length} total units
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Room Types table */}
      <div className="bg-white dark:bg-[#1a2632] rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 dark:bg-white/5">
            <tr>
              <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Room Type
              </th>
              <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Code
              </th>
              <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Occupancy
              </th>
              <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Units
              </th>
              <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Status
              </th>
              <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredRoomTypes.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
                  <span className="material-icons text-4xl text-slate-300 dark:text-slate-600 mb-2 block">
                    bed
                  </span>
                  No room types for this property. Create one to get started.
                </td>
              </tr>
            ) : (
              filteredRoomTypes.map((rt) => {
                const rtUnits = getUnitsForRoomType(rt.id);
                const isExpanded = expandedRoomType === rt.id;
                return (
                  <RoomTypeRow
                    key={rt.id}
                    roomType={rt}
                    units={rtUnits}
                    isExpanded={isExpanded}
                    isPending={isPending}
                    onToggleExpand={() => setExpandedRoomType(isExpanded ? null : rt.id)}
                    onEdit={() => setRoomTypeDialog({ open: true, editData: rt })}
                    onDelete={() => handleDeleteRoomType(rt.id)}
                    onAddUnit={() => setUnitDialog({ open: true, roomTypeId: rt.id })}
                    onEditUnit={(unit) => setUnitDialog({ open: true, roomTypeId: rt.id, editData: unit })}
                    onDeleteUnit={(unitId) => handleDeleteUnit(unitId)}
                  />
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Room Type Form Dialog */}
      {roomTypeDialog.open && (
        <RoomTypeFormDialog
          propertyId={selectedPropertyId}
          editData={roomTypeDialog.editData}
          onClose={() => setRoomTypeDialog({ open: false })}
        />
      )}

      {/* Unit Form Dialog */}
      {unitDialog.open && unitDialog.roomTypeId && (
        <UnitFormDialog
          propertyId={selectedPropertyId}
          roomTypeId={unitDialog.roomTypeId}
          editData={unitDialog.editData}
          onClose={() => setUnitDialog({ open: false })}
        />
      )}
    </div>
  );
}

/* ─── Room Type Row (with expandable units) ─── */

interface RoomTypeRowProps {
  roomType: RoomType;
  units: Unit[];
  isExpanded: boolean;
  isPending: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAddUnit: () => void;
  onEditUnit: (unit: Unit) => void;
  onDeleteUnit: (unitId: string) => void;
}

function RoomTypeRow({
  roomType,
  units: rtUnits,
  isExpanded,
  isPending,
  onToggleExpand,
  onEdit,
  onDelete,
  onAddUnit,
  onEditUnit,
  onDeleteUnit,
}: RoomTypeRowProps) {
  return (
    <>
      <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
        <td className="p-4">
          <button
            onClick={onToggleExpand}
            className="flex items-center gap-3 text-left group"
          >
            <span
              className={`material-icons text-lg text-slate-400 transition-transform ${
                isExpanded ? 'rotate-90' : ''
              }`}
            >
              chevron_right
            </span>
            <div>
              <div className="font-semibold text-slate-900 dark:text-white">
                {roomType.name}
              </div>
              {roomType.description && (
                <div className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-xs">
                  {roomType.description}
                </div>
              )}
            </div>
          </button>
        </td>
        <td className="p-4">
          <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-xs font-mono font-semibold text-slate-600 dark:text-slate-300">
            {roomType.code}
          </span>
        </td>
        <td className="p-4 text-sm text-slate-700 dark:text-slate-300">
          {roomType.baseOccupancy}–{roomType.maxOccupancy} guests
        </td>
        <td className="p-4">
          <span className="inline-flex items-center gap-1 text-sm font-medium text-slate-700 dark:text-slate-300">
            <span className="material-icons text-lg text-slate-400">bedroom_parent</span>
            {rtUnits.length}
          </span>
        </td>
        <td className="p-4">
          {roomType.isActive ? (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border border-green-200 dark:border-green-800">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5"></span>
              Active
            </span>
          ) : (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-500 mr-1.5"></span>
              Inactive
            </span>
          )}
        </td>
        <td className="p-4 text-right">
          <div className="flex items-center justify-end gap-1">
            <button
              onClick={onAddUnit}
              title="Add unit"
              className="p-1.5 rounded-lg text-slate-400 hover:text-primary hover:bg-primary/5 transition-colors"
            >
              <span className="material-icons text-lg">add_circle_outline</span>
            </button>
            <button
              onClick={onEdit}
              title="Edit room type"
              className="p-1.5 rounded-lg text-slate-400 hover:text-primary hover:bg-primary/5 transition-colors"
            >
              <span className="material-icons text-lg">edit</span>
            </button>
            <button
              onClick={onDelete}
              disabled={isPending}
              title="Delete room type"
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
            >
              <span className="material-icons text-lg">delete_outline</span>
            </button>
          </div>
        </td>
      </tr>

      {/* Expanded units */}
      {isExpanded && (
        <tr>
          <td colSpan={6} className="p-0">
            <div className="bg-slate-50/50 dark:bg-white/5 border-t border-slate-100 dark:border-slate-800">
              <div className="px-6 py-3">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Units ({rtUnits.length})
                  </h4>
                  <button
                    onClick={onAddUnit}
                    className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                  >
                    <span className="material-icons text-sm">add</span>
                    Add Unit
                  </button>
                </div>

                {rtUnits.length === 0 ? (
                  <p className="text-sm text-slate-400 py-2">
                    No units yet. Add one to start managing rooms.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                    {rtUnits.map((unit) => (
                      <div
                        key={unit.id}
                        className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700 shadow-sm"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                            <span className="text-sm font-bold">{unit.name}</span>
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-slate-900 dark:text-white">
                                Room {unit.name}
                              </span>
                              {unit.floor && (
                                <span className="text-[10px] text-slate-400">
                                  F{unit.floor}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded ${
                                  HOUSEKEEPING_BADGE[unit.housekeepingStatus] ?? ''
                                }`}
                              >
                                {unit.housekeepingStatus.charAt(0).toUpperCase() +
                                  unit.housekeepingStatus.slice(1)}
                              </span>
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded ${
                                  STATUS_BADGE[unit.status] ?? ''
                                }`}
                              >
                                {unit.status.replace('_', ' ').charAt(0).toUpperCase() +
                                  unit.status.replace('_', ' ').slice(1)}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-0.5 ml-2">
                          <button
                            onClick={() => onEditUnit(unit)}
                            title="Edit unit"
                            className="p-1 rounded text-slate-400 hover:text-primary hover:bg-primary/5 transition-colors"
                          >
                            <span className="material-icons text-base">edit</span>
                          </button>
                          <button
                            onClick={() => onDeleteUnit(unit.id)}
                            disabled={isPending}
                            title="Delete unit"
                            className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                          >
                            <span className="material-icons text-base">close</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
