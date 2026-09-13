import type { Response } from 'express';
import type { ApiErrorBody, ApiResponse } from '../shared/api';

export function ok<T>(res: Response, data: T, status = 200) {
  const body: ApiResponse<T> = { status: 'success', data, errors: null, meta: { timestamp: new Date().toISOString() } };
  return res.status(status).json(body);
}

export function fail(res: Response, status: number, code: string, message: string, details?: Record<string, unknown>) {
  const error: ApiErrorBody = { code, message, ...(details ? { details } : {}) };
  const body: ApiResponse<never> = { status: 'error', data: null, errors: [error], meta: { timestamp: new Date().toISOString() } };
  return res.status(status).json(body);
}
