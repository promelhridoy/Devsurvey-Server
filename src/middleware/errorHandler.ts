import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ApiError } from '../utils/errors';

export const notFound: RequestHandler = (_req, res) => {
  res.status(404).json({ success: false, message: 'Not found' });
};

/**
 * Central error handler. Public responses never contain stack traces,
 * database messages or internal details; those are logged server-side only.
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({ success: false, message: err.message, ...(err.errors ? { errors: err.errors } : {}) });
    return;
  }
  const e = err as { type?: string; status?: number };
  if (e.type === 'entity.parse.failed') {
    res.status(400).json({ success: false, message: 'Invalid JSON body' });
    return;
  }
  if (e.type === 'entity.too.large') {
    res.status(413).json({ success: false, message: 'Request body too large' });
    return;
  }
  // Log only the error name/message, never request bodies (they may contain contact emails).
  console.error('[error]', (err as Error)?.name, (err as Error)?.message);
  res.status(500).json({ success: false, message: 'Something went wrong. Please try again later.' });
};
