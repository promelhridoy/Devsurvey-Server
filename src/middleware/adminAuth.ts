import type { CookieOptions, NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { getEnv } from '../config/env';

export const ADMIN_COOKIE = 'ds_admin';

export function cookieOptions(): CookieOptions {
  const env = getEnv();
  return {
    httpOnly: true,
    secure: env.isProd || env.cookieSameSite === 'none',
    sameSite: env.cookieSameSite,
    path: '/',
  };
}

export function signAdminToken(username: string): string {
  const env = getEnv();
  return jwt.sign({ sub: username, role: 'admin' }, env.jwtSecret, {
    algorithm: 'HS256',
    expiresIn: env.jwtExpiresIn as jwt.SignOptions['expiresIn'],
  });
}

/** Backend authorization for every admin route. React-side checks are only UX. */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  res.setHeader('Cache-Control', 'no-store');
  const token = req.cookies?.[ADMIN_COOKIE];
  if (!token || typeof token !== 'string') {
    res.status(401).json({ success: false, message: 'Authentication required' });
    return;
  }
  try {
    const payload = jwt.verify(token, getEnv().jwtSecret, { algorithms: ['HS256'] }) as jwt.JwtPayload;
    if (payload.role !== 'admin') throw new Error('bad role');
    (req as Request & { admin?: string }).admin = String(payload.sub);
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Authentication required' });
  }
}
