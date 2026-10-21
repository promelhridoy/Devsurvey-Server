import rateLimit from 'express-rate-limit';
import { getEnv } from '../config/env';

const handler = (message: string) => ({ success: false, message });

/** Build fresh limiter instances (each owns its own in-memory counter). */
export function createLimiters() {
  const env = getEnv();
  return {
    submitLimiter: rateLimit({
      windowMs: env.submitLimitWindowMin * 60 * 1000,
      limit: env.submitLimitMax,
      standardHeaders: true,
      legacyHeaders: false,
      message: handler('Too many submissions from this network. Please try again later.'),
    }),
    loginLimiter: rateLimit({
      windowMs: env.loginLimitWindowMin * 60 * 1000,
      limit: env.loginLimitMax,
      standardHeaders: true,
      legacyHeaders: false,
      message: handler('Too many login attempts. Please try again later.'),
    }),
  };
}
