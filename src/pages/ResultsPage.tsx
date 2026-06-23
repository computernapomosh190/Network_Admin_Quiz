import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase, QuizResult } from '../lib/supabase';
import {
  Trophy,
  Clock,
  Calendar,
  Target,
  ChevronRight,
  Medal,
  Award,
} from 'lucide-react';

export function ResultsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [result, setResult] = useState<QuizResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [place, setPlace] = useState<number | null>(null);

  useEffect(() => {
    loadResult();
  }, []);

  const loadResult = async () => {
    try {
      const { data, error } = await supabase
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
          const sortedResults = allResults.sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            return a.duration_seconds - b.duration_seconds;
          });
          const userPlace = sortedResults.findIndex((r) => r.user_id === user!.id) + 1;
          setPlace(userPlace);
        }
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
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Результатів не знайдено
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Ви ще не пройшли вікторину.
          </p>
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

  return (
    <div className="max-w-2xl mx-auto py-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Результат вікторини
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Вітаємо з завершенням вікторини!
        </p>
      </div>

      {isTopThree && (
        <div className="mb-8">
          <div
            className={`rounded-2xl p-8 text-center ${
              place === 1
                ? 'bg-gradient-to-br from-gold-400 to-gold-600'
                : place === 2
                ? 'bg-gradient-to-br from-gray-300 to-gray-500'
                : 'bg-gradient-to-br from-bronze-400 to-bronze-600'
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
            <p className="text-white/90 text-lg">
              Ви зайняли {place} місце у рейтингу!
            </p>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
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
            <Trophy className="w-8 h-8 text-gold-500 mx-auto mb-2" />
            <p className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
              {place || '-'}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Місце</p>
          </div>
        </div>

        <div className="grid grid-cols-2 divide-x divide-y divide-gray-100 dark:divide-gray-700 border-t border-gray-100 dark:border-gray-700">
          <div className="p-4 flex items-center gap-3">
            <Clock className="w-5 h-5 text-gray-400" />
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Час</p>
              <p className="font-medium text-gray-900 dark:text-white">
                {formatDuration(result.duration_seconds)}
              </p>
            </div>
          </div>
          <div className="p-4 flex items-center gap-3">
            <Calendar className="w-5 h-5 text-gray-400" />
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Дата</p>
              <p className="font-medium text-gray-900 dark:text-white text-sm">
                {formatDate(result.finished_at)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
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
            className="flex items-center justify-center gap-2 px-6 py-3 bg-gold-500 hover:bg-gold-600 text-white font-medium rounded-xl transition-colors"
          >
            <Award className="w-5 h-5" />
            Мій сертифікат
          </button>
        )}
      </div>
    </div>
  );
}
