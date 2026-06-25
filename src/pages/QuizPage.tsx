import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase, Question, QuizResult, MatchingPair } from '../lib/supabase';
import {
  Clock,
  ChevronRight,
  ChevronLeft,
  AlertTriangle,
  CheckCircle,
  Send,
  HelpCircle,
  Link2,
} from 'lucide-react';

const QUESTION_TIME_LIMIT = 60;

// ─── Matching Question Component ───────────────────────────────────────────────

interface MatchingConn {
  leftIndex: number;
  rightIndex: number; // index in shuffledOrder (display order)
}

interface MatchingQuestionProps {
  pairs: MatchingPair[];
  shuffledOrder: number[]; // shuffledOrder[displayPos] = originalIndex
  connections: MatchingConn[];
  onConnect: (leftIndex: number, rightOriginalIndex: number) => void;
}

function MatchingQuestion({ pairs, shuffledOrder, connections, onConnect }: MatchingQuestionProps) {
  const [selectedLeft, setSelectedLeft] = useState<number | null>(null);
  const leftRefs = useRef<(HTMLDivElement | null)[]>([]);
  const rightRefs = useRef<(HTMLDivElement | null)[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [svgSize, setSvgSize] = useState({ width: 0, height: 0 });

  const updateSvgSize = useCallback(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setSvgSize({ width: rect.width, height: rect.height });
    }
  }, []);

  useEffect(() => {
    updateSvgSize();
    window.addEventListener('resize', updateSvgSize);
    return () => window.removeEventListener('resize', updateSvgSize);
  }, [updateSvgSize]);

  // Get center-right of a left item (relative to container)
  const getLeftAnchor = (i: number): { x: number; y: number } | null => {
    const el = leftRefs.current[i];
    const con = containerRef.current;
    if (!el || !con) return null;
    const elRect = el.getBoundingClientRect();
    const conRect = con.getBoundingClientRect();
    return {
      x: elRect.right - conRect.left,
      y: elRect.top + elRect.height / 2 - conRect.top,
    };
  };

  // Get center-left of a right item (relative to container)
  const getRightAnchor = (displayPos: number): { x: number; y: number } | null => {
    const el = rightRefs.current[displayPos];
    const con = containerRef.current;
    if (!el || !con) return null;
    const elRect = el.getBoundingClientRect();
    const conRect = con.getBoundingClientRect();
    return {
      x: elRect.left - conRect.left,
      y: elRect.top + elRect.height / 2 - conRect.top,
    };
  };

  const COLORS = [
    '#3b82f6', '#8b5cf6', '#ec4899', '#f97316',
    '#10b981', '#06b6d4', '#f59e0b', '#ef4444',
  ];

  const handleLeftClick = (i: number) => {
    if (selectedLeft === i) {
      setSelectedLeft(null);
    } else {
      setSelectedLeft(i);
    }
  };

  const handleRightClick = (displayPos: number) => {
    if (selectedLeft === null) return;
    const originalRightIndex = shuffledOrder[displayPos];
    onConnect(selectedLeft, originalRightIndex);
    setSelectedLeft(null);
  };

  // Find display position for a right item by its original index
  const getDisplayPos = (originalIndex: number) =>
    shuffledOrder.indexOf(originalIndex);

  // Which left item is connected to this right display pos?
  const leftConnectedTo = (displayPos: number) => {
    const origIdx = shuffledOrder[displayPos];
    const conn = connections.find((c) => c.rightIndex === getDisplayPos(origIdx));
    return conn ? conn.leftIndex : null;
  };

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
        Натисніть елемент зліва, потім відповідний елемент справа, щоб з'єднати їх.
      </p>

      <div ref={containerRef} className="relative">
        {/* SVG overlay for curves */}
        <svg
          ref={svgRef}
          className="absolute inset-0 pointer-events-none z-10"
          style={{ width: svgSize.width, height: svgSize.height }}
        >
          <defs>
            {connections.map((conn, idx) => (
              <marker
                key={`arrow-${idx}`}
                id={`arrowhead-${idx}`}
                markerWidth="6"
                markerHeight="4"
                refX="6"
                refY="2"
                orient="auto"
              >
                <polygon
                  points="0 0, 6 2, 0 4"
                  fill={COLORS[conn.leftIndex % COLORS.length]}
                />
              </marker>
            ))}
          </defs>
          {connections.map((conn, idx) => {
            const start = getLeftAnchor(conn.leftIndex);
            const end = getRightAnchor(conn.rightIndex);
            if (!start || !end) return null;
            const color = COLORS[conn.leftIndex % COLORS.length];
            const cx1 = start.x + (end.x - start.x) * 0.45;
            const cy1 = start.y;
            const cx2 = start.x + (end.x - start.x) * 0.55;
            const cy2 = end.y;
            return (
              <path
                key={idx}
                d={`M ${start.x} ${start.y} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${end.x} ${end.y}`}
                stroke={color}
                strokeWidth="2.5"
                fill="none"
                strokeLinecap="round"
                opacity="0.85"
                markerEnd={`url(#arrowhead-${idx})`}
              />
            );
          })}
          {/* Preview curve when left item selected */}
          {selectedLeft !== null && (() => {
            const start = getLeftAnchor(selectedLeft);
            if (!start) return null;
            return (
              <circle
                cx={start.x + 8}
                cy={start.y}
                r={5}
                fill={COLORS[selectedLeft % COLORS.length]}
                opacity="0.6"
              >
                <animate attributeName="r" values="4;8;4" dur="1.2s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.6;0.2;0.6" dur="1.2s" repeatCount="indefinite" />
              </circle>
            );
          })()}
        </svg>

        <div className="grid grid-cols-2 gap-6 md:gap-10">
          {/* Left column */}
          <div className="space-y-3">
            <div className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1 px-3">
              Термін / Поняття
            </div>
            {pairs.map((pair, i) => {
              const conn = connections.find((c) => c.leftIndex === i);
              const color = COLORS[i % COLORS.length];
              const isSelected = selectedLeft === i;
              return (
                <div
                  key={i}
                  ref={(el) => { leftRefs.current[i] = el; }}
                  onClick={() => handleLeftClick(i)}
                  className={`relative cursor-pointer px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all select-none ${
                    isSelected
                      ? 'shadow-md scale-[1.02]'
                      : 'hover:scale-[1.01]'
                  } ${
                    conn
                      ? 'bg-opacity-10 dark:bg-opacity-20'
                      : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600'
                  }`}
                  style={
                    conn || isSelected
                      ? { borderColor: color, backgroundColor: `${color}18` }
                      : {}
                  }
                >
                  <span className="text-gray-900 dark:text-white">{pair.left}</span>
                  {conn && (
                    <span
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Right column */}
          <div className="space-y-3">
            <div className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1 px-3">
              Визначення / Опис
            </div>
            {shuffledOrder.map((originalIdx, displayPos) => {
              const connLeftIdx = leftConnectedTo(displayPos);
              const hasConn = connLeftIdx !== null;
              const color = hasConn !== null && hasConn !== undefined ? COLORS[(connLeftIdx as number) % COLORS.length] : '';
              const isTarget = selectedLeft !== null;
              return (
                <div
                  key={originalIdx}
                  ref={(el) => { rightRefs.current[displayPos] = el; }}
                  onClick={() => handleRightClick(displayPos)}
                  className={`relative cursor-pointer px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all select-none ${
                    isTarget && !hasConn
                      ? 'border-dashed border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/20 animate-pulse'
                      : ''
                  } ${
                    hasConn
                      ? 'bg-opacity-10'
                      : !isTarget
                      ? 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                      : ''
                  }`}
                  style={hasConn ? { borderColor: color, backgroundColor: `${color}18` } : {}}
                >
                  {hasConn && (
                    <span
                      className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                  )}
                  <span className={`text-gray-900 dark:text-white ${hasConn ? 'pl-4' : ''}`}>
                    {pairs[originalIdx].right}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {connections.length > 0 && (
        <div className="mt-3 text-xs text-gray-500 dark:text-gray-400 text-right">
          З'єднано: {connections.length} / {pairs.length}
        </div>
      )}
    </div>
  );
}

// ─── Main QuizPage ─────────────────────────────────────────────────────────────

export function QuizPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number[]>>({});
  // For matching: connections per questionId
  const [matchingConnections, setMatchingConnections] = useState<Record<string, MatchingConn[]>>({});
  // For matching: shuffled order per questionId
  const [matchingShuffled, setMatchingShuffled] = useState<Record<string, number[]>>({});
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [questionTimeLeft, setQuestionTimeLeft] = useState(QUESTION_TIME_LIMIT);
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [existingResult, setExistingResult] = useState<QuizResult | null>(null);
  const [showQuestionNav, setShowQuestionNav] = useState(false);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number>(1);

  useEffect(() => {
    loadQuestions();
  }, []);

  useEffect(() => {
    if (questions.length > 0 && !existingResult) {
      setStartedAt(new Date());
      // Initialize shuffled orders for matching questions
      const shuffled: Record<string, number[]> = {};
      questions.forEach((q) => {
        if (q.question_type === 'matching') {
          const pairs = q.options as MatchingPair[];
          const order = pairs.map((_, i) => i);
          // Fisher-Yates shuffle
          for (let i = order.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [order[i], order[j]] = [order[j], order[i]];
          }
          shuffled[q.id] = order;
        }
      });
      setMatchingShuffled(shuffled);
    }
  }, [questions, existingResult]);

  useEffect(() => {
    if (startedAt && !submitting && !existingResult) {
      const interval = setInterval(() => {
        setTimeElapsed((prev) => prev + 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [startedAt, submitting, existingResult]);

  useEffect(() => {
    if (!startedAt || submitting || existingResult || questions.length === 0) return;
    setQuestionTimeLeft(QUESTION_TIME_LIMIT);
    const interval = setInterval(() => {
      setQuestionTimeLeft((prev) => {
        if (prev <= 1) { clearInterval(interval); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [currentIndex, startedAt, submitting, existingResult, questions.length]);

  useEffect(() => {
    if (questionTimeLeft !== 0 || submitting || existingResult || questions.length === 0) return;
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      handleSubmit(true);
    }
  }, [questionTimeLeft]);

  const loadQuestions = async () => {
    try {
      // Check attempts remaining from DB
      const { data: userData } = await supabase
        .from('users')
        .select('attempts_remaining')
        .eq('id', user!.id)
        .single();

      const remaining = userData?.attempts_remaining ?? 1;
      setAttemptsRemaining(remaining);

      if (remaining <= 0) {
        // Also check existing result for display
        const { data: result } = await supabase
          .from('quiz_results')
          .select('*')
          .eq('user_id', user!.id)
          .order('finished_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (result) setExistingResult(result);
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
    }
  };

  const handleMatchingConnect = (questionId: string, leftIndex: number, rightOriginalIndex: number) => {
    setMatchingConnections((prev) => {
      const current = prev[questionId] || [];
      // Remove any existing connection from this left item OR to this right original index
      const filtered = current.filter(
        (c) => c.leftIndex !== leftIndex
      );
      const shuffled = matchingShuffled[questionId] || [];
      const displayPos = shuffled.indexOf(rightOriginalIndex);
      // Also remove if this right display pos was already connected to something else
      const filtered2 = filtered.filter((c) => c.rightIndex !== displayPos);
      const newConns = [...filtered2, { leftIndex, rightIndex: displayPos }];
      // Update the answers too
      const pairs = questions.find((q) => q.id === questionId)?.options as MatchingPair[];
      if (pairs) {
        // answers[questionId][leftIndex] = rightOriginalIndex
        const ans: number[] = new Array(pairs.length).fill(-1);
        newConns.forEach((c) => {
          ans[c.leftIndex] = shuffled[c.rightIndex];
        });
        setAnswers((prev2) => ({ ...prev2, [questionId]: ans }));
      }
      return { ...prev, [questionId]: newConns };
    });
  };

  const handleSubmit = async (skipConfirm = false) => {
    if (!startedAt) return;

    if (!skipConfirm) {
      const unansweredCount = questions.filter((q) => {
        if (q.question_type === 'matching') {
          const conns = matchingConnections[q.id] || [];
          const pairs = q.options as MatchingPair[];
          return conns.length < pairs.length;
        }
        return !answers[q.id]?.length;
      }).length;
      if (unansweredCount > 0) {
        if (!window.confirm(`У вас є ${unansweredCount} незатверджених питань. Продовжити?`)) return;
      }
    }

    setSubmitting(true);

    try {
      let score = 0;
      const maxScore = questions.reduce((sum, q) => sum + q.points, 0);

      questions.forEach((question) => {
        if (question.question_type === 'matching') {
          const pairs = question.options as MatchingPair[];
          const userAns = answers[question.id] || [];
          let correctCount = 0;
          pairs.forEach((_, i) => {
            if (userAns[i] === i) correctCount++;
          });
          if (correctCount === pairs.length) {
            score += question.points;
          } else if (correctCount > 0) {
            score += Math.round((correctCount / pairs.length) * question.points);
          }
        } else {
          const userAnswer = answers[question.id] || [];
          const correctAnswer = question.correct_answers as number[];
          if (JSON.stringify(userAnswer.sort()) === JSON.stringify([...correctAnswer].sort())) {
            score += question.points;
          }
        }
      });

      const percentage = maxScore > 0 ? (score / maxScore) * 100 : 0;
      const now = new Date();
      const durationSeconds = Math.floor((now.getTime() - startedAt.getTime()) / 1000);

      // Save result
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

      // Decrement attempts_remaining (server-side safety)
      await supabase
        .from('users')
        .update({ attempts_remaining: 0 })
        .eq('id', user!.id);

      navigate('/results');
    } catch (error) {
      console.error('Error submitting quiz:', error);
      alert('Помилка при збереженні результатів');
    } finally {
      setSubmitting(false);
    }
  };

  const getDifficultyColor = (d: string) => {
    if (d === 'easy') return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400';
    if (d === 'medium') return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400';
    return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400';
  };

  const getDifficultyLabel = (d: string) => {
    if (d === 'easy') return 'Легко';
    if (d === 'medium') return 'Середньо';
    return 'Складно';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  // Attempt used up (or existing result in old system)
  if (attemptsRemaining <= 0 || existingResult) {
    return (
      <div className="max-w-2xl mx-auto text-center py-8 md:py-12 px-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 md:p-8 border border-gray-100 dark:border-gray-700">
          <AlertTriangle className="w-12 h-12 md:w-16 md:h-16 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Ви вже використали свою єдину спробу проходження вікторини.
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-3 text-sm">
            Доступно спроб: <span className="font-bold text-red-500">0</span>
          </p>
          <p className="text-gray-500 dark:text-gray-400 mb-6 text-sm md:text-base">
            Повторне проходження вікторини не дозволяється.
          </p>
          {existingResult && (
            <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4 md:p-6 mb-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">Ваш результат</p>
                  <p className="text-xl md:text-2xl font-bold text-primary-600">
                    {existingResult.score}/{existingResult.max_score}
                  </p>
                </div>
                <div>
                  <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">Відсоток</p>
                  <p className="text-xl md:text-2xl font-bold text-primary-600">
                    {existingResult.percentage.toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>
          )}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => navigate('/results')}
              className="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-xl transition-colors"
            >
              Мої результати
            </button>
            <button
              onClick={() => navigate('/ranking')}
              className="px-6 py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-medium rounded-xl transition-colors"
            >
              Переглянути рейтинг
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];
  const progress = ((currentIndex + 1) / questions.length) * 100;
  const answeredCount = questions.filter((q) => {
    if (q.question_type === 'matching') {
      const conns = matchingConnections[q.id] || [];
      const pairs = q.options as MatchingPair[];
      return conns.length === pairs.length;
    }
    return (answers[q.id] || []).length > 0;
  }).length;
  const isTimeWarning = questionTimeLeft <= 10;

  return (
    <div className="max-w-4xl mx-auto pb-4">
      {/* Header bar */}
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
              <span className="text-green-600 dark:text-green-400 font-semibold">{answeredCount}</span>
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

        <div className="mt-3 md:mt-4 flex items-center gap-3">
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono font-bold text-sm md:text-base whitespace-nowrap transition-colors ${
              isTimeWarning
                ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 animate-pulse'
                : 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>0:{questionTimeLeft.toString().padStart(2, '0')}</span>
          </div>
          <div className="flex-1 h-2 md:h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-1000 ease-linear ${isTimeWarning ? 'bg-red-500' : 'bg-green-500'}`}
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
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700 p-4 md:p-6 lg:p-8">
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
            {currentQuestion.question_type === 'single' && 'Одна правильна відповідь'}
            {currentQuestion.question_type === 'multiple' && 'Декілька правильних відповідей'}
            {currentQuestion.question_type === 'matching' && 'Встановіть відповідність'}
            {currentQuestion.question_type === 'true_false' && 'Вірно / Невірно'}
            {currentQuestion.question_type === 'practical' && 'Практичний кейс'}
          </div>

          <h2 className="text-base md:text-lg lg:text-xl font-semibold text-gray-900 dark:text-white mb-4 md:mb-6 leading-relaxed">
            {currentQuestion.question}
          </h2>

          {currentQuestion.question_type === 'matching' ? (
            <MatchingQuestion
              pairs={currentQuestion.options as MatchingPair[]}
              shuffledOrder={matchingShuffled[currentQuestion.id] || (currentQuestion.options as MatchingPair[]).map((_, i) => i)}
              connections={matchingConnections[currentQuestion.id] || []}
              onConnect={(leftIndex, rightOriginalIndex) =>
                handleMatchingConnect(currentQuestion.id, leftIndex, rightOriginalIndex)
              }
            />
          ) : (
            <div className="space-y-2 md:space-y-3">
              {(currentQuestion.options as string[]).map((option, index) => {
                const isSelected = (answers[currentQuestion.id] || []).includes(index);
                return (
                  <button
                    key={index}
                    onClick={() => handleSelect(index)}
                    className={`w-full flex items-center gap-3 md:gap-4 p-3 md:p-4 rounded-xl border-2 transition-all touch-manipulation ${
                      isSelected
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30'
                        : 'border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-700'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 md:w-6 md:h-6 rounded-${currentQuestion.question_type === 'multiple' ? 'md' : 'full'} border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                        isSelected ? 'border-primary-500 bg-primary-500' : 'border-gray-300 dark:border-gray-600'
                      }`}
                    >
                      {isSelected && <CheckCircle className="w-3 h-3 md:w-4 md:h-4 text-white" />}
                    </div>
                    <span className="text-sm md:text-base text-gray-900 dark:text-white text-left">{option}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
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
            className="flex items-center gap-1 md:gap-2 px-6 md:px-8 py-2.5 md:py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white font-medium rounded-xl transition-colors shadow-lg text-sm md:text-base"
          >
            {submitting ? (
              <div className="w-4 h-4 md:w-5 md:h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Send className="w-4 h-4 md:w-5 md:h-5" />
                Завершити
              </>
            )}
          </button>
        ) : (
          <button
            onClick={() => setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1))}
            className="flex items-center gap-1 md:gap-2 px-4 md:px-6 py-2.5 md:py-3 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-xl transition-colors text-sm md:text-base"
          >
            Далі
            <ChevronRight className="w-4 h-4 md:w-5 md:h-5" />
          </button>
        )}
      </div>

      {/* Desktop question nav */}
      <div className="hidden md:flex mt-6 flex-wrap gap-2 justify-center">
        {questions.map((q, index) => {
          const isAnswered =
            q.question_type === 'matching'
              ? (matchingConnections[q.id] || []).length === (q.options as MatchingPair[]).length
              : (answers[q.id] || []).length > 0;
          const isCurrent = index === currentIndex;
          return (
            <button
              key={q.id}
              onClick={() => setCurrentIndex(index)}
              className={`w-10 h-10 rounded-lg font-medium text-sm transition-all ${
                isCurrent
                  ? 'bg-primary-600 text-white scale-110 shadow-md'
                  : isAnswered
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {index + 1}
            </button>
          );
        })}
      </div>

      {/* Mobile question nav modal */}
      {showQuestionNav && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowQuestionNav(false)} />
          <div className="absolute bottom-0 left-0 right-0 bg-white dark:bg-gray-800 rounded-t-3xl shadow-xl max-h-[70vh] overflow-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-800 p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-white">Навігація по питаннях</h3>
              <button onClick={() => setShowQuestionNav(false)} className="p-2 rounded-lg text-gray-500 dark:text-gray-400">
                <ChevronRight className="w-5 h-5 rotate-45" />
              </button>
            </div>
            <div className="p-4 grid grid-cols-5 sm:grid-cols-7 gap-3">
              {questions.map((q, index) => {
                const isAnswered =
                  q.question_type === 'matching'
                    ? (matchingConnections[q.id] || []).length === (q.options as MatchingPair[]).length
                    : (answers[q.id] || []).length > 0;
                const isCurrent = index === currentIndex;
                return (
                  <button
                    key={q.id}
                    onClick={() => { setCurrentIndex(index); setShowQuestionNav(false); }}
                    className={`aspect-square rounded-xl font-medium text-base transition-all ${
                      isCurrent
                        ? 'bg-primary-600 text-white ring-2 ring-primary-300 ring-offset-2'
                        : isAnswered
                        ? 'bg-green-500 text-white'
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
