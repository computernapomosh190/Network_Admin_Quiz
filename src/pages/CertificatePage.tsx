import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, Certificate, QuizResult } from '../lib/supabase';
import { createSimpleCertificate } from '../lib/certificate';
import {
  Award,
  Medal,
  Download,
  FileText,
  Trophy,
  AlertCircle,
} from 'lucide-react';

interface CertificateWithDetails extends Certificate {
  quiz_result?: QuizResult;
}

export function CertificatePage() {
  const { user } = useAuth();
  const [certificates, setCertificates] = useState<CertificateWithDetails[]>([]);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [place, setPlace] = useState<number | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: results } = await supabase
        .from('quiz_results')
        .select('*')
        .eq('user_id', user!.id)
        .order('finished_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (results) {
        setResult(results);

        const { data: allResults } = await supabase
          .from('quiz_results')
          .select('id, score, duration_seconds, user_id');

        if (allResults) {
          const sortedResults = allResults.sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            return a.duration_seconds - b.duration_seconds;
          });
          const userPlace = sortedResults.findIndex((r) => r.user_id === user!.id) + 1;
          setPlace(userPlace);
        }
      }

      const { data: certs } = await supabase
        .from('certificates')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });

      if (certs) {
        setCertificates(certs);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateAndDownloadCertificate = () => {
    if (!result || !place || place > 3 || !user) return;

    const pdf = createSimpleCertificate(user, result, place);
    const fileName = `certificate_${place}_place_${user.surname}.pdf`;
    pdf.save(fileName);
  };

  const getMedalColor = (place: number) => {
    if (place === 1) return 'text-gold-500';
    if (place === 2) return 'text-gray-400';
    if (place === 3) return 'text-bronze-500';
    return 'text-gray-300';
  };

  const getPlaceTitle = (place: number) => {
    if (place === 1) return 'Переможець';
    if (place === 2) return 'Друге місце';
    if (place === 3) return 'Третє місце';
    return `${place} місце`;
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
          <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Результатів не знайдено
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Спочатку пройдіть вікторину, щоб отримати сертифікат.
          </p>
        </div>
      </div>
    );
  }

  const isTopThree = place && place <= 3;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gold-100 dark:bg-gold-900/30 rounded-2xl mb-4">
          <Award className="w-8 h-8 text-gold-600 dark:text-gold-400" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Сертифікати
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Ваші досягнення у вікторині
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700 p-8 mb-8">
        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className="flex-shrink-0">
            {isTopThree ? (
              <div className="w-24 h-24 bg-gradient-to-br from-gold-100 to-gold-200 dark:from-gold-900/30 dark:to-gold-800/20 rounded-2xl flex items-center justify-center">
                {place === 1 ? (
                  <Medal className={`w-12 h-12 ${getMedalColor(place)}`} />
                ) : (
                  <Trophy className={`w-12 h-12 ${getMedalColor(place)}`} />
                )}
              </div>
            ) : (
              <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-2xl flex items-center justify-center">
                <span className="text-3xl font-bold text-gray-400">{place}</span>
              </div>
            )}
          </div>

          <div className="flex-1 text-center md:text-left">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              {isTopThree ? getPlaceTitle(place!) : `${place} місце у рейтингу`}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {result.score} балів з {result.max_score} можливих ({result.percentage.toFixed(1)}%)
            </p>

            {isTopThree ? (
              <button
                onClick={generateAndDownloadCertificate}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gold-500 hover:bg-gold-600 text-white font-medium rounded-xl transition-colors shadow-lg shadow-gold-500/25"
              >
                <Download className="w-5 h-5" />
                Завантажити сертифікат
              </button>
            ) : (
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-xl text-gray-500 dark:text-gray-400">
                <AlertCircle className="w-5 h-5" />
                Сертифікат доступний для ТОП-3
              </div>
            )}
          </div>

          <div className="flex-shrink-0 text-center">
            <div className="text-4xl font-bold text-primary-600 dark:text-primary-400 mb-1">
              {result.score}/{result.max_score}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              балів
            </div>
          </div>
        </div>
      </div>

      {certificates.length > 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="p-4 border-b border-gray-100 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Ваші офіційні сертифікати
            </h3>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {certificates.map((cert) => (
              <div
                key={cert.id}
                className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      cert.place === 1
                        ? 'bg-gold-100 dark:bg-gold-900/30'
                        : cert.place === 2
                        ? 'bg-gray-100 dark:bg-gray-700'
                        : 'bg-bronze-100 dark:bg-bronze-900/30'
                    }`}
                  >
                    {cert.place === 1 ? (
                      <Medal
                        className={`w-6 h-6 ${getMedalColor(cert.place)}`}
                      />
                    ) : (
                      <Trophy
                        className={`w-6 h-6 ${getMedalColor(cert.place)}`}
                      />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {getPlaceTitle(cert.place)}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {cert.certificate_number}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {new Date(cert.created_at).toLocaleDateString('uk-UA')}
                  </p>
                  <button className="text-sm text-primary-600 dark:text-primary-400 hover:underline">
                    Перевірити
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : isTopThree ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700 p-8 text-center">
          <Award className="w-16 h-16 text-gold-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Вітаємо з призовим місцем!
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Завантажте ваш сертифікат, натиснувши кнопку вище.
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700 p-8 text-center">
          <Trophy className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Сертифікати для ТОП-3
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Офіційні сертифікати видаються учасникам, що зайняли перші три місця.
          </p>
        </div>
      )}
    </div>
  );
}
