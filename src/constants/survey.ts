export const ROLES = ['frontend', 'backend', 'fullstack', 'mobile', 'other'] as const;
export const EXPERIENCE = ['lt_1y', '1_2y', '3_5y', '6plus_y'] as const;
export const API_SOURCE = ['internal', 'external', 'both'] as const;
export const CHANGE_FREQUENCY = ['weekly', 'monthly', 'few_per_year', 'rarely'] as const;
export const API_PROBLEM = ['yes', 'no', 'not_sure'] as const;
export const FIX_TIME = ['lt_30m', '30m_2h', '2_8h', 'gt_1d', 'not_sure'] as const;
export const BREAK_FREQUENCY = ['never', 'rarely', 'sometimes', 'often'] as const;
export const TOOLS = [
  'manual_testing', 'compiler_errors', 'automated_tests_ci',
  'api_diff_contract', 'logs_monitoring', 'none', 'other',
] as const;
export const DIFFICULTY = [
  'finding_changes', 'identifying_affected_code', 'is_breaking',
  'updating_testing', 'coordination', 'other', 'none_of_these',
] as const;
export const USEFULNESS = ['1', '2', '3', '4', '5'] as const;

export type Role = (typeof ROLES)[number];
export type Experience = (typeof EXPERIENCE)[number];
export type ApiSource = (typeof API_SOURCE)[number];
export type ChangeFrequency = (typeof CHANGE_FREQUENCY)[number];
export type ApiProblem = (typeof API_PROBLEM)[number];
export type FixTime = (typeof FIX_TIME)[number];
export type BreakFrequency = (typeof BREAK_FREQUENCY)[number];
export type Tool = (typeof TOOLS)[number];
export type Difficulty = (typeof DIFFICULTY)[number];
export type Usefulness = (typeof USEFULNESS)[number];

export const LABELS = {
  role: {
    frontend: 'Frontend Developer', backend: 'Backend Developer',
    fullstack: 'Full-stack Developer', mobile: 'Mobile Developer', other: 'Other',
  },
  experience: {
    lt_1y: 'Less than 1 year', '1_2y': '1–2 years',
    '3_5y': '3–5 years', '6plus_y': '6+ years',
  },
  apiSource: {
    internal: 'Mostly internal (company) APIs',
    external: 'Mostly external / third-party APIs',
    both: 'Both internal and external',
  },
  changeFrequency: {
    weekly: 'Weekly or more often', monthly: 'About monthly',
    few_per_year: 'A few times a year', rarely: 'Rarely',
  },
  apiProblem: { yes: 'Yes', no: 'No', not_sure: 'Not sure' },
  fixTime: {
    lt_30m: 'Less than 30 minutes', '30m_2h': '30 minutes–2 hours',
    '2_8h': '2–8 hours', gt_1d: 'More than a day', not_sure: 'Not sure',
  },
  breakFrequency: {
    never: 'Never', rarely: 'Rarely', sometimes: 'Sometimes', often: 'Often',
  },
  tools: {
    manual_testing: 'Manual testing', compiler_errors: 'TypeScript / compiler errors',
    automated_tests_ci: 'Automated tests or CI/CD',
    api_diff_contract: 'API diff or contract-testing tools',
    logs_monitoring: 'Logs or production monitoring', none: 'No specific method', other: 'Other',
  },
  difficulty: {
    finding_changes: 'Finding what changed',
    identifying_affected_code: 'Identifying which frontend code is affected',
    is_breaking: 'Understanding whether a change is breaking',
    updating_testing: 'Updating and testing code',
    coordination: 'Coordinating with backend developers',
    other: 'Other', none_of_these: 'None of these',
  },
  usefulness: {
    '1': '1 – Not useful', '2': '2 – Slightly useful',
    '3': '3 – Moderately useful', '4': '4 – Very useful', '5': '5 – Extremely useful',
  },
} as const;

export const LIMITS = { longText: 2000 } as const;