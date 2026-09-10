import { z } from 'zod';

export const CreateUrlSchema = z.object({
  originalUrl: z.string().url().max(2048),
  customCode: z
    .string()
    .min(3)
    .max(32)
    .regex(/^[a-zA-Z0-9_-]+$/, 'Only letters, numbers, dashes and underscores')
    .optional(),
});

export type CreateUrlInput = z.infer<typeof CreateUrlSchema>;

export interface UrlDto {
  id: string;
  shortCode: string;
  originalUrl: string;
  clicks: number;
  createdAt: string;
  shortUrl: string;
  userId?: string | null;
}

export const RegisterSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(128),
});
export type RegisterInput = z.infer<typeof RegisterSchema>;

export const LoginSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(128),
});
export type LoginInput = z.infer<typeof LoginSchema>;

export interface AuthUser {
  id: string;
  email: string;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

export interface AnalyticsBucket {
  key: string;
  count: number;
}

export interface AnalyticsPoint {
  date: string; // ISO date (YYYY-MM-DD)
  count: number;
}

export interface AnalyticsResponse {
  urlId: string;
  shortCode: string;
  originalUrl: string;
  totalClicks: number;
  byCountry: AnalyticsBucket[];
  byReferrer: AnalyticsBucket[];
  timeline: AnalyticsPoint[]; // last 30 days, one bucket per day
}
