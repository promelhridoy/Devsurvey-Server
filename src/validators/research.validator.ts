import { z } from 'zod';
import {
  ROLES,
  EXPERIENCE,
  API_PROBLEM,
  FIX_TIME,
  TOOLS,
  DIFFICULTY,
  FOLLOW_UP,
  LIMITS,
} from '../constants/survey';

// Remove control characters (except newline/tab in free text) and trim.
// Output is stored as plain text; the UI escapes it on render and the CSV export neutralizes formulas.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const clean = (s: string): string => s.replace(CONTROL_CHARS, '').replace(/\r\n/g, '\n').trim();

const optionalText = (max: number) =>
  z
    .string({ invalid_type_error: 'Must be text' })
    .transform(clean)
    .refine((s) => s.length <= max, { message: `Must be at most ${max} characters` })
    .transform((s) => (s === '' ? undefined : s))
    .optional();

const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]{2,}$/;

const optionalEmail = z
  .string({ invalid_type_error: 'Must be text' })
  .transform((s) => clean(s).toLowerCase())
  .refine((s) => s === '' || (s.length <= LIMITS.email && EMAIL_RE.test(s)), {
    message: 'Enter a valid email address',
  })
  .transform((s) => (s === '' ? undefined : s))
  .optional();

const enumMsg = (label: string) => ({ errorMap: () => ({ message: `Select a valid ${label}` }) });

export const submissionSchema = z
  .object({
    submissionId: z.string().uuid('submissionId must be a UUID').optional(),
    role: z.enum(ROLES, enumMsg('role')),
    experience: z.enum(EXPERIENCE, enumMsg('experience level')),
    apiProblem: z.enum(API_PROBLEM, enumMsg('answer')),
    recentProblem: optionalText(LIMITS.longText),
    fixTime: z.enum(FIX_TIME, enumMsg('time range')).optional(),
    tools: z
      .array(z.enum(TOOLS, enumMsg('tool or method')), { required_error: 'Select at least one option' })
      .min(1, 'Select at least one option')
      .max(TOOLS.length)
      .transform((arr) => Array.from(new Set(arr))),
    biggestDifficulty: z.enum(DIFFICULTY, enumMsg('difficulty')),
    desiredImprovement: optionalText(LIMITS.longText),
    followUpConsent: z.enum(FOLLOW_UP, enumMsg('answer')),
    contactEmail: optionalEmail,
  })
  .strict()
  .superRefine((d, ctx) => {
    if (d.apiProblem === 'yes') {
      if (!d.fixTime) {
        ctx.addIssue({ code: 'custom', path: ['fixTime'], message: 'Select how long it took to fix' });
      }
    } else {
      if (d.fixTime !== undefined) {
        ctx.addIssue({ code: 'custom', path: ['fixTime'], message: 'Only allowed when an API problem was experienced' });
      }
      if (d.recentProblem !== undefined) {
        ctx.addIssue({ code: 'custom', path: ['recentProblem'], message: 'Only allowed when an API problem was experienced' });
      }
    }
    if (d.tools.includes('none') && d.tools.length > 1) {
      ctx.addIssue({ code: 'custom', path: ['tools'], message: '"No specific method" cannot be combined with other options' });
    }
    if (d.followUpConsent !== 'yes' && d.contactEmail !== undefined) {
      ctx.addIssue({ code: 'custom', path: ['contactEmail'], message: 'Only allowed when you agree to a follow-up interview' });
    }
  });

export type SubmissionInput = z.infer<typeof submissionSchema>;

export const loginSchema = z
  .object({
    username: z.string().min(1).max(200),
    password: z.string().min(1).max(200),
  })
  .strict();

const dateOnly = /^\d{4}-\d{2}-\d{2}$/;
const dateParam = z
  .string()
  .refine((s) => (dateOnly.test(s) || !Number.isNaN(Date.parse(s))) && !Number.isNaN(Date.parse(s)), {
    message: 'Must be an ISO date (YYYY-MM-DD)',
  });

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  role: z.enum(ROLES).optional(),
  experience: z.enum(EXPERIENCE).optional(),
  apiProblem: z.enum(API_PROBLEM).optional(),
  followUpConsent: z.enum(FOLLOW_UP).optional(),
  from: dateParam.optional(),
  to: dateParam.optional(),
  q: z.string().max(100).optional(),
});

export type ListQuery = z.infer<typeof listQuerySchema>;

export const exportQuerySchema = listQuerySchema
  .omit({ page: true, limit: true })
  .extend({ includeContact: z.enum(['true', 'false']).default('false') });

export type ExportQuery = z.infer<typeof exportQuerySchema>;
