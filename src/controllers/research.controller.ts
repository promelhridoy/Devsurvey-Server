import type { Request, Response } from 'express';
import type { ZodTypeAny, z } from 'zod';
import {
  exportQuerySchema,
  listQuerySchema,
  submissionSchema,
} from '../validators/research.validator';
import * as service from '../services/research.service';
import { ApiError } from '../utils/errors';

/** Parse with Zod and convert failures into a clean 400 response (never leaks internals). */
export function parseOrThrow<S extends ZodTypeAny>(schema: S, data: unknown): z.infer<S> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const errors = result.error.issues.map((i) => ({
      field: i.path.join('.') || 'body',
      message: i.message,
    }));
    throw new ApiError(400, 'Validation failed', errors);
  }
  return result.data;
}

/** POST /api/research/responses (public). Returns a minimal message only. */
export async function submitResponse(req: Request, res: Response): Promise<void> {
  const input = parseOrThrow(submissionSchema, req.body);
  await service.createResponse(input);
  res.status(201).json({ success: true, message: 'Thank you! Your response has been recorded.' });
}

export async function getStats(_req: Request, res: Response): Promise<void> {
  res.json({ success: true, data: await service.getStats() });
}

export async function listResponses(req: Request, res: Response): Promise<void> {
  const query = parseOrThrow(listQuerySchema, req.query);
  res.json({ success: true, data: await service.listResponses(query) });
}

export async function getResponse(req: Request, res: Response): Promise<void> {
  res.json({ success: true, data: await service.getResponseById(String(req.params.id)) });
}

export async function exportResponses(req: Request, res: Response): Promise<void> {
  const query = parseOrThrow(exportQuerySchema, req.query);
  const csv = await service.exportCsv(query);
  const stamp = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="survey-responses-${stamp}.csv"`);
  res.setHeader('Cache-Control', 'no-store');
  res.send('﻿' + csv); // BOM so Excel opens UTF-8 correctly
}
