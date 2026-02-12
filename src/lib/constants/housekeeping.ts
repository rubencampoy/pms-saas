export enum HousekeepingStatus {
  DIRTY = 'dirty',
  CLEANING = 'cleaning',
  CLEAN = 'clean',
  INSPECTED = 'inspected',
}

export enum HousekeepingTaskType {
  CHECKOUT_CLEAN = 'checkout_clean',
  STAY_OVER = 'stay_over',
  DEEP_CLEAN = 'deep_clean',
  INSPECTION = 'inspection',
}

export enum HousekeepingTaskStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  SKIPPED = 'skipped',
}

export enum TaskPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
}
