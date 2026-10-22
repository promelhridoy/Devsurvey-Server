
import request from 'supertest';
import type { Express } from 'express';

export const ADMIN_USER = 'test-admin';
export const ADMIN_PASS = 'correct-horse-battery';

/** A fully valid submission. Override fields per test. */
export function validSubmission(overrides: Record<string, unknown> = {}) {
  return {
    role: 'fullstack',
    experience: '3_5y',
    apiSource: 'both',
    changeFrequency: 'weekly',
    apiProblem: 'yes',
    recentProblem: 'A field was renamed and the UI crashed. We found it from a bug report.',
    fixTime: '2_8h',
    breakFrequency: 'sometimes',
    tools: ['manual_testing', 'automated_tests_ci'],
    biggestDifficulty: 'finding_changes',
    toolUsefulness: '4',
    desiredImprovement: 'Clearer change notices.',
    ...overrides,
  };
}

/** A valid "no problem" submission without conditional fields. */
export function validNoProblem(overrides: Record<string, unknown> = {}) {
  return {
    role: 'backend',
    experience: '6plus_y',
    apiSource: 'external',
    changeFrequency: 'monthly',
    apiProblem: 'no',
    breakFrequency: 'never',
    tools: ['none'],
    biggestDifficulty: 'coordination',
    toolUsefulness: '3',
    ...overrides,
  };
}

/** Returns a supertest agent that keeps the admin session cookie. */
export async function loginAgent(app: Express) {
  const agent = request.agent(app);
  const res = await agent
    .post('/api/research/admin/login')
    .send({ username: ADMIN_USER, password: ADMIN_PASS });

  if (res.status !== 200) {
    throw new Error(`login failed in test helper: ${res.status}`);
  }

  return agent;
}
