import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { ResearchResponse } from '../../src/models/ResearchResponse';
import { validSubmission } from '../helpers/fixtures';

describe('MongoDB failure handling', () => {
  afterEach(() => vi.restoreAllMocks());

  it('returns a generic 500 and never leaks database details or stack traces', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(ResearchResponse, 'create').mockRejectedValue(
      new Error('connection to cluster0-shard-00-01.secret.mongodb.net:27017 refused; user=admin'),
    );
    const res = await request(createApp()).post('/api/research/responses').send(validSubmission());
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ success: false, message: 'Something went wrong. Please try again later.' });
    const text = JSON.stringify(res.body) + JSON.stringify(res.headers);
    expect(text).not.toMatch(/secret|mongodb|cluster0|27017|stack| at /i);
  });

  it('treats a duplicate submissionId (error code 11000) as an idempotent success', async () => {
    vi.spyOn(ResearchResponse, 'create').mockRejectedValue(Object.assign(new Error('E11000 duplicate key'), { code: 11000 }));
    const res = await request(createApp())
      .post('/api/research/responses')
      .send(validSubmission({ submissionId: '3f2504e0-4f89-41d3-9a0c-0305e82c3301' }));
    expect(res.status).toBe(201);
  });

  it('does not hide a duplicate-key error when there is no submissionId', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(ResearchResponse, 'create').mockRejectedValue(Object.assign(new Error('E11000 duplicate key'), { code: 11000 }));
    const res = await request(createApp()).post('/api/research/responses').send(validSubmission());
    expect(res.status).toBe(500);
  });
});
