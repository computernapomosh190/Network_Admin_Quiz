import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase, Question, QuizResult } from '../lib/supabase';
import {
  Clock,
  ChevronRight,
  ChevronLeft,
  AlertTriangle,
  CheckCircle,
  Send,
  HelpCircle,
} from 'lucide-react';

// Ліміт часу на кожне питання (у секундах)
const QUESTION_TIME_LIMIT = 60;

export function QuizPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number[]>>({});
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [questionTimeLeft, setQuestionTimeLeft] = useState(QUESTION_TIME_LIMIT);
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [existingResult, setExistingResult] = useState<QuizResult | null>(null);
  const [showQuestionNav, setShowQuestionNav] = useState(false);

  useEffect(() => {
    loadQuestions();
  }, []);

  useEffect(() => {
    if (questions.length > 0 && !existingResult) {
      setStartedAt(new Date());
    }
  }, [questions, existingResult]);

  // Загальний таймер вікторини (рахує вгору)
  useEffect(() => {
    if (startedAt && !submitting && !existingResult) {
      const interval = setInterval(() => {
        setTimeElapsed((prev) => prev + 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [startedAt, submitting, existingResult]);

  // Таймер на кожне питання: скидається на 60с при зміні питання та рахує вниз
  useEffect(() => {
    if (!startedAt || submitting || existingResult || questions.length === 0) {
      return;
    }

    setQuestionTimeLeft(QUESTION_TIME_LIMIT);

    const interval = setInterval(() => {
      setQuestionTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [currentIndex, startedAt, submitting, existingResult, questions.length]);

  // Коли час на питання вичерпано — автоперехід (відповідь не зараховується)
  useEffect(() => {
    if (questionTimeLeft !== 0 || submitting || existingResult || questions.length === 0) {
      return;
    }

    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      handleSubmit(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionTimeLeft]);

  const loadQuestions = async () => {
    try {
      const { data: result } = await supabase
        .from('quiz_results')
        .select('*')
        .eq('user_id', user!.id)
        .order('finished_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (result) {
        setExistingResult(result);
        setLoading(false);
        return;
      }

      const { data: questionsData, error } = await supabase
        .from('questions')
        .select('*')
        .order('category', { ascending: true });

      if (error) throw error;
      setQuestions(questionsData || []);
    } catch (error) {
      console.error('Error loading questions:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSelect = (optionIndex: number) => {
    const question = questions[currentIndex];
    if (!question) return;

    if (question.question_type === 'single' || question.question_type === 'true_false') {
      setAnswers((prev) => ({ ...prev, [question.id]: [optionIndex] }));
    } else if (question.question_type === 'multiple') {
      setAnswers((prev) => {
        const current = prev[question.id] || [];
        if (current.includes(optionIndex)) {
          return { ...prev, [question.id]: current.filter((i) => i !== optionIndex) };
        }
        return { ...prev, [question.id]: [...current, optionIndex].sort() };
      });
    } else if (question.question_type === 'matching') {
      setAnswers((prev) => ({ ...prev, [question.id]: [optionIndex] }));
    }
  };

  const handleSubmit = async (skipConfirm = false) => {
    if (!startedAt) return;

    if (!skipConfirm) {
      const unansweredCount = questions.filter((q) => !answers[q.id]?.length).length;
      if (unansweredCount > 0) {
        if (!window.confirm(`У вас є ${unansweredCount} незатверджених питань. Продовжити?`)) {
          return;
        }
      }
    }

    setSubmitting(true);

    try {
      let score = 0;
      const maxScore = questions.reduce((sum, q) => sum + q.points, 0);

      questions.forEach((question) => {
        const userAnswer = answers[question.id] || [];
        const correctAnswer = question.correct_answers;

        if (question.question_type === 'matching') {
          if (userAnswer[0] === 1) score += question.points;
        } else {
          if (JSON.stringify(userAnswer.sort()) === JSON.stringify(correctAnswer.sort())) {
            score += question.points;
          }
        }
      });

      const percentage = (score / maxScore) * 100;
      const now = new Date();
      const durationSeconds = Math.floor((now.getTime() - startedAt.getTime()) / 1000);

      const { error } = await supabase.from('quiz_results').insert({
        user_id: user!.id,
        score,
        max_score: maxScore,
        percentage,
        duration_seconds: durationSeconds,
        started_at: startedAt.toISOString(),
        finished_at: now.toISOString(),
        answers,
      });

      if (error) throw error;

      navigate('/results');
    } catch (error) {
      console.error('Error submitting quiz:', error);
      alert('Помилка при збереженні результатів');
    } finally {
      setSubmitting(false);
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy':
        return 'bg-accent-100 dark:bg-accent-900/30 text-accent-700 dark:text-accent-400';
      case 'medium':
        return 'bg-gold-100 dark:bg-gold-900/30 text-gold-700 dark:text-gold-400';
      case 'hard':
        return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400';
      default:
        return '';
    }
  };

  const getDifficultyLabel = (difficulty: string) => {
    switch (difficulty) {
      case 'easy':
        return 'Легко';
      case 'medium':
        return 'Середньо';
      case 'hard':
        return 'Складно';
      default:
        return difficulty;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (existingResult) {
    return (
      <div className="max-w-2xl mx-auto text-center py-8 md:py-12 px-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 md:p-8 border border-gray-100 dark:border-gray-700">
          <AlertTriangle className="w-12 h-12 md:w-16 md:h-16 text-gold-500 mx-auto mb-4" />
          <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Ви вже пройшли вікторину
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6 text-sm md:text-base">
            Повторне проходження вікторини не дозволяється.
          </p>
          <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4 md:p-6 mb-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">Ваш результат</p>
                <p className="text-xl md:text-2xl font-bold text-primary-600">{existingResult.score}/{existingResult.max_score}</p>
              </div>
              <div>
                <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">Відсоток</p>
                <p className="text-xl md:text-2xl font-bold text-primary-600">{existingResult.percentage.toFixed(1)}%</p>
              </div>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => navigate('/ranking')}
              className="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-xl transition-colors"
            >
              Переглянути рейтинг
            </button>
            <button
              onClick={() => navigate('/certificate')}
              className="px-6 py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-medium rounded-xl transition-colors"
            >
              Мої сертифікати
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];
  const progress = ((currentIndex + 1) / questions.length) * 100;
  const answeredCount = Object.keys(answers).filter((k) => answers[k]?.length > 0).length;
  const isTimeWarning = questionTimeLeft <= 10;

  return (
    <div className="max-w-4xl mx-auto pb-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700 mb-4 md:mb-6 p-3 md:p-6 sticky top-14 md:top-16 z-30">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 md:gap-4">
            <div className="flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-1.5 md:py-2 bg-primary-50 dark:bg-primary-900/30 rounded-xl">
              <Clock className="w-4 h-4 md:w-5 md:h-5 text-primary-600 dark:text-primary-400" />
              <span className="text-lg md:text-xl font-mono font-semibold text-primary-600 dark:text-primary-400">
                {formatTime(timeElapsed)}
              </span>
            </div>
            <div className="text-xs md:text-sm text-gray-500 dark:text-gray-400">
              <span className="md:hidden">{currentIndex + 1}/{questions.length}</span>
              <span className="hidden md:inline">Питання {currentIndex + 1} з {questions.length}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            <div className="text-xs md:text-sm text-gray-500 dark:text-gray-400">
              <span className="text-accent-600 dark:text-accent-400 font-semibold">{answeredCount}</span>
              <span className="hidden sm:inline">/{questions.length} відповідей</span>
            </div>
            <button
              onClick={() => setShowQuestionNav(true)}
              className="md:hidden p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
            >
              <HelpCircle className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Таймер на поточне питання */}
        <div className="mt-3 md:mt-4 flex items-center gap-3">
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono font-bold text-sm md:text-base whitespace-nowrap transition-colors ${
              isTimeWarning
                ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 animate-pulse'
                : 'bg-accent-50 dark:bg-accent-900/30 text-accent-600 dark:text-accent-400'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>0:{questionTimeLeft.toString().padStart(2, '0')}</span>
          </div>
          <div className="flex-1 h-2 md:h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-1000 ease-linear ${
                isTimeWarning ? 'bg-red-500' : 'bg-accent-500'
              }`}
              style={{ width: `${(questionTimeLeft / QUESTION_TIME_LIMIT) * 100}%` }}
            />
          </div>
        </div>

        <div className="mt-3 md:mt-4 h-1.5 md:h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary-500 to-primary-600 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {currentQuestion && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700 p-4 md:p-6 lg:p-8 animate-fade-in">
          <div className="flex flex-wrap items-center gap-2 mb-4 md:mb-6">
            <span className={`px-2.5 md:px-3 py-0.5 md:py-1 rounded-lg text-xs font-medium ${getDifficultyColor(currentQuestion.difficulty)}`}>
              {getDifficultyLabel(currentQuestion.difficulty)}
            </span>
            <span className="px-2.5 md:px-3 py-0.5 md:py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-lg text-xs font-medium">
              {currentQuestion.category}
            </span>
            <span className="px-2.5 md:px-3 py-0.5 md:py-1 bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded-lg text-xs font-medium">
              {currentQuestion.points} бал(ів)
            </span>
          </div>

          <div className="mb-3 md:mb-4 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            {currentQuestion.question_type === 'single' && 'Один правильна відповідь'}
            {currentQuestion.question_type === 'multiple' && 'Декілька правильних відповідей'}
            {currentQuestion.question_type === 'matching' && 'Встановіть відповідність'}
            {currentQuestion.question_type === 'true_false' && 'Вірно / Невірно'}
            {currentQuestion.question_type === 'practical' && 'Практичний кейс'}
          </div>

          <h2 className="text-base md:text-lg lg:text-xl font-semibold text-gray-900 dark:text-white mb-4 md:mb-6 leading-relaxed">
            {currentQuestion.question}
          </h2>

          <div className="space-y-2 md:space-y-3">
            {currentQuestion.question_type === 'matching' ? (
              currentQuestion.options.map((option, index) => (
                <button
                  key={index}
                  onClick={() => handleSelect(index)}
                  className={`w-full text-left p-3 md:p-4 rounded-xl border-2 transition-all touch-manipulation ${
                    answers[currentQuestion.id]?.includes(index)
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30'
                      : 'border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-700 active:border-primary-500'
                  }`}
                >
                  <pre className="whitespace-pre-wrap text-xs md:text-sm font-mono text-gray-900 dark:text-white">
                    {option}
                  </pre>
                </button>
              ))
            ) : (
              currentQuestion.options.map((option, index) => {
                const isSelected = answers[currentQuestion.id]?.includes(index);
                return (
                  <button
                    key={index}
                    onClick={() => handleSelect(index)}
                    className={`w-full flex items-center gap-3 md:gap-4 p-3 md:p-4 rounded-xl border-2 transition-all touch-manipulation ${
                      isSelected
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30'
                        : 'border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-700 active:border-primary-500'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 md:w-6 md:h-6 rounded-${
                        currentQuestion.question_type === 'multiple' ? 'md' : 'full'
                      } border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                        isSelected
                          ? 'border-primary-500 bg-primary-500'
                          : 'border-gray-300 dark:border-gray-600'
                      }`}
                    >
                      {isSelected && (
                        <CheckCircle className="w-3 h-3 md:w-4 md:h-4 text-white" />
                      )}
                    </div>
                    <span className="text-sm md:text-base text-gray-900 dark:text-white text-left">
                      {option}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      <div className="mt-4 md:mt-6 flex items-center justify-between gap-2 md:gap-4 px-2 md:px-0">
        <button
          onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
          disabled={currentIndex === 0}
          className="flex items-center gap-1 md:gap-2 px-4 md:px-6 py-2.5 md:py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-gray-900 dark:text-white font-medium rounded-xl transition-colors text-sm md:text-base"
        >
          <ChevronLeft className="w-4 h-4 md:w-5 md:h-5" />
          <span className="hidden sm:inline">Назад</span>
        </button>

        {currentIndex === questions.length - 1 ? (
          <button
            onClick={() => handleSubmit()}
            disabled={submitting}
            className="flex items-center gap-1 md:gap-2 px-6 md:px-8 py-2.5 md:py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white font-medium rounded-xl transition-colors shadow-lg shadow-primary-500/25 text-sm md:text-base"
          >
            {submitting ? (
              <div className="w-4 h-4 md:w-5 md:h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Send className="w-4 h-4 md:w-5 md:h-5" />
                <span className="hidden sm:inline">Завершити</span>
                <span className="sm:hidden">Завершити</span>
              </>
            )}
          </button>
        ) : (
          <button
            onClick={() => setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1))}
            className="flex items-center gap-1 md:gap-2 px-4 md:px-6 py-2.5 md:py-3 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-xl transition-colors text-sm md:text-base"
          >
            <span className="sm:hidden">Далі</span>
            <span className="hidden sm:inline">Далі</span>
            <ChevronRight className="w-4 h-4 md:w-5 md:h-5" />
          </button>
        )}
      </div>

      <div className="hidden md:flex mt-6 flex-wrap gap-2 justify-center">
        {questions.map((q, index) => {
          const isAnswered = answers[q.id]?.length > 0;
          const isCurrent = index === currentIndex;
          return (
            <button
              key={q.id}
              onClick={() => setCurrentIndex(index)}
              className={`w-10 h-10 rounded-lg font-medium text-sm transition-all ${
                isCurrent
                  ? 'bg-primary-600 text-white scale-110 shadow-md'
                  : isAnswered
                  ? 'bg-accent-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {index + 1}
            </button>
          );
        })}
      </div>

      {showQuestionNav && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowQuestionNav(false)}
          />
                    <div className="absolute bottom-0 left-0 right-0 bg-white dark:bg-gray-800 rounded-t-3xl shadow-xl max-h-[70vh] overflow-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-800 p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-white">
                Навігація по питаннях
              </h3>
              <button
                onClick={() => setShowQuestionNav(false)}
                className="p-2 rounded-lg text-gray-500 dark:text-gray-400"
              >
                <ChevronRight className="w-5 h-5 rotate-45" />
              </button>
            </div>
            <div className="p-4 grid grid-cols-5 sm:grid-cols-7 gap-3">
              {questions.map((q, index) => {
                const isAnswered = answers[q.id]?.length > 0;
                const isCurrent = index === currentIndex;
                return (
                  <button
                    key={q.id}
                    onClick={() => {
                      setCurrentIndex(index);
                      setShowQuestionNav(false);
                    }}
                    className={`aspect-square rounded-xl font-medium text-base transition-all ${
                      isCurrent
                        ? 'bg-primary-600 text-white ring-2 ring-primary-300 ring-offset-2'
                        : isAnswered
                        ? 'bg-accent-500 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    {index + 1}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
