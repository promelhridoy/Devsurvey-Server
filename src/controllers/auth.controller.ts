import crypto from 'crypto';
import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { getEnv } from '../config/env';
import { ADMIN_COOKIE, cookieOptions, signAdminToken } from '../middleware/adminAuth';
import { loginSchema } from '../validators/research.validator';
import { parseOrThrow } from './research.controller';

const safeEqual = (a: string, b: string): boolean => {
  const ha = crypto.createHash('sha256').update(a).digest();
  const hb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
};

// A valid bcrypt hash used to keep timing similar when the username is wrong.
const DUMMY_HASH = bcrypt.hashSync('not-the-password', 10);

export async function login(req: Request, res: Response): Promise<void> {
  const { username, password } = parseOrThrow(loginSchema, req.body);
  const env = getEnv();

  const userOk = safeEqual(username, env.adminUsername);
  const passOk = await bcrypt.compare(password, env.adminPasswordHash || DUMMY_HASH);

  if (!userOk || !passOk) {
    // Same message for both cases so attackers cannot learn which one was wrong.
    res.status(401).json({ success: false, message: 'Invalid username or password' });
    return;
  }

  res.cookie(ADMIN_COOKIE, signAdminToken(env.adminUsername), {
    ...cookieOptions(),
    maxAge: 8 * 60 * 60 * 1000,
  });
  res.json({ success: true, message: 'Logged in' });
}

export function logout(_req: Request, res: Response): void {
  res.clearCookie(ADMIN_COOKIE, cookieOptions());
  res.json({ success: true, message: 'Logged out' });
}

/** Lets the frontend ask "am I logged in?" (the real check is still done by requireAdmin). */
export function me(req: Request, res: Response): void {
  res.json({ success: true, data: { username: (req as Request & { admin?: string }).admin } });
}
