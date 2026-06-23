import React, { useState, useEffect } from 'react';
import { supabase, User, QuizResult } from '../lib/supabase';
import { Trophy, Medal, Award, Clock, RefreshCw, ChevronRight } from 'lucide-react';

interface RankingEntry extends QuizResult {
  user: User;
  place: number;
}

export function RankingPage() {
  const [rankings, setRankings] = useState<RankingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    loadRankings();

    const channel = supabase
      .channel('quiz_results_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'quiz_results',
        },
        () => {
          loadRankings();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadRankings = async () => {
    try {
      const { data: results, error } = await supabase
        .from('quiz_results')
        .select(`
          *,
          users!quiz_results_user_id_fkey(id, surname, name, patronymic, email, role, created_at)
        `)
        .order('score', { ascending: false })
        .order('duration_seconds', { ascending: true });

      if (error) throw error;

      const uniqueUsers = new Map<string, RankingEntry>();
      results.forEach((r: any, index: number) => {
        if (!uniqueUsers.has(r.user_id)) {
          uniqueUsers.set(r.user_id, {
            ...r,
            user: r.users,
            place: uniqueUsers.size + 1,
          });
        }
      });

      const sortedRankings = Array.from(uniqueUsers.values()).sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.duration_seconds - b.duration_seconds;
      });

      const finalRankings = sortedRankings.map((entry, index) => ({
        ...entry,
        place: index + 1,
      }));

      setRankings(finalRankings);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error loading rankings:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getMedalIcon = (place: number, size: 'sm' | 'md' = 'md') => {
    const sizeClass = size === 'sm' ? 'w-5 h-5' : 'w-6 h-6';
    if (place === 1) return <Medal className={`${sizeClass} text-gold-500`} />;
    if (place === 2) return <Award className={`${sizeClass} text-gray-400`} />;
    if (place === 3) return <Award className={`${sizeClass} text-bronze-500`} />;
    return null;
  };

  const getPlaceStyle = (place: number) => {
    if (place === 1) return 'bg-gradient-to-r from-gold-50 to-gold-100 dark:from-gold-900/30 dark:to-gold-800/20 border-gold-200 dark:border-gold-800';
    if (place === 2) return 'bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700/30 dark:to-gray-600/20 border-gray-200 dark:border-gray-600';
    if (place === 3) return 'bg-gradient-to-r from-bronze-50 to-bronze-100 dark:from-bronze-900/30 dark:to-bronze-800/20 border-bronze-200 dark:border-bronze-800';
    return 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const displayedRankings = showAll ? rankings : rankings.slice(0, 10);

  return (
    <div className="max-w-4xl mx-auto pb-24 md:pb-0">
      <div className="text-center mb-6 md:mb-8">
        <div className="inline-flex items-center justify-center w-12 h-12 md:w-16 md:h-16 bg-gold-100 dark:bg-gold-900/30 rounded-2xl mb-3 md:mb-4">
          <Trophy className="w-6 h-6 md:w-8 md:h-8 text-gold-600 dark:text-gold-400" />
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Рейтинг учасників
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-3 md:mb-4 text-sm md:text-base">
          Найкращі результати вікторини
        </p>
        <div className="flex items-center justify-center gap-2 md:gap-4 text-xs md:text-sm text-gray-500 dark:text-gray-400">
          <span className="hidden sm:inline">
            Останнє оновлення: {lastUpdate.toLocaleTimeString('uk-UA')}
          </span>
          <button
            onClick={loadRankings}
            className="flex items-center gap-1 text-primary-600 dark:text-primary-400 hover:underline"
          >
            <RefreshCw className="w-3.5 h-3.5 md:w-4 md:h-4" />
            <span className="sm:hidden">Оновити</span>
          </button>
        </div>
      </div>

      {rankings.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700 p-8 md:p-12 text-center">
          <Trophy className="w-12 h-12 md:w-16 md:h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h2 className="text-lg md:text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Результатів поки немає
          </h2>
          <p className="text-gray-600 dark:text-gray-400 text-sm md:text-base">
            Станьте першим, хто пройде вікторину!
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 mb-6 md:mb-8">
            {rankings.slice(0, 3).map((entry, index) => (
              <div
                key={entry.id}
                className={`relative rounded-xl md:rounded-2xl p-4 md:p-6 border ${getPlaceStyle(entry.place)} shadow-md animate-slide-up`}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="absolute -top-2 -right-2 md:-top-3 md:-right-3">
                  {entry.place === 1 && (
                    <span className="flex items-center justify-center w-8 h-8 md:w-10 md:h-10 bg-gold-500 text-white text-base md:text-xl rounded-full shadow-lg">
                      1
                    </span>
                  )}
                  {entry.place === 2 && (
                    <span className="flex items-center justify-center w-8 h-8 md:w-10 md:h-10 bg-gray-400 text-white text-base md:text-xl rounded-full shadow-lg">
                      2
                    </span>
                  )}
                  {entry.place === 3 && (
                    <span className="flex items-center justify-center w-8 h-8 md:w-10 md:h-10 bg-bronze-500 text-white text-base md:text-xl rounded-full shadow-lg">
                      3
                    </span>
                  )}
                </div>

                <div className="text-center">
                  <div className="w-12 h-12 md:w-16 md:h-16 bg-white dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-2 md:mb-3 shadow-md">
                    {getMedalIcon(entry.place)}
                  </div>
                  <h3 className="text-base md:text-lg font-semibold text-gray-900 dark:text-white mb-0.5 md:mb-1 truncate px-2">
                    {entry.user.surname} {entry.user.name}
                  </h3>
                  <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 mb-2 md:mb-3 truncate px-4">
                    {entry.user.patronymic}
                  </p>
                  <div className="flex justify-center items-center gap-3 md:gap-4 text-xs md:text-sm">
                    <div>
                      <p className="text-xl md:text-2xl font-bold text-primary-600 dark:text-primary-400">
                        {entry.score}
                      </p>
                      <p className="text-gray-500 dark:text-gray-400 text-xs">балів</p>
                    </div>
                    <div className="w-px h-8 md:h-10 bg-gray-200 dark:bg-gray-600" />
                    <div>
                      <p className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">
                        {formatDuration(entry.duration_seconds)}
                      </p>
                      <p className="text-gray-500 dark:text-gray-400 text-xs">час</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="p-3 md:p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-white text-sm md:text-base">
                Всі учасники
              </h3>
              <span className="text-xs md:text-sm text-gray-500 dark:text-gray-400">
                {rankings.length} учасників
              </span>
            </div>

            <div className="md:hidden divide-y divide-gray-100 dark:divide-gray-700">
              {displayedRankings.map((entry) => (
                <div
                  key={entry.id}
                  className={`p-4 flex items-center gap-3 ${
                    entry.place <= 3 ? getPlaceStyle(entry.place) : ''
                  }`}
                >
                  <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold bg-gray-100 dark:bg-gray-700">
                    {entry.place <= 3 ? (
                      getMedalIcon(entry.place, 'sm')
                    ) : (
                      <span className="text-gray-500 dark:text-gray-400">{entry.place}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white text-sm truncate">
                      {entry.user.surname} {entry.user.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {entry.user.patronymic}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-primary-600 dark:text-primary-400">
                      {entry.score}/{entry.max_score}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center justify-end gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDuration(entry.duration_seconds)}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-100 dark:border-gray-600">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Місце
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Учасник
                    </th>
                    <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Бали
                    </th>
                    <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Час
                    </th>
                    <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      %
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {displayedRankings.map((entry) => (
                    <tr
                      key={entry.id}
                      className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                        entry.place <= 3 ? 'animate-fade-in' : ''
                      }`}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {entry.place <= 3 ? (
                            getMedalIcon(entry.place)
                          ) : (
                            <span className="text-gray-500 dark:text-gray-400 font-medium">
                              {entry.place}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-medium text-gray-900 dark:text-white">
                            {entry.user.surname} {entry.user.name}
                          </span>
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            {entry.user.patronymic}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="font-semibold text-primary-600 dark:text-primary-400">
                          {entry.score}/{entry.max_score}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-1 text-gray-600 dark:text-gray-400">
                          <Clock className="w-4 h-4" />
                          {formatDuration(entry.duration_seconds)}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            entry.percentage >= 80
                              ? 'bg-accent-100 dark:bg-accent-900/30 text-accent-700 dark:text-accent-400'
                              : entry.percentage >= 60
                              ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                          }`}
                        >
                          {entry.percentage.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {rankings.length > 10 && !showAll && (
            <div className="mt-4 text-center md:hidden">
              <button
                onClick={() => setShowAll(true)}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-medium rounded-xl transition-colors text-sm"
              >
                Показати всі ({rankings.length})
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
