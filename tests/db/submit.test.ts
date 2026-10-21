import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { ResearchResponse } from '../../src/models/ResearchResponse';
import { clearDb, startTestDb, stopTestDb } from '../helpers/db';
import { validNoProblem, validSubmission } from '../helpers/fixtures';

describe('POST /api/research/responses (with database)', () => {
  const app = createApp();
  beforeAll(startTestDb);
  afterAll(stopTestDb);
  beforeEach(clearDb);

  it('stores a valid submission and returns 201 with a minimal message', async () => {
    const res = await request(app).post('/api/research/responses').send(validSubmission());
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    // Must not echo the stored document or any private data.
    const text = JSON.stringify(res.body);
    expect(text).not.toMatch(/dev@example\.com|_id|role|createdAt/);

    const docs = await ResearchResponse.find().lean();
    expect(docs).toHaveLength(1);
    expect(docs[0]).toMatchObject({
      role: 'fullstack',
      experience: '3_5y',
      apiProblem: 'yes',
      fixTime: '2_8h',
      tools: ['manual_testing', 'automated_tests_ci'],
      biggestDifficulty: 'finding_changes',
      followUpConsent: 'yes',
      contactEmail: 'dev@example.com',
    });
    expect(docs[0].createdAt).toBeInstanceOf(Date);
    expect(docs[0].updatedAt).toBeInstanceOf(Date);
  });

  it('stores each submission as a separate document', async () => {
    await request(app).post('/api/research/responses').send(validSubmission());
    await request(app).post('/api/research/responses').send(validNoProblem());
    expect(await ResearchResponse.countDocuments()).toBe(2);
  });

  it('does not store anything for an invalid submission', async () => {
    const res = await request(app).post('/api/research/responses').send(validSubmission({ role: 'wizard' }));
    expect(res.status).toBe(400);
    expect(await ResearchResponse.countDocuments()).toBe(0);
  });

  it('ignores a repeated submissionId (retry or double click) and stores only one document', async () => {
    const body = validSubmission({ submissionId: '3f2504e0-4f89-41d3-9a0c-0305e82c3301' });
    const first = await request(app).post('/api/research/responses').send(body);
    const second = await request(app).post('/api/research/responses').send(body);
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(await ResearchResponse.countDocuments()).toBe(1);
  });
});
