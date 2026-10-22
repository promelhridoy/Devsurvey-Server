import { Schema, model, type HydratedDocument, type Model } from 'mongoose';
import {
  ROLES,
  EXPERIENCE,
  API_SOURCE,
  CHANGE_FREQUENCY,
  API_PROBLEM,
  FIX_TIME,
  BREAK_FREQUENCY,
  TOOLS,
  DIFFICULTY,
  USEFULNESS,
  LIMITS,
  type Role,
  type Experience,
  type ApiSource,
  type ChangeFrequency,
  type ApiProblem,
  type FixTime,
  type BreakFrequency,
  type Tool,
  type Difficulty,
  type Usefulness,
} from '../constants/survey';

export interface IResearchResponse {
  submissionId?: string;
  role: Role;
  experience: Experience;
  apiSource: ApiSource;
  changeFrequency: ChangeFrequency;
  apiProblem: ApiProblem;
  recentProblem?: string;
  fixTime?: FixTime;
  breakFrequency: BreakFrequency;
  tools: Tool[];
  biggestDifficulty: Difficulty;
  toolUsefulness: Usefulness;
  desiredImprovement?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type ResearchResponseDoc = HydratedDocument<IResearchResponse>;

const schema = new Schema<IResearchResponse>(
  {
    submissionId: { type: String, unique: true, sparse: true, select: false },
    role: { type: String, enum: ROLES, required: true },
    experience: { type: String, enum: EXPERIENCE, required: true },
    apiSource: { type: String, enum: API_SOURCE, required: true },
    changeFrequency: { type: String, enum: CHANGE_FREQUENCY, required: true },
    apiProblem: { type: String, enum: API_PROBLEM, required: true },
    recentProblem: { type: String, trim: true, maxlength: LIMITS.longText },
    fixTime: {
      type: String,
      enum: FIX_TIME,
      required: function (this: IResearchResponse) {
        return this.apiProblem === 'yes';
      },
    },
    breakFrequency: { type: String, enum: BREAK_FREQUENCY, required: true },
    tools: {
      type: [{ type: String, enum: TOOLS }],
      validate: [
        {
          validator: (v: string[]) => Array.isArray(v) && v.length >= 1,
          message: 'At least one tool or method is required',
        },
        {
          validator: (v: string[]) => !v.includes('none') || v.length === 1,
          message: '"none" cannot be combined with other options',
        },
      ],
    },
    biggestDifficulty: { type: String, enum: DIFFICULTY, required: true },
    toolUsefulness: { type: String, enum: USEFULNESS, required: true },
    desiredImprovement: { type: String, trim: true, maxlength: LIMITS.longText },
  },
  { timestamps: true },
);

schema.index({ createdAt: -1 });
schema.index({ role: 1, experience: 1, apiProblem: 1 });

export const ResearchResponse: Model<IResearchResponse> = model<IResearchResponse>('ResearchResponse', schema);