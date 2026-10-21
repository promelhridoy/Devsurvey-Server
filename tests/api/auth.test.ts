import { afterEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../../src/app';
import { ADMIN_USER, ADMIN_PASS, loginAgent } from '../helpers/fixtures';

const ADMIN_ROUTES = [
  '/api/research/admin/me',
  '/api/research/admin/stats',
  '/api/research/admin/responses',
  '/api/research/admin/responses/507f1f77bcf86cd799439011',
  '/api/research/admin/export',
];

describe('admin authentication', () => {
  const app = createApp();

  describe('unauthorized access', () => {
    it.each(ADMIN_ROUTES)('GET %s returns 401 without a session', async (path) => {
      const res = await request(app).get(path);
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ success: false, message: 'Authentication required' });
      expect(res.headers['cache-control']).toBe('no-store');
    });

    it('rejects a garbage cookie', async () => {
      const res = await request(app).get('/api/research/admin/stats').set('Cookie', 'ds_admin=not-a-jwt');
      expect(res.status).toBe(401);
    });

    it('rejects a token signed with the wrong secret', async () => {
      const forged = jwt.sign({ sub: 'x', role: 'admin' }, 'another-secret-that-is-long-enough-1234567890');
      const res = await request(app).get('/api/research/admin/stats').set('Cookie', `ds_admin=${forged}`);
      expect(res.status).toBe(401);
    });

    it('rejects an expired token', async () => {
      const expired = jwt.sign({ sub: ADMIN_USER, role: 'admin' }, process.env.JWT_SECRET!, { expiresIn: -10 });
      const res = await request(app).get('/api/research/admin/me').set('Cookie', `ds_admin=${expired}`);
      expect(res.status).toBe(401);
    });

    it('rejects an unsigned ("alg: none") token', async () => {
      const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
      const none = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: 'x', role: 'admin' })}.`;
      const res = await request(app).get('/api/research/admin/me').set('Cookie', `ds_admin=${none}`);
      expect(res.status).toBe(401);
    });

    it('rejects a validly signed token without the admin role', async () => {
      const t = jwt.sign({ sub: 'x', role: 'user' }, process.env.JWT_SECRET!);
      const res = await request(app).get('/api/research/admin/me').set('Cookie', `ds_admin=${t}`);
      expect(res.status).toBe(401);
    });

    it('does not accept the token from an Authorization header (cookie only)', async () => {
      const t = jwt.sign({ sub: ADMIN_USER, role: 'admin' }, process.env.JWT_SECRET!);
      const res = await request(app).get('/api/research/admin/me').set('Authorization', `Bearer ${t}`);
      expect(res.status).toBe(401);
    });
  });

  describe('login', () => {
    it('logs in with the right credentials and sets a secure session cookie', async () => {
      const res = await request(app).post('/api/research/admin/login').send({ username: ADMIN_USER, password: ADMIN_PASS });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true, message: 'Logged in' }); // no token in the body
      const cookie = (res.headers['set-cookie'] as unknown as string[])[0];
      expect(cookie).toMatch(/^ds_admin=/);
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/SameSite=Lax/i);
      expect(cookie).toMatch(/Path=\//);
    });

    it('lets a logged-in admin reach /admin/me', async () => {
      const agent = await loginAgent(app);
      const res = await agent.get('/api/research/admin/me');
      expect(res.status).toBe(200);
      expect(res.body.data.username).toBe(ADMIN_USER);
    });

    it('gives the same 401 message for a wrong password and a wrong username', async () => {
      const badPass = await request(app).post('/api/research/admin/login').send({ username: ADMIN_USER, password: 'wrong-password' });
      const badUser = await request(app).post('/api/research/admin/login').send({ username: 'nobody', password: ADMIN_PASS });
      expect(badPass.status).toBe(401);
      expect(badUser.status).toBe(401);
      expect(badPass.body).toEqual(badUser.body);
      expect(badPass.headers['set-cookie']).toBeUndefined();
    });

    it('returns 400 for a malformed login body', async () => {
      expect((await request(app).post('/api/research/admin/login').send({})).status).toBe(400);
      expect((await request(app).post('/api/research/admin/login').send({ username: 1, password: 2 })).status).toBe(400);
    });

    it('logout clears the cookie and the session stops working', async () => {
      const agent = await loginAgent(app);
      const out = await agent.post('/api/research/admin/logout');
      expect(out.status).toBe(200);
      expect((out.headers['set-cookie'] as unknown as string[])[0]).toMatch(/ds_admin=;/);
      expect((await agent.get('/api/research/admin/me')).status).toBe(401);
    });
  });

  describe('rate limiting', () => {
    afterEach(() => {
      process.env.LOGIN_RATE_LIMIT_MAX = '1000';
      process.env.SUBMIT_RATE_LIMIT_MAX = '1000';
    });

    it('limits repeated login attempts with 429', async () => {
      process.env.LOGIN_RATE_LIMIT_MAX = '3';
      const limited = createApp();
      const attempt = () => request(limited).post('/api/research/admin/login').send({ username: ADMIN_USER, password: 'wrong-password' });
      expect((await attempt()).status).toBe(401);
      expect((await attempt()).status).toBe(401);
      expect((await attempt()).status).toBe(401);
      const blocked = await attempt();
      expect(blocked.status).toBe(429);
      expect(blocked.body.success).toBe(false);
    });

    it('limits repeated public submissions with 429', async () => {
      process.env.SUBMIT_RATE_LIMIT_MAX = '2';
      const limited = createApp();
      const attempt = () => request(limited).post('/api/research/responses').send({});
      expect((await attempt()).status).toBe(400);
      expect((await attempt()).status).toBe(400);
      expect((await attempt()).status).toBe(429);
    });
  });

  describe('CORS', () => {
    it('allows a configured origin with credentials', async () => {
      const res = await request(app).get('/api/health').set('Origin', 'http://localhost:3000');
      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
      expect(res.headers['access-control-allow-credentials']).toBe('true');
    });

    it('does not send CORS headers to an unknown origin', async () => {
      const res = await request(app).get('/api/health').set('Origin', 'https://evil.example');
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });
  });
});
