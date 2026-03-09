export type SubRowType = 'price' | 'minStay' | 'maxStay' | 'cta' | 'ctd';

/** Unique key for each cell: "roomTypeId:yyyy-MM-dd:field" */
export type CellKey = `${string}:${string}:${SubRowType}`;

export interface PendingChange {
  ratePlanId: string;
  roomTypeId: string;
  date: string;
  field: SubRowType;
  value: string | number | boolean;
  originalValue: string | number | boolean | undefined;
}

export interface DisplayOptions {
  price: boolean;
  minStay: boolean;
  maxStay: boolean;
  cta: boolean;
  ctd: boolean;
}

export interface CellSelection {
  anchorKey: CellKey;
  currentKey: CellKey;
  selectedKeys: Set<CellKey>;
}

export const SUB_ROW_LABELS: Record<SubRowType, string> = {
  price: 'Price',
  minStay: 'Min Stay',
  maxStay: 'Max Stay',
  cta: 'CTA',
  ctd: 'CTD',
};

export const SUB_ROW_ICONS: Record<SubRowType, string> = {
  price: 'payments',
  minStay: 'hotel',
  maxStay: 'date_range',
  cta: 'block',
  ctd: 'logout',
};

export const ALL_SUB_ROWS: SubRowType[] = ['price', 'minStay', 'maxStay', 'cta', 'ctd'];

export function makeCellKey(roomTypeId: string, date: string, field: SubRowType): CellKey {
  return `${roomTypeId}:${date}:${field}`;
}

export function parseCellKey(key: CellKey): { roomTypeId: string; date: string; field: SubRowType } {
  const parts = key.split(':');
  return {
    roomTypeId: parts[0]!,
    date: parts[1]!,
    field: parts[2]! as SubRowType,
  };
}

export const DEFAULT_DISPLAY_OPTIONS: DisplayOptions = {
  price: true,
  minStay: true,
  maxStay: false,
  cta: true,
  ctd: true,
};
