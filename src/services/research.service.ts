import { isValidObjectId, type QueryFilter } from 'mongoose';
import { ResearchResponse, type IResearchResponse } from '../models/ResearchResponse';
import {
  ROLES,
  EXPERIENCE,
  API_PROBLEM,
  TOOLS,
  DIFFICULTY,
  LABELS,
} from '../constants/survey';
import type { ExportQuery, ListQuery, SubmissionInput } from '../validators/research.validator';
import { ApiError } from '../utils/errors';
import { toCsv } from '../utils/csv';

type Filters = Pick<ListQuery, 'role' | 'experience' | 'apiProblem' | 'followUpConsent' | 'from' | 'to' | 'q'>;

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Build the MongoDB filter from validated query parameters. */
export function buildFilter(f: Filters): QueryFilter<IResearchResponse> {
  const filter: QueryFilter<IResearchResponse> = {};
  if (f.role) filter.role = f.role;
  if (f.experience) filter.experience = f.experience;
  if (f.apiProblem) filter.apiProblem = f.apiProblem;
  if (f.followUpConsent) filter.followUpConsent = f.followUpConsent;

  if (f.from || f.to) {
    const range: { $gte?: Date; $lt?: Date } = {};
    if (f.from) range.$gte = new Date(f.from);
    if (f.to) {
      const end = new Date(f.to);
      // A date-only value means "through the end of that day".
      if (/^\d{4}-\d{2}-\d{2}$/.test(f.to)) end.setUTCDate(end.getUTCDate() + 1);
      range.$lt = end;
    }
    filter.createdAt = range;
  }

  const q = f.q?.trim();
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ recentProblem: rx }, { desiredImprovement: rx }];
  }
  return filter;
}

/** Store one submission. A repeated submissionId (retry / double click) is treated as success. */
export async function createResponse(input: SubmissionInput): Promise<void> {
  try {
    await ResearchResponse.create(input);
  } catch (err) {
    const e = err as { code?: number };
    if (e.code === 11000 && input.submissionId) return; // idempotent duplicate
    throw err;
  }
}

interface CountRow {
  _id: string;
  count: number;
}

const toBuckets = <K extends string>(keys: readonly K[], labels: Record<K, string>, rows: CountRow[]) => {
  const map = new Map(rows.map((r) => [r._id, r.count]));
  return keys.map((key) => ({ key, label: labels[key], count: map.get(key) ?? 0 }));
};

export async function getStats() {
  const [facet] = await ResearchResponse.aggregate<{
    totals: { total: number; problemYes: number; followUpYes: number }[];
    byRole: CountRow[];
    byExperience: CountRow[];
    byApiProblem: CountRow[];
    byDifficulty: CountRow[];
    tools: CountRow[];
  }>([
    {
      $facet: {
        totals: [
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              problemYes: { $sum: { $cond: [{ $eq: ['$apiProblem', 'yes'] }, 1, 0] } },
              followUpYes: { $sum: { $cond: [{ $eq: ['$followUpConsent', 'yes'] }, 1, 0] } },
            },
          },
        ],
        byRole: [{ $group: { _id: '$role', count: { $sum: 1 } } }],
        byExperience: [{ $group: { _id: '$experience', count: { $sum: 1 } } }],
        byApiProblem: [{ $group: { _id: '$apiProblem', count: { $sum: 1 } } }],
        byDifficulty: [{ $group: { _id: '$biggestDifficulty', count: { $sum: 1 } } }],
        tools: [{ $unwind: '$tools' }, { $group: { _id: '$tools', count: { $sum: 1 } } }],
      },
    },
  ]);

  const t = facet.totals[0] ?? { total: 0, problemYes: 0, followUpYes: 0 };
  const byCountDesc = <T extends { count: number }>(arr: T[]) => [...arr].sort((a, b) => b.count - a.count);

  return {
    totalSubmissions: t.total,
    problemYes: t.problemYes,
    problemYesPercent: t.total ? Math.round((t.problemYes / t.total) * 1000) / 10 : 0,
    followUpYes: t.followUpYes,
    byRole: toBuckets(ROLES, LABELS.role, facet.byRole),
    byExperience: toBuckets(EXPERIENCE, LABELS.experience, facet.byExperience),
    byApiProblem: toBuckets(API_PROBLEM, LABELS.apiProblem, facet.byApiProblem),
    tools: byCountDesc(toBuckets(TOOLS, LABELS.tools, facet.tools)),
    difficulties: byCountDesc(toBuckets(DIFFICULTY, LABELS.difficulty, facet.byDifficulty)),
    note:
      'These are counts of submissions. The survey is anonymous, so they cannot be treated as counts of unique people.',
  };
}

const toListItem = (d: IResearchResponse & { _id: unknown }) => ({
  id: String(d._id),
  createdAt: d.createdAt,
  role: d.role,
  experience: d.experience,
  apiProblem: d.apiProblem,
  followUpConsent: d.followUpConsent,
});

export async function listResponses(query: ListQuery) {
  const filter = buildFilter(query);
  const skip = (query.page - 1) * query.limit;
  const [docs, total] = await Promise.all([
    ResearchResponse.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(query.limit)
      .select('role experience apiProblem followUpConsent createdAt')
      .lean(),
    ResearchResponse.countDocuments(filter),
  ]);
  return {
    items: docs.map((d) => toListItem(d as unknown as IResearchResponse & { _id: unknown })),
    page: query.page,
    limit: query.limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / query.limit)),
  };
}

export async function getResponseById(id: string) {
  if (!isValidObjectId(id)) throw new ApiError(400, 'Invalid response id');
  const d = await ResearchResponse.findById(id).lean();
  if (!d) throw new ApiError(404, 'Response not found');
  return {
    id: String(d._id),
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
    role: d.role,
    experience: d.experience,
    apiProblem: d.apiProblem,
    recentProblem: d.recentProblem ?? null,
    fixTime: d.fixTime ?? null,
    tools: d.tools,
    biggestDifficulty: d.biggestDifficulty,
    desiredImprovement: d.desiredImprovement ?? null,
    followUpConsent: d.followUpConsent,
    contactEmail: d.contactEmail ?? null,
  };
}

const EXPORT_LIMIT = 10000;

export async function exportCsv(query: ExportQuery): Promise<string> {
  const includeContact = query.includeContact === 'true';
  const docs = await ResearchResponse.find(buildFilter(query)).sort({ createdAt: -1, _id: -1 }).limit(EXPORT_LIMIT).lean();

  const headers = [
    'id',
    'submitted_at_utc',
    'role',
    'experience',
    'api_problem',
    'recent_problem',
    'fix_time',
    'tools',
    'biggest_difficulty',
    'desired_improvement',
    'follow_up_consent',
  ];
  if (includeContact) headers.push('contact_email');

  const rows = docs.map((d) => {
    const row: unknown[] = [
      String(d._id),
      d.createdAt.toISOString(),
      LABELS.role[d.role],
      LABELS.experience[d.experience],
      LABELS.apiProblem[d.apiProblem],
      d.recentProblem ?? '',
      d.fixTime ? LABELS.fixTime[d.fixTime] : '',
      d.tools.map((t) => LABELS.tools[t]).join('; '),
      LABELS.difficulty[d.biggestDifficulty],
      d.desiredImprovement ?? '',
      LABELS.followUp[d.followUpConsent],
    ];
    if (includeContact) row.push(d.contactEmail ?? '');
    return row;
  });
  return toCsv(headers, rows);
}
