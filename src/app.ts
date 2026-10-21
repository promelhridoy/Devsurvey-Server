import express, { Router } from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import { getEnv } from './config/env';
import { asyncHandler } from './utils/asyncHandler';
import { createLimiters } from './middleware/rateLimit';
import { requireAdmin } from './middleware/adminAuth';
import { errorHandler, notFound } from './middleware/errorHandler';
import * as research from './controllers/research.controller';
import * as auth from './controllers/auth.controller';

/** Build the Express app. Kept separate from server.ts so tests can import it without opening a port. */
export function createApp() {
  const env = getEnv();
  const app = express();

  app.disable('x-powered-by');
  if (env.trustProxy > 0) app.set('trust proxy', env.trustProxy);

  app.use(helmet());
  app.use(
    cors({
      // Requests without an Origin header (same-origin proxy, Postman, curl) are allowed;
      // browsers from other origins must be on the allow-list.
      origin: (origin, cb) => cb(null, !origin || getEnv().corsOrigins.includes(origin)),
      credentials: true,
      methods: ['GET', 'POST', 'OPTIONS'],
    }),
  );
  app.use(express.json({ limit: '20kb' }));
  app.use(cookieParser());

  const { submitLimiter, loginLimiter } = createLimiters();

  app.get('/api/health', (_req, res) => {
    res.json({ success: true, message: 'ok' });
  });

  const router = Router();

  // ---- Public ----
  router.post('/responses', submitLimiter, asyncHandler(research.submitResponse));

  // ---- Admin auth (login is public but rate limited) ----
  router.post('/admin/login', loginLimiter, asyncHandler(auth.login));
  router.post('/admin/logout', auth.logout);

  // ---- Admin (every route below requires a valid session cookie) ----
  router.use('/admin', requireAdmin);
  router.get('/admin/me', auth.me);
  router.get('/admin/stats', asyncHandler(research.getStats));
  router.get('/admin/responses', asyncHandler(research.listResponses));
  router.get('/admin/responses/:id', asyncHandler(research.getResponse));
  router.get('/admin/export', asyncHandler(research.exportResponses));

  app.use('/api/research', router);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
