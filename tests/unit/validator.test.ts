import { describe, expect, it } from 'vitest';
import { submissionSchema, listQuerySchema } from '../../src/validators/research.validator';
import { validNoProblem, validSubmission } from '../helpers/fixtures';

const fieldsWithErrors = (input: unknown): string[] => {
  const r = submissionSchema.safeParse(input);
  return r.success ? [] : r.error.issues.map((i) => i.path.join('.'));
};

describe('submission validation', () => {
  it('accepts a full valid submission', () => {
    expect(submissionSchema.safeParse(validSubmission()).success).toBe(true);
  });

  it('accepts a minimal "no problem" submission', () => {
    expect(submissionSchema.safeParse(validNoProblem()).success).toBe(true);
  });

  it.each(['role', 'experience', 'apiProblem', 'tools', 'biggestDifficulty', 'followUpConsent'])(
    'rejects a missing required field: %s',
    (field) => {
      const body: Record<string, unknown> = validSubmission();
      delete body[field];
      expect(fieldsWithErrors(body)).toContain(field);
    },
  );

  it.each([
    ['role', 'wizard'],
    ['experience', '10y'],
    ['apiProblem', 'maybe'],
    ['fixTime', 'forever'],
    ['biggestDifficulty', 'boredom'],
    ['followUpConsent', 'perhaps'],
  ])('rejects an invalid enum value for %s', (field, value) => {
    expect(fieldsWithErrors(validSubmission({ [field]: value }))).toContain(field);
  });

  it('rejects an invalid tool value and an empty tool list', () => {
    expect(fieldsWithErrors(validSubmission({ tools: ['manual_testing', 'telepathy'] }))).toContain('tools.1');
    expect(fieldsWithErrors(validSubmission({ tools: [] }))).toContain('tools');
  });

  it('requires fixTime when apiProblem is yes', () => {
    const body: Record<string, unknown> = validSubmission();
    delete body.fixTime;
    expect(fieldsWithErrors(body)).toContain('fixTime');
  });

  it.each(['no', 'not_sure'])('rejects fixTime / recentProblem when apiProblem is %s', (answer) => {
    const bad = validSubmission({ apiProblem: answer });
    const fields = fieldsWithErrors(bad);
    expect(fields).toContain('fixTime');
    expect(fields).toContain('recentProblem');
  });

  it('rejects "none" combined with other tools, but accepts "none" alone', () => {
    expect(fieldsWithErrors(validSubmission({ tools: ['none', 'manual_testing'] }))).toContain('tools');
    expect(submissionSchema.safeParse(validSubmission({ tools: ['none'] })).success).toBe(true);
  });

  it('removes duplicate tools', () => {
    const r = submissionSchema.parse(validSubmission({ tools: ['manual_testing', 'manual_testing'] }));
    expect(r.tools).toEqual(['manual_testing']);
  });

  it('rejects text longer than 2000 characters, accepts exactly 2000', () => {
    expect(fieldsWithErrors(validSubmission({ recentProblem: 'a'.repeat(2001) }))).toContain('recentProblem');
    expect(fieldsWithErrors(validSubmission({ desiredImprovement: 'a'.repeat(2001) }))).toContain('desiredImprovement');
    expect(submissionSchema.safeParse(validSubmission({ recentProblem: 'a'.repeat(2000) })).success).toBe(true);
  });

  it.each(['not-an-email', 'a@b', '@example.com', 'a b@example.com', 'a@example.com, b@example.com'])(
    'rejects invalid contact email %s',
    (email) => {
      expect(fieldsWithErrors(validSubmission({ contactEmail: email }))).toContain('contactEmail');
    },
  );

  it('does not require an email, and treats a blank email as absent', () => {
    const body: Record<string, unknown> = validSubmission();
    delete body.contactEmail;
    expect(submissionSchema.safeParse(body).success).toBe(true);
    expect(submissionSchema.parse(validSubmission({ contactEmail: '   ' })).contactEmail).toBeUndefined();
  });

  it('lowercases and trims the email', () => {
    expect(submissionSchema.parse(validSubmission({ contactEmail: '  Dev@Example.COM ' })).contactEmail).toBe('dev@example.com');
  });

  it('rejects an email when follow-up consent is not "yes"', () => {
    expect(fieldsWithErrors(validSubmission({ followUpConsent: 'no' }))).toContain('contactEmail');
  });

  it('rejects unknown fields (no mass-assignment)', () => {
    const r = submissionSchema.safeParse({ ...validSubmission(), isAdmin: true });
    expect(r.success).toBe(false);
  });

  it('rejects non-string text and non-array tools', () => {
    expect(fieldsWithErrors(validSubmission({ recentProblem: 123 }))).toContain('recentProblem');
    expect(fieldsWithErrors(validSubmission({ tools: 'manual_testing' }))).toContain('tools');
  });

  it('strips control characters and trims free text', () => {
    const r = submissionSchema.parse(validSubmission({ recentProblem: '  hi\u0000 there\u0007  ' }));
    expect(r.recentProblem).toBe('hi there');
  });

  it('requires submissionId (when present) to be a UUID', () => {
    expect(fieldsWithErrors(validSubmission({ submissionId: 'abc' }))).toContain('submissionId');
    expect(
      submissionSchema.safeParse(validSubmission({ submissionId: '3f2504e0-4f89-41d3-9a0c-0305e82c3301' })).success,
    ).toBe(true);
  });
});

describe('admin list query validation', () => {
  it('applies defaults', () => {
    const q = listQuerySchema.parse({});
    expect(q.page).toBe(1);
    expect(q.limit).toBe(20);
  });
  it('rejects bad values', () => {
    expect(listQuerySchema.safeParse({ page: '0' }).success).toBe(false);
    expect(listQuerySchema.safeParse({ limit: '101' }).success).toBe(false);
    expect(listQuerySchema.safeParse({ role: 'wizard' }).success).toBe(false);
    expect(listQuerySchema.safeParse({ from: 'yesterday' }).success).toBe(false);
  });
});
