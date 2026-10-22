
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { validNoProblem, validSubmission } from '../helpers/fixtures';

// These tests reject bad input BEFORE the database is touched,
// so no MongoDB is needed.
describe('POST /api/research/responses validation (HTTP level)', () => {
  const app = createApp();

  const post = (body: unknown) =>
    request(app).post('/api/research/responses').send(body as object);

  it('returns 400 with field errors for an empty body', async () => {
    const res = await post({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);

    const fields = res.body.errors.map(
      (e: { field: string }) => e.field
    );

    expect(fields).toEqual(
      expect.arrayContaining([
          'role',
  'experience',
  'apiSource',
  'changeFrequency',
  'apiProblem',
  'breakFrequency',
  'tools',
  'biggestDifficulty',
  'toolUsefulness',
      ])
    );
  });

  it('returns 400 for an invalid enum value', async () => {
    const res = await post(validSubmission({ role: 'wizard' }));

    expect(res.status).toBe(400);
    expect(res.body.errors[0].field).toBe('role');
  });

  it('returns 400 for an invalid conditional answer', async () => {
    const res = await post(validNoProblem({ fixTime: '2_8h' }));

    expect(res.status).toBe(400);
    expect(
      res.body.errors.some(
        (e: { field: string }) => e.field === 'fixTime'
      )
    ).toBe(true);
  });

  it('returns 400 for over-long text', async () => {
    const res = await post(
      validSubmission({ recentProblem: 'a'.repeat(2001) })
    );

    expect(res.status).toBe(400);
  });

  it('returns 400 for malformed JSON without leaking details', async () => {
    const res = await request(app)
      .post('/api/research/responses')
      .set('Content-Type', 'application/json')
      .send('{bad json');

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Invalid JSON body');
  });

  it('returns 413 for a body over the size limit', async () => {
    const res = await post(
      validSubmission({ recentProblem: 'a'.repeat(30000) })
    );

    expect(res.status).toBe(413);
  });

  it('returns 404 JSON for unknown routes', async () => {
    const res = await request(app).get('/api/nope');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('answers the health check', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
  });
});
