import { isValidObjectId, type QueryFilter } from 'mongoose';
import { ResearchResponse, type IResearchResponse } from '../models/ResearchResponse';
import {
  ROLES,
  EXPERIENCE,
  API_SOURCE,
  CHANGE_FREQUENCY,
  API_PROBLEM,
  BREAK_FREQUENCY,
  TOOLS,
  DIFFICULTY,
  USEFULNESS,
  LABELS,
} from '../constants/survey';
import type { ExportQuery, ListQuery, SubmissionInput } from '../validators/research.validator';
import { ApiError } from '../utils/errors';
import { toCsv } from '../utils/csv';

type Filters = Pick<ListQuery, 'role' | 'experience' | 'apiProblem' | 'from' | 'to' | 'q'>;

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function buildFilter(f: Filters): QueryFilter<IResearchResponse> {
  const filter: QueryFilter<IResearchResponse> = {};
  if (f.role) filter.role = f.role;
  if (f.experience) filter.experience = f.experience;
  if (f.apiProblem) filter.apiProblem = f.apiProblem;

  if (f.from || f.to) {
    const range: { $gte?: Date; $lt?: Date } = {};
    if (f.from) range.$gte = new Date(f.from);
    if (f.to) {
      const end = new Date(f.to);
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

export async function createResponse(input: SubmissionInput): Promise<void> {
  try {
    await ResearchResponse.create(input);
  } catch (err) {
    const e = err as { code?: number };
    if (e.code === 11000 && input.submissionId) return;
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
    totals: { total: number; problemYes: number }[];
    byRole: CountRow[];
    byExperience: CountRow[];
    byApiSource: CountRow[];
    byChangeFrequency: CountRow[];
    byApiProblem: CountRow[];
    byBreakFrequency: CountRow[];
    byDifficulty: CountRow[];
    byUsefulness: CountRow[];
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
            },
          },
        ],
        byRole: [{ $group: { _id: '$role', count: { $sum: 1 } } }],
        byExperience: [{ $group: { _id: '$experience', count: { $sum: 1 } } }],
        byApiSource: [{ $group: { _id: '$apiSource', count: { $sum: 1 } } }],
        byChangeFrequency: [{ $group: { _id: '$changeFrequency', count: { $sum: 1 } } }],
        byApiProblem: [{ $group: { _id: '$apiProblem', count: { $sum: 1 } } }],
        byBreakFrequency: [{ $group: { _id: '$breakFrequency', count: { $sum: 1 } } }],
        byDifficulty: [{ $group: { _id: '$biggestDifficulty', count: { $sum: 1 } } }],
        byUsefulness: [{ $group: { _id: '$toolUsefulness', count: { $sum: 1 } } }],
        tools: [{ $unwind: '$tools' }, { $group: { _id: '$tools', count: { $sum: 1 } } }],
      },
    },
  ]);

  const t = facet.totals[0] ?? { total: 0, problemYes: 0 };
  const byCountDesc = <T extends { count: number }>(arr: T[]) => [...arr].sort((a, b) => b.count - a.count);

  return {
    totalSubmissions: t.total,
    problemYes: t.problemYes,
    problemYesPercent: t.total ? Math.round((t.problemYes / t.total) * 1000) / 10 : 0,
    byRole: toBuckets(ROLES, LABELS.role, facet.byRole),
    byExperience: toBuckets(EXPERIENCE, LABELS.experience, facet.byExperience),
    byApiSource: toBuckets(API_SOURCE, LABELS.apiSource, facet.byApiSource),
    byChangeFrequency: toBuckets(CHANGE_FREQUENCY, LABELS.changeFrequency, facet.byChangeFrequency),
    byApiProblem: toBuckets(API_PROBLEM, LABELS.apiProblem, facet.byApiProblem),
    byBreakFrequency: toBuckets(BREAK_FREQUENCY, LABELS.breakFrequency, facet.byBreakFrequency),
    tools: byCountDesc(toBuckets(TOOLS, LABELS.tools, facet.tools)),
    difficulties: byCountDesc(toBuckets(DIFFICULTY, LABELS.difficulty, facet.byDifficulty)),
    byUsefulness: toBuckets(USEFULNESS, LABELS.usefulness, facet.byUsefulness),
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
  toolUsefulness: d.toolUsefulness,
});

export async function listResponses(query: ListQuery) {
  const filter = buildFilter(query);
  const skip = (query.page - 1) * query.limit;
  const [docs, total] = await Promise.all([
    ResearchResponse.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(query.limit)
      .select('role experience apiProblem toolUsefulness createdAt')
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
    apiSource: d.apiSource,
    changeFrequency: d.changeFrequency,
    apiProblem: d.apiProblem,
    recentProblem: d.recentProblem ?? null,
    fixTime: d.fixTime ?? null,
    breakFrequency: d.breakFrequency,
    tools: d.tools,
    biggestDifficulty: d.biggestDifficulty,
    toolUsefulness: d.toolUsefulness,
    desiredImprovement: d.desiredImprovement ?? null,
  };
}

const EXPORT_LIMIT = 10000;

export async function exportCsv(query: ExportQuery): Promise<string> {
  const docs = await ResearchResponse.find(buildFilter(query))
    .sort({ createdAt: -1, _id: -1 })
    .limit(EXPORT_LIMIT)
    .lean();

  const headers = [
    'id',
    'submitted_at_utc',
    'role',
    'experience',
    'api_source',
    'change_frequency',
    'api_problem',
    'recent_problem',
    'fix_time',
    'break_frequency',
    'tools',
    'biggest_difficulty',
    'tool_usefulness',
    'desired_improvement',
  ];

  const rows = docs.map((d) => [
    String(d._id),
    d.createdAt.toISOString(),
    LABELS.role[d.role],
    LABELS.experience[d.experience],
    LABELS.apiSource[d.apiSource],
    LABELS.changeFrequency[d.changeFrequency],
    LABELS.apiProblem[d.apiProblem],
    d.recentProblem ?? '',
    d.fixTime ? LABELS.fixTime[d.fixTime] : '',
    LABELS.breakFrequency[d.breakFrequency],
    d.tools.map((t) => LABELS.tools[t]).join('; '),
    LABELS.difficulty[d.biggestDifficulty],
    LABELS.usefulness[d.toolUsefulness],
    d.desiredImprovement ?? '',
  ]);

  return toCsv(headers, rows);
}