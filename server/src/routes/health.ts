import type { RequestHandler } from 'express';
import mongoose from 'mongoose';
import { fail, ok } from '../lib/response';
import type { HealthStatus } from '../shared/api';

// The host spins the server down after inactivity. The client polls this
// until it answers (and Mongo is connected) before letting players in, and
// keeps pinging it every few minutes so the instance stays warm.
export const health: RequestHandler = (_req, res) => {
  res.set('Cache-Control', 'no-store');
  if (mongoose.connection.readyState !== 1) {
    return fail(res, 503, 'DB_NOT_READY', 'Database is still connecting');
  }
  return ok<HealthStatus>(res, { ok: true, uptime: Math.round(process.uptime()), db: 'connected' });
};
