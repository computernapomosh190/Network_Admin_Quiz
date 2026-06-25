import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase, QuizResult, Question, MatchingPair } from '../lib/supabase';
import {
  Trophy,
  Clock,
  Calendar,
  Target,
  ChevronRight,
  Medal,
  Award,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface QuestionAnalysis {
  question: Question;
  userAnswer: number[];
  isCorrect: boolean;
  partialScore?: number;
}

export function ResultsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [result, setResult] = useState<QuizResult | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [place, setPlace] = useState<number | null>(null);
  const [showAnalysis, setShowAnalysis] = useState(false);

  useEffect(() => {
    loadResult();
  }, []);

  const loadResult = async () => {
    try {
      const { data } = await supabase
        .from('quiz_results')
        .select('*')
        .eq('user_id', user!.id)
        .order('finished_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        setResult(data);

        const { data: allResults } = await supabase
          .from('quiz_results')
          .select('id, score, duration_seconds, user_id')
          .order('score', { ascending: false })
          .order('duration_seconds', { ascending: true });

        if (allResults) {
          const sorted = allResults.sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            return a.duration_seconds - b.duration_seconds;
          });
          setPlace(sorted.findIndex((r) => r.user_id === user!.id) + 1);
        }

        // Load all questions for analysis
        const { data: questionsData } = await supabase
          .from('questions')
          .select('*')
          .order('category', { ascending: true });
        setQuestions(questionsData || []);
      }
    } catch (error) {
      console.error('Error loading result:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins} хв ${secs} сек`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('uk-UA', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const buildAnalysis = (): QuestionAnalysis[] => {
    if (!result) return [];
    return questions.map((question) => {
      const userAnswer: number[] = result.answers[question.id] || [];

      if (question.question_type === 'matching') {
        const pairs = question.options as MatchingPair[];
        const correctCount = pairs.filter((_, i) => userAnswer[i] === i).length;
        const isCorrect = correctCount === pairs.length;
        return { question, userAnswer, isCorrect, partialScore: correctCount };
      }

      const correctAnswer = question.correct_answers as number[];
      const isCorrect =
        JSON.stringify([...userAnswer].sort()) === JSON.stringify([...correctAnswer].sort());
      return { question, userAnswer, isCorrect };
    });
  };

  const getOptionLabel = (question: Question, index: number): string => {
    if (question.question_type === 'matching') return '';
    const opts = question.options as string[];
    return opts[index] ?? `Варіант ${index + 1}`;
  };

  const getCorrectLabel = (question: Question): string => {
    if (question.question_type === 'matching') {
      const pairs = question.options as MatchingPair[];
      return pairs.map((p) => `${p.left} → ${p.right}`).join('\n');
    }
    const correctAnswer = question.correct_answers as number[];
    return correctAnswer.map((i) => getOptionLabel(question, i)).join(', ');
  };

  const getUserAnswerLabel = (question: Question, userAnswer: number[]): string => {
    if (question.question_type === 'matching') {
      const pairs = question.options as MatchingPair[];
      if (!userAnswer.length || userAnswer.every((v) => v === -1)) return 'Не відповів';
      return pairs
        .map((p, i) => {
          const rightIdx = userAnswer[i];
          const rightVal =
            rightIdx !== undefined && rightIdx >= 0 && rightIdx < pairs.length
              ? pairs[rightIdx].right
              : '?';
          return `${p.left} → ${rightVal}`;
        })
        .join('\n');
    }
    if (!userAnswer.length) return 'Не відповів';
    return userAnswer.map((i) => getOptionLabel(question, i)).join(', ');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-100 dark:border-gray-700">
          <Trophy className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Результатів не знайдено</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">Ви ще не пройшли вікторину.</p>
          <button
            onClick={() => navigate('/quiz')}
            className="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-xl transition-colors"
          >
            Почати вікторину
          </button>
        </div>
      </div>
    );
  }

  const percentage = result.percentage;
  const isTopThree = place && place <= 3;
  const analysis = buildAnalysis();
  const correctCount = analysis.filter((a) => a.isCorrect).length;

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Результат вікторини</h1>
        <p className="text-gray-600 dark:text-gray-400">Вітаємо з завершенням вікторини!</p>
      </div>

      {isTopThree && (
        <div className="mb-8">
          <div
            className={`rounded-2xl p-8 text-center ${
              place === 1
                ? 'bg-gradient-to-br from-yellow-400 to-yellow-600'
                : place === 2
                ? 'bg-gradient-to-br from-gray-300 to-gray-500'
                : 'bg-gradient-to-br from-orange-400 to-orange-600'
            }`}
          >
            <div className="animate-bounce mb-4">
              {place === 1 ? (
                <Medal className="w-20 h-20 text-white mx-auto" />
              ) : (
                <Award className="w-20 h-20 text-white mx-auto" />
              )}
            </div>
            <h2 className="text-3xl font-bold text-white mb-2">
              {place === 1 && 'Переможець!'}
              {place === 2 && 'Друге місце!'}
              {place === 3 && 'Третє місце!'}
            </h2>
            <p className="text-white/90 text-lg">Ви зайняли {place} місце у рейтингу!</p>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden mb-6">
        <div className="p-8 text-center border-b border-gray-100 dark:border-gray-700">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-primary-100 dark:bg-primary-900/30 mb-4">
            <span className="text-4xl font-bold text-primary-600 dark:text-primary-400">
              {Math.round(percentage)}%
            </span>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            {percentage >= 80 ? 'Чудовий результат!' : percentage >= 60 ? 'Добрий результат!' : 'Ви можете краще!'}
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            {user!.surname} {user!.name}
          </p>
        </div>

        <div className="grid grid-cols-2 divide-x divide-gray-100 dark:divide-gray-700">
          <div className="p-6 text-center">
            <Target className="w-8 h-8 text-primary-600 dark:text-primary-400 mx-auto mb-2" />
            <p className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
              {result.score}/{result.max_score}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Балів</p>
          </div>
          <div className="p-6 text-center">
            <Trophy className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
            <p className="text-3xl font-bold text-gray-900 dark:text-white mb-1">{place || '-'}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Місце</p>
          </div>
        </div>

        <div className="grid grid-cols-2 divide-x divide-y divide-gray-100 dark:divide-gray-700 border-t border-gray-100 dark:border-gray-700">
          <div className="p-4 flex items-center gap-3">
            <Clock className="w-5 h-5 text-gray-400" />
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Час</p>
              <p className="font-medium text-gray-900 dark:text-white">{formatDuration(result.duration_seconds)}</p>
            </div>
          </div>
          <div className="p-4 flex items-center gap-3">
            <Calendar className="w-5 h-5 text-gray-400" />
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Дата</p>
              <p className="font-medium text-gray-900 dark:text-white text-sm">{formatDate(result.finished_at)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Analysis section */}
      {analysis.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden mb-6">
          <button
            onClick={() => setShowAnalysis(!showAnalysis)}
            className="w-full flex items-center justify-between p-6 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900/30 rounded-xl flex items-center justify-center">
                <Target className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              </div>
              <div className="text-left">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Аналіз результатів</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {correctCount} правильних з {analysis.length} питань
                </p>
              </div>
            </div>
            {showAnalysis ? (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            )}
          </button>

          {showAnalysis && (
            <div className="divide-y divide-gray-100 dark:divide-gray-700 border-t border-gray-100 dark:border-gray-700">
              {analysis.map((item, idx) => {
                const userAnswerLabel = getUserAnswerLabel(item.question, item.userAnswer);
                const correctLabel = getCorrectLabel(item.question);
                return (
                  <div key={item.question.id} className="p-6">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 text-xs font-bold text-gray-600 dark:text-gray-300">
                          {idx + 1}
                        </span>
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                          {item.question.category} · {item.question.points} бал(ів)
                        </span>
                      </div>
                      {item.isCorrect ? (
                        <span className="flex items-center gap-1 text-green-600 dark:text-green-400 font-semibold text-sm">
                          <CheckCircle2 className="w-5 h-5" /> Правильно
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-red-500 dark:text-red-400 font-semibold text-sm">
                          <XCircle className="w-5 h-5" /> Неправильно
                        </span>
                      )}
                    </div>

                    <p className="font-medium text-gray-900 dark:text-white mb-4 leading-relaxed">
                      {item.question.question}
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div
                        className={`rounded-xl p-3 border ${
                          item.isCorrect
                            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                            : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                        }`}
                      >
                        <p className="text-xs font-semibold mb-1 text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                          Ваша відповідь
                        </p>
                        <p
                          className={`text-sm font-medium whitespace-pre-line ${
                            item.isCorrect
                              ? 'text-green-700 dark:text-green-300'
                              : 'text-red-600 dark:text-red-400'
                          }`}
                        >
                          {userAnswerLabel}
                        </p>
                        {item.question.question_type === 'matching' && item.partialScore !== undefined && (
                          <p className="text-xs mt-1 text-gray-500">
                            Правильних пар: {item.partialScore} / {(item.question.options as MatchingPair[]).length}
                          </p>
                        )}
                      </div>

                      <div className="rounded-xl p-3 border bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
                        <p className="text-xs font-semibold mb-1 text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                          Правильна відповідь
                        </p>
                        <p className="text-sm font-medium text-green-700 dark:text-green-300 whitespace-pre-line">
                          {correctLabel}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <button
          onClick={() => navigate('/ranking')}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-xl transition-colors"
        >
          <Trophy className="w-5 h-5" />
          Переглянути рейтинг
          <ChevronRight className="w-5 h-5" />
        </button>
        {isTopThree && (
          <button
            onClick={() => navigate('/certificate')}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-yellow-500 hover:bg-yellow-600 text-white font-medium rounded-xl transition-colors"
          >
            <Award className="w-5 h-5" />
            Мій сертифікат
          </button>
        )}
      </div>
    </div>
  );
}
