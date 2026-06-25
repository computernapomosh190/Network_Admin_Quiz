import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type User = {
  id: string;
  surname: string;
  name: string;
  patronymic: string;
  email: string;
  role: 'user' | 'admin';
  created_at: string;
  attempts_remaining?: number;
};

export type MatchingPair = {
  left: string;
  right: string;
};

export type Question = {
  id: string;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
  question: string;
  question_type: 'single' | 'multiple' | 'matching' | 'true_false' | 'practical';
  options: string[] | MatchingPair[];
  correct_answers: number[];
  points: number;
  created_at: string;
};

export type QuizResult = {
  id: string;
  user_id: string;
  score: number;
  max_score: number;
  percentage: number;
  duration_seconds: number;
  started_at: string;
  finished_at: string;
  answers: Record<string, number[]>;
  user?: User;
};

export type Certificate = {
  id: string;
  user_id: string;
  quiz_result_id: string;
  place: number;
  certificate_number: string;
  verification_code: string;
  created_at: string;
  user?: User;
};
