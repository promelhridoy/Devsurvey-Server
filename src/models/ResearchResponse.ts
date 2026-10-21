import { Schema, model, type HydratedDocument, type Model } from 'mongoose';
import {
  ROLES,
  EXPERIENCE,
  API_PROBLEM,
  FIX_TIME,
  TOOLS,
  DIFFICULTY,
  FOLLOW_UP,
  LIMITS,
  type Role,
  type Experience,
  type ApiProblem,
  type FixTime,
  type Tool,
  type Difficulty,
  type FollowUp,
} from '../constants/survey';

export interface IResearchResponse {
  submissionId?: string; // client-generated UUID used only for idempotency (retry/double-click protection)
  role: Role;
  experience: Experience;
  apiProblem: ApiProblem;
  recentProblem?: string;
  fixTime?: FixTime;
  tools: Tool[];
  biggestDifficulty: Difficulty;
  desiredImprovement?: string;
  followUpConsent: FollowUp;
  contactEmail?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type ResearchResponseDoc = HydratedDocument<IResearchResponse>;

const schema = new Schema<IResearchResponse>(
  {
    submissionId: { type: String, unique: true, sparse: true, select: false },
    role: { type: String, enum: ROLES, required: true },
    experience: { type: String, enum: EXPERIENCE, required: true },
    apiProblem: { type: String, enum: API_PROBLEM, required: true },
    recentProblem: { type: String, trim: true, maxlength: LIMITS.longText },
    fixTime: {
      type: String,
      enum: FIX_TIME,
      required: function (this: IResearchResponse) {
        return this.apiProblem === 'yes';
      },
    },
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
    desiredImprovement: { type: String, trim: true, maxlength: LIMITS.longText },
    followUpConsent: { type: String, enum: FOLLOW_UP, required: true },
    contactEmail: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: LIMITS.email,
      validate: {
        validator: function (this: unknown, v?: string) {
          return !v || (this as IResearchResponse).followUpConsent === 'yes';
        },
        message: 'Contact email is only allowed when follow-up consent is "yes"',
      },
    },
  },
  { timestamps: true },
);

schema.index({ createdAt: -1 });
schema.index({ role: 1, experience: 1, apiProblem: 1 });

export const ResearchResponse: Model<IResearchResponse> = model<IResearchResponse>('ResearchResponse', schema);
