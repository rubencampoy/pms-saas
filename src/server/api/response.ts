import { NextResponse } from 'next/server';
import { ApiErrorCode, type ApiErrorCodeValue } from '@/lib/constants/api';

export interface ApiMeta {
  nextCursor: string | null;
  hasMore: boolean;
}

/** Every successful `/api/v1` response has this shape. */
export function apiSuccess<T>(data: T, meta?: ApiMeta, init?: ResponseInit) {
  return NextResponse.json(meta ? { data, meta } : { data }, init);
}

/** Every failed `/api/v1` response has this shape. */
export function apiError(
  code: ApiErrorCodeValue,
  message: string,
  status: number,
  details?: Record<string, string[]>,
) {
  return NextResponse.json(
    { error: details ? { code, message, details } : { code, message } },
    { status },
  );
}

export function apiInvalidRequest(
  message: string,
  details?: Record<string, string[]>,
) {
  return apiError(ApiErrorCode.INVALID_REQUEST, message, 400, details);
}

export function apiNotFound(message = 'Resource not found') {
  return apiError(ApiErrorCode.NOT_FOUND, message, 404);
}

export function apiInternalError() {
  return apiError(
    ApiErrorCode.INTERNAL_ERROR,
    'An unexpected error occurred',
    500,
  );
}
