import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { ResearchResponse } from '../../src/models/ResearchResponse';
import { clearDb, startTestDb, stopTestDb } from '../helpers/db';
import { loginAgent } from '../helpers/fixtures';

type Seed = Record<string, unknown>;
const base = {
  role: 'frontend',
  experience: '1_2y',
  apiProblem: 'no',
  tools: ['manual_testing'],
  biggestDifficulty: 'finding_changes',
  followUpConsent: 'no',
};
const day = (d: string) => new Date(`${d}T12:00:00.000Z`);

async function seed(rows: Seed[]) {
  // timestamps:false so the explicit createdAt values below are kept.
  await ResearchResponse.insertMany(rows.map((r) => ({ ...base, ...r })), { timestamps: false });
}

const SEED: Seed[] = [
  { role: 'frontend', experience: 'lt_1y', apiProblem: 'yes', fixTime: 'lt_30m', recentProblem: 'Renamed field broke the table', tools: ['manual_testing', 'compiler_errors'], biggestDifficulty: 'finding_changes', followUpConsent: 'yes', contactEmail: 'a@example.com', createdAt: day('2026-01-01'), updatedAt: day('2026-01-01') },
  { role: 'backend', experience: '6plus_y', apiProblem: 'no', tools: ['none'], biggestDifficulty: 'coordination', createdAt: day('2026-01-02'), updatedAt: day('2026-01-02') },
  { role: 'fullstack', experience: '3_5y', apiProblem: 'yes', fixTime: '2_8h', desiredImprovement: 'Better CHANGELOG notices', tools: ['manual_testing', 'automated_tests_ci'], biggestDifficulty: 'finding_changes', followUpConsent: 'yes', createdAt: day('2026-01-03'), updatedAt: day('2026-01-03') },
  { role: 'frontend', experience: '3_5y', apiProblem: 'not_sure', tools: ['logs_monitoring'], biggestDifficulty: 'is_breaking', createdAt: day('2026-01-04'), updatedAt: day('2026-01-04') },
];

describe('admin API with data', () => {
  const app = createApp();
  beforeAll(startTestDb);
  afterAll(stopTestDb);
  beforeEach(clearDb);

  describe('empty database', () => {
    it('stats are all zero (no divide-by-zero)', async () => {
      const agent = await loginAgent(app);
      const res = await agent.get('/api/research/admin/stats');
      expect(res.status).toBe(200);
      const d = res.body.data;
      expect(d).toMatchObject({ totalSubmissions: 0, problemYes: 0, problemYesPercent: 0, followUpYes: 0 });
      expect(d.byRole.every((b: { count: number }) => b.count === 0)).toBe(true);
      expect(d.tools.every((b: { count: number }) => b.count === 0)).toBe(true);
    });

    it('list is empty with totalPages 1', async () => {
      const agent = await loginAgent(app);
      const res = await agent.get('/api/research/admin/responses');
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ items: [], total: 0, page: 1, totalPages: 1 });
    });

    it('export contains only the header row', async () => {
      const agent = await loginAgent(app);
      const res = await agent.get('/api/research/admin/export');
      expect(res.status).toBe(200);
      const lines = res.text.replace('﻿', '').trim().split(/\r?\n/);
      expect(lines).toHaveLength(1);
      expect(lines[0]).toMatch(/^id,submitted_at_utc,role/);
    });
  });

  describe('stats', () => {
    it('are calculated from the stored data', async () => {
      await seed(SEED);
      const agent = await loginAgent(app);
      const d = (await agent.get('/api/research/admin/stats')).body.data;
      expect(d.totalSubmissions).toBe(4);
      expect(d.problemYes).toBe(2);
      expect(d.problemYesPercent).toBe(50);
      expect(d.followUpYes).toBe(2);
      const count = (arr: { key: string; count: number }[], key: string) => arr.find((b) => b.key === key)?.count;
      expect(count(d.byRole, 'frontend')).toBe(2);
      expect(count(d.byRole, 'backend')).toBe(1);
      expect(count(d.byRole, 'mobile')).toBe(0); // buckets with zero are still present
      expect(count(d.byExperience, '3_5y')).toBe(2);
      expect(count(d.byApiProblem, 'not_sure')).toBe(1);
      expect(count(d.tools, 'manual_testing')).toBe(2);
      expect(count(d.tools, 'none')).toBe(1);
      expect(d.tools[0].key).toBe('manual_testing'); // sorted by count, descending
      expect(count(d.difficulties, 'finding_changes')).toBe(2);
      expect(d.note).toMatch(/submissions/i);
    });
  });

  describe('list, pagination and filters', () => {
    it('sorts newest first and returns only the safe list fields', async () => {
      await seed(SEED);
      const agent = await loginAgent(app);
      const res = await agent.get('/api/research/admin/responses');
      const items = res.body.data.items;
      expect(items.map((i: { createdAt: string }) => i.createdAt.slice(0, 10))).toEqual(['2026-01-04', '2026-01-03', '2026-01-02', '2026-01-01']);
      expect(Object.keys(items[0]).sort()).toEqual(['apiProblem', 'createdAt', 'experience', 'followUpConsent', 'id', 'role']);
      expect(JSON.stringify(res.body)).not.toMatch(/a@example\.com/); // contact never in the list
    });

    it('paginates', async () => {
      await seed(SEED);
      const agent = await loginAgent(app);
      const p1 = (await agent.get('/api/research/admin/responses?limit=3&page=1')).body.data;
      const p2 = (await agent.get('/api/research/admin/responses?limit=3&page=2')).body.data;
      expect(p1.items).toHaveLength(3);
      expect(p2.items).toHaveLength(1);
      expect(p1).toMatchObject({ total: 4, totalPages: 2, page: 1, limit: 3 });
      const ids = [...p1.items, ...p2.items].map((i: { id: string }) => i.id);
      expect(new Set(ids).size).toBe(4);
    });

    it('filters by role, experience, API problem and consent', async () => {
      await seed(SEED);
      const agent = await loginAgent(app);
      const total = async (qs: string) => (await agent.get(`/api/research/admin/responses?${qs}`)).body.data.total;
      expect(await total('role=frontend')).toBe(2);
      expect(await total('experience=3_5y')).toBe(2);
      expect(await total('apiProblem=yes')).toBe(2);
      expect(await total('followUpConsent=yes')).toBe(2);
      expect(await total('role=frontend&apiProblem=yes')).toBe(1);
    });

    it('filters by date range (inclusive of the whole "to" day)', async () => {
      await seed(SEED);
      const agent = await loginAgent(app);
      const total = async (qs: string) => (await agent.get(`/api/research/admin/responses?${qs}`)).body.data.total;
      expect(await total('from=2026-01-02&to=2026-01-03')).toBe(2);
      expect(await total('from=2026-01-04')).toBe(1);
      expect(await total('to=2026-01-01')).toBe(1);
      expect(await total('from=2027-01-01')).toBe(0);
    });

    it('searches free text case-insensitively and treats the query literally (no regex injection)', async () => {
      await seed(SEED);
      const agent = await loginAgent(app);
      const total = async (q: string) => (await agent.get('/api/research/admin/responses').query({ q })).body.data.total;
      expect(await total('renamed field')).toBe(1);
      expect(await total('changelog')).toBe(1);
      expect(await total('.*')).toBe(0);
    });

    it('rejects invalid query parameters with 400', async () => {
      const agent = await loginAgent(app);
      expect((await agent.get('/api/research/admin/responses?role=wizard')).status).toBe(400);
      expect((await agent.get('/api/research/admin/responses?page=0')).status).toBe(400);
      expect((await agent.get('/api/research/admin/responses?limit=1000')).status).toBe(400);
      expect((await agent.get('/api/research/admin/responses?from=yesterday')).status).toBe(400);
    });
  });

  describe('single response', () => {
    it('returns every answer, including the contact email, to an admin', async () => {
      await seed(SEED);
      const agent = await loginAgent(app);
      const id = String((await ResearchResponse.findOne({ role: 'frontend', apiProblem: 'yes' }).lean())!._id);
      const res = await agent.get(`/api/research/admin/responses/${id}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({
        id,
        role: 'frontend',
        experience: 'lt_1y',
        apiProblem: 'yes',
        recentProblem: 'Renamed field broke the table',
        fixTime: 'lt_30m',
        tools: ['manual_testing', 'compiler_errors'],
        biggestDifficulty: 'finding_changes',
        desiredImprovement: null,
        followUpConsent: 'yes',
        contactEmail: 'a@example.com',
      });
    });

    it('returns 404 for an unknown id and 400 for a malformed id', async () => {
      const agent = await loginAgent(app);
      expect((await agent.get('/api/research/admin/responses/507f1f77bcf86cd799439011')).status).toBe(404);
      expect((await agent.get('/api/research/admin/responses/not-an-id')).status).toBe(400);
    });

    it('returns 401 without a session even when the id exists', async () => {
      await seed(SEED);
      const id = String((await ResearchResponse.findOne().lean())!._id);
      expect((await request(app).get(`/api/research/admin/responses/${id}`)).status).toBe(401);
    });
  });

  describe('CSV export', () => {
    it('is blocked for anonymous users', async () => {
      await seed(SEED);
      expect((await request(app).get('/api/research/admin/export')).status).toBe(401);
    });

    it('returns a CSV download with readable labels and without contact emails by default', async () => {
      await seed(SEED);
      const agent = await loginAgent(app);
      const res = await agent.get('/api/research/admin/export');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/csv/);
      expect(res.headers['content-disposition']).toMatch(/attachment; filename="survey-responses-\d{4}-\d{2}-\d{2}\.csv"/);
      const text = res.text.replace('﻿', '');
      expect(text.trim().split(/\r?\n/)).toHaveLength(5); // header + 4 rows
      expect(text).toContain('Frontend Developer');
      expect(text).toContain('Manual testing; TypeScript/compiler errors');
      expect(text).not.toContain('contact_email');
      expect(text).not.toContain('a@example.com');
    });

    it('includes contact emails only when explicitly requested', async () => {
      await seed(SEED);
      const agent = await loginAgent(app);
      const text = (await agent.get('/api/research/admin/export?includeContact=true')).text;
      expect(text).toContain('contact_email');
      expect(text).toContain('a@example.com');
    });

    it('applies the same filters as the list', async () => {
      await seed(SEED);
      const agent = await loginAgent(app);
      const text = (await agent.get('/api/research/admin/export?role=backend')).text.replace('﻿', '');
      expect(text.trim().split(/\r?\n/)).toHaveLength(2);
    });

    it('escapes commas, quotes, newlines and neutralizes formulas', async () => {
      await seed([{ apiProblem: 'yes', fixTime: 'lt_30m', recentProblem: '=HYPERLINK("http://evil")\nsecond, line "quoted"', createdAt: day('2026-02-01'), updatedAt: day('2026-02-01') }]);
      const agent = await loginAgent(app);
      const text = (await agent.get('/api/research/admin/export')).text;
      expect(text).toContain(`"'=HYPERLINK(""http://evil"")\nsecond, line ""quoted"""`);
    });
  });
});
