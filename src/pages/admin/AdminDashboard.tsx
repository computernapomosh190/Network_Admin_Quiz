import React, { useState, useEffect } from 'react';
import { supabase, User, QuizResult, Question, MatchingPair } from '../../lib/supabase';
import {
  Users,
  Trophy,
  BarChart3,
  TrendingUp,
  Search,
  Trash2,
  Edit3,
  Plus,
  X,
  FileSpreadsheet,
  FileText,
  ArrowUp,
  ArrowDown,
  Eye,
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

interface Stats {
  totalParticipants: number;
  totalAttempts: number;
  averageScore: number;
  bestScore: number;
}

interface ResultWithUser extends QuizResult {
  users: User;
}

interface UserWithResult extends User {
  result?: ResultWithUser;
  place?: number;
}

type ActiveTab = 'results' | 'questions' | 'participants';

// ─── New Question defaults ────────────────────────────────────────────────────

const defaultQuestion = () => ({
  category: 'TCP/IP',
  difficulty: 'medium' as 'easy' | 'medium' | 'hard',
  question: '',
  question_type: 'single' as 'single' | 'multiple' | 'matching' | 'true_false' | 'practical',
  options: ['', '', '', ''],
  correct_answers: [] as number[],
  matchingPairs: [
    { left: '', right: '' },
    { left: '', right: '' },
  ] as MatchingPair[],
  points: 1,
});

const categories = [
  'TCP/IP', 'OSI', 'DHCP', 'DNS', 'VLAN', 'STP', 'OSPF', 'BGP',
  'NAT', 'VPN', 'IPv6', 'Linux Networking', 'Network Security', 'Wireshark', 'Zabbix', 'Troubleshooting',
];

// ─── Matching Preview ─────────────────────────────────────────────────────────

function MatchingPreview({ pairs }: { pairs: MatchingPair[] }) {
  const valid = pairs.filter((p) => p.left.trim() || p.right.trim());
  if (!valid.length) return null;
  return (
    <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-600">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Попередній перегляд</p>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <p className="text-xs text-gray-400 mb-1">Ліва колонка</p>
          {valid.map((p, i) => (
            <div key={i} className="px-3 py-2 bg-white dark:bg-gray-700 rounded-lg border border-blue-200 dark:border-blue-700 text-sm text-gray-800 dark:text-gray-200">
              {p.left || '—'}
            </div>
          ))}
        </div>
        <div className="space-y-2">
          <p className="text-xs text-gray-400 mb-1">Права колонка</p>
          {valid.map((p, i) => (
            <div key={i} className="px-3 py-2 bg-white dark:bg-gray-700 rounded-lg border border-green-200 dark:border-green-700 text-sm text-gray-800 dark:text-gray-200">
              {p.right || '—'}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({ totalParticipants: 0, totalAttempts: 0, averageScore: 0, bestScore: 0 });
  const [results, setResults] = useState<ResultWithUser[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [allUsers, setAllUsers] = useState<UserWithResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [activeTab, setActiveTab] = useState<ActiveTab>('results');
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [newQuestion, setNewQuestion] = useState(defaultQuestion());
  const [showPreview, setShowPreview] = useState(true);
  // Participant view modal
  const [viewingUser, setViewingUser] = useState<UserWithResult | null>(null);
  const [editingUser, setEditingUser] = useState<UserWithResult | null>(null);
  const [editUserData, setEditUserData] = useState({ surname: '', name: '', patronymic: '', email: '' });
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<UserWithResult | null>(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const { data: usersData } = await supabase.from('users').select('*').neq('role', 'admin');
      const { data: resultsData } = await supabase.from('quiz_results').select('*');
      const { data: fullResults } = await supabase
        .from('quiz_results')
        .select('*, users!quiz_results_user_id_fkey(id, surname, name, patronymic, email, role, created_at, attempts_remaining)')
        .order('finished_at', { ascending: false });
      const { data: questionsData } = await supabase.from('questions').select('*');

      if (resultsData) {
        const totalParticipants = new Set(resultsData.map((r) => r.user_id)).size;
        const averageScore = resultsData.length
          ? resultsData.reduce((sum, r) => sum + r.score, 0) / resultsData.length
          : 0;
        const bestScore = resultsData.reduce((best, r) => (r.score > best ? r.score : best), 0);
        setStats({ totalParticipants, totalAttempts: resultsData.length, averageScore: Math.round(averageScore * 10) / 10, bestScore });
      }

      if (fullResults) setResults(fullResults as ResultWithUser[]);
      if (questionsData) setQuestions(questionsData);

      // Build participants list with their best result and place
      if (usersData && resultsData) {
        const sortedResults = (resultsData as QuizResult[]).sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          return a.duration_seconds - b.duration_seconds;
        });
        const placeMap = new Map<string, number>();
        sortedResults.forEach((r, idx) => {
          if (!placeMap.has(r.user_id)) placeMap.set(r.user_id, idx + 1);
        });

        const participants: UserWithResult[] = (usersData as User[]).map((u) => {
          const userResult = (fullResults as ResultWithUser[] | null)?.find((r) => r.user_id === u.id);
          return {
            ...u,
            result: userResult,
            place: userResult ? placeMap.get(u.id) : undefined,
          };
        });
        setAllUsers(participants);
      }
    } catch (error) {
      console.error('Error loading admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  // ── Results tab ─────────────────────────────────────────────────────────────

  const filteredResults = results.filter((result) => {
    const user = result.users;
    if (!user) return false;
    const sl = searchQuery.toLowerCase();
    const matchesSearch =
      !searchQuery ||
      user.surname.toLowerCase().includes(sl) ||
      user.name.toLowerCase().includes(sl) ||
      user.email.toLowerCase().includes(sl);
    const matchesDate =
      !dateFilter || new Date(result.finished_at).toLocaleDateString('uk-UA') === dateFilter;
    return matchesSearch && matchesDate;
  });

  const exportToExcel = () => {
    const data = results.map((r) => ({
      ID: r.id,
      Прізвище: r.users?.surname || '',
      Імя: r.users?.name || '',
      Email: r.users?.email || '',
      Бали: r.score,
      Максимум: r.max_score,
      Відсоток: r.percentage.toFixed(2) + '%',
      Час: r.duration_seconds + 'с',
      Дата: new Date(r.finished_at).toLocaleString('uk-UA'),
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Results');
    XLSX.writeFile(wb, 'quiz_results.xlsx');
  };

  const exportToPDF = () => {
    const doc = new jsPDF('l', 'mm', 'a4');
    doc.setFontSize(16);
    doc.text('Результати Network Admin Quiz Championship', 14, 15);
    (doc as any).autoTable({
      startY: 25,
      head: [['Учасник', 'Email', 'Бали', '%', 'Час', 'Дата']],
      body: results.map((r) => [
        `${r.users?.surname} ${r.users?.name}`,
        r.users?.email || '',
        `${r.score}/${r.max_score}`,
        r.percentage.toFixed(1) + '%',
        `${Math.floor(r.duration_seconds / 60)}:${(r.duration_seconds % 60).toString().padStart(2, '0')}`,
        new Date(r.finished_at).toLocaleDateString('uk-UA'),
      ]),
      styles: { fontSize: 8 },
    });
    doc.save('quiz_results.pdf');
  };

  const handleDeleteResult = async (resultId: string) => {
    if (!window.confirm('Ви впевнені, що хочете видалити цей результат?')) return;
    const { error } = await supabase.from('quiz_results').delete().eq('id', resultId);
    if (!error) { setResults((prev) => prev.filter((r) => r.id !== resultId)); loadData(); }
    else alert('Помилка при видаленні');
  };

  // ── Questions tab ───────────────────────────────────────────────────────────

  const startEditQuestion = (question: Question) => {
    setEditingQuestion(question);
    const isMatching = question.question_type === 'matching';
    setNewQuestion({
      category: question.category,
      difficulty: question.difficulty,
      question: question.question,
      question_type: question.question_type,
      options: isMatching ? ['', '', '', ''] : (question.options as string[]),
      correct_answers: isMatching ? [] : (question.correct_answers as number[]),
      matchingPairs: isMatching
        ? (question.options as MatchingPair[])
        : [{ left: '', right: '' }, { left: '', right: '' }],
      points: question.points,
    });
    setShowQuestionModal(true);
  };

  const handleSaveQuestion = async () => {
    try {
      const isMatching = newQuestion.question_type === 'matching';
      const questionData = {
        category: newQuestion.category,
        difficulty: newQuestion.difficulty,
        question: newQuestion.question,
        question_type: newQuestion.question_type,
        options: isMatching
          ? newQuestion.matchingPairs.filter((p) => p.left.trim() || p.right.trim())
          : newQuestion.options.filter((o) => o !== ''),
        correct_answers: isMatching ? [] : newQuestion.correct_answers,
        points: newQuestion.points,
      };

      if (editingQuestion) {
        const { error } = await supabase.from('questions').update(questionData).eq('id', editingQuestion.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('questions').insert(questionData);
        if (error) throw error;
      }
      setShowQuestionModal(false);
      setEditingQuestion(null);
      setNewQuestion(defaultQuestion());
      loadData();
    } catch (error: any) {
      alert('Помилка: ' + (error?.message || String(error)));
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    if (!window.confirm('Видалити це питання?')) return;
    const { error } = await supabase.from('questions').delete().eq('id', questionId);
    if (!error) setQuestions((prev) => prev.filter((q) => q.id !== questionId));
    else alert('Помилка при видаленні');
  };

  // ── Matching pairs management ────────────────────────────────────────────────

  const addMatchingPair = () => {
    setNewQuestion((prev) => ({ ...prev, matchingPairs: [...prev.matchingPairs, { left: '', right: '' }] }));
  };

  const removeMatchingPair = (idx: number) => {
    setNewQuestion((prev) => ({ ...prev, matchingPairs: prev.matchingPairs.filter((_, i) => i !== idx) }));
  };

  const updateMatchingPair = (idx: number, side: 'left' | 'right', value: string) => {
    setNewQuestion((prev) => {
      const pairs = [...prev.matchingPairs];
      pairs[idx] = { ...pairs[idx], [side]: value };
      return { ...prev, matchingPairs: pairs };
    });
  };

  const moveRightItem = (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= newQuestion.matchingPairs.length) return;
    setNewQuestion((prev) => {
      const pairs = [...prev.matchingPairs];
      // Only move the right column value, keep left in place
      const rightValues = pairs.map((p) => p.right);
      [rightValues[idx], rightValues[newIdx]] = [rightValues[newIdx], rightValues[idx]];
      return {
        ...prev,
        matchingPairs: pairs.map((p, i) => ({ ...p, right: rightValues[i] })),
      };
    });
  };

  // ── Participants tab ─────────────────────────────────────────────────────────

  const filteredUsers = allUsers.filter((u) => {
    const sl = searchQuery.toLowerCase();
    return (
      !searchQuery ||
      u.surname.toLowerCase().includes(sl) ||
      u.name.toLowerCase().includes(sl) ||
      u.email.toLowerCase().includes(sl)
    );
  });

  const handleDeleteUser = async (userId: string) => {
    await supabase.from('quiz_results').delete().eq('user_id', userId);
    const { error } = await supabase.from('users').delete().eq('id', userId);
    if (!error) {
      setConfirmDeleteUser(null);
      loadData();
    } else {
      alert('Помилка при видаленні учасника');
    }
  };

  const handleResetAttempt = async (userId: string, userName: string) => {
    if (!window.confirm(`Скинути спробу для ${userName}? Учасник зможе пройти вікторину знову.`)) return;
    const { error } = await supabase
      .from('users')
      .update({ attempts_remaining: 1 })
      .eq('id', userId);
    if (!error) {
      loadData();
    } else {
      alert('Помилка при скиданні спроби');
    }
  };

  const handleSaveUser = async () => {
    if (!editingUser) return;
    const { error } = await supabase
      .from('users')
      .update({
        surname: editUserData.surname,
        name: editUserData.name,
        patronymic: editUserData.patronymic,
        email: editUserData.email,
      })
      .eq('id', editingUser.id);
    if (!error) {
      setEditingUser(null);
      loadData();
    } else {
      alert('Помилка при збереженні');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Адміністративна панель</h1>
        <p className="text-gray-600 dark:text-gray-400">Керування вікториною та результатами</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[
          { label: 'Учасників', value: stats.totalParticipants, icon: Users, color: 'blue' },
          { label: 'Пройдень', value: stats.totalAttempts, icon: BarChart3, color: 'purple' },
          { label: 'Середній бал', value: stats.averageScore, icon: TrendingUp, color: 'green' },
          { label: 'Найкращий', value: stats.bestScore, icon: Trophy, color: 'yellow' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700 p-6">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center bg-${color}-100 dark:bg-${color}-900/30`}>
                <Icon className={`w-6 h-6 text-${color}-600 dark:text-${color}-400`} />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700 mb-8">
        <div className="flex border-b border-gray-100 dark:border-gray-700">
          {(['results', 'questions', 'participants'] as ActiveTab[]).map((tab) => {
            const labels: Record<ActiveTab, string> = { results: 'Результати', questions: 'Питання', participants: 'Учасники' };
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 px-6 py-4 font-medium transition-colors ${
                  activeTab === tab
                    ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600 dark:border-primary-400'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                {labels[tab]}
              </button>
            );
          })}
        </div>

        {/* ── Results ── */}
        {activeTab === 'results' && (
          <div className="p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
              <div className="flex flex-col sm:flex-row gap-4 w-full">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Пошук за ПІБ або email..."
                    className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg"
                  />
                </div>
                <input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg"
                />
              </div>
              <div className="flex items-center gap-2">
                <button onClick={exportToExcel} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors">
                  <FileSpreadsheet className="w-4 h-4" /> Excel
                </button>
                <button onClick={exportToPDF} className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors">
                  <FileText className="w-4 h-4" /> PDF
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700 border-y border-gray-100 dark:border-gray-600">
                  <tr>
                    {['ID', 'Учасник', 'Email', 'Бали', '%', 'Час', 'Дата', 'Дії'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {filteredResults.map((result) => (
                    <tr key={result.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 font-mono">{result.id.slice(0, 8)}…</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900 dark:text-white">{result.users?.surname} {result.users?.name}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">{result.users?.patronymic}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{result.users?.email}</td>
                      <td className="px-4 py-3 text-center font-semibold text-primary-600 dark:text-primary-400">{result.score}/{result.max_score}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${result.percentage >= 80 ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}>
                          {result.percentage.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-gray-600 dark:text-gray-400">
                        {Math.floor(result.duration_seconds / 60)}:{(result.duration_seconds % 60).toString().padStart(2, '0')}
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-gray-600 dark:text-gray-400">
                        {new Date(result.finished_at).toLocaleDateString('uk-UA')}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => handleDeleteResult(result.id)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filteredResults.length === 0 && (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">Результатів не знайдено</div>
            )}
          </div>
        )}

        {/* ── Questions ── */}
        {activeTab === 'questions' && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Питань: {questions.length}</h3>
              <button
                onClick={() => { setNewQuestion(defaultQuestion()); setEditingQuestion(null); setShowQuestionModal(true); }}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" /> Додати питання
              </button>
            </div>
            <div className="space-y-4">
              {questions.map((question) => (
                <div key={question.id} className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-100 dark:border-gray-600">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className="px-2 py-1 text-xs font-medium bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded">{question.category}</span>
                        <span className="px-2 py-1 text-xs font-medium bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300 rounded">{question.difficulty}</span>
                        <span className="px-2 py-1 text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 rounded">{question.points} бал(ів)</span>
                        <span className="px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded">{question.question_type}</span>
                      </div>
                      <p className="text-gray-900 dark:text-white">{question.question}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => startEditQuestion(question)} className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors">
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDeleteQuestion(question.id)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Participants ── */}
        {activeTab === 'participants' && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Учасників: {allUsers.length}</h3>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Пошук учасника..."
                  className="pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700 border-y border-gray-100 dark:border-gray-600">
                  <tr>
                    {['ID', 'Прізвище', "Ім'я", 'Email', 'Бали', 'Час', 'Місце', 'Спроби', 'Дата', 'Дії'].map((h) => (
                      <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-3 py-3 text-xs text-gray-400 font-mono">{u.id.slice(0, 8)}…</td>
                      <td className="px-3 py-3 font-medium text-gray-900 dark:text-white text-sm">{u.surname}</td>
                      <td className="px-3 py-3 text-sm text-gray-700 dark:text-gray-300">{u.name}</td>
                      <td className="px-3 py-3 text-sm text-gray-600 dark:text-gray-400">{u.email}</td>
                      <td className="px-3 py-3 text-center text-sm font-semibold text-primary-600 dark:text-primary-400">
                        {u.result ? `${u.result.score}/${u.result.max_score}` : '—'}
                      </td>
                      <td className="px-3 py-3 text-center text-sm text-gray-600 dark:text-gray-400">
                        {u.result
                          ? `${Math.floor(u.result.duration_seconds / 60)}:${(u.result.duration_seconds % 60).toString().padStart(2, '0')}`
                          : '—'}
                      </td>
                      <td className="px-3 py-3 text-center">
                        {u.place ? (
                          <span className={`inline-flex w-8 h-8 items-center justify-center rounded-full text-sm font-bold ${u.place === 1 ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400' : u.place === 2 ? 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300' : u.place === 3 ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}>
                            {u.place}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-3 py-3 text-center text-xs text-gray-500 dark:text-gray-400">
                        {u.result ? new Date(u.result.finished_at).toLocaleDateString('uk-UA') : new Date(u.created_at).toLocaleDateString('uk-UA')}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                          (u.attempts_remaining ?? 1) > 0
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                            : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                        }`}>
                          {u.attempts_remaining ?? 1}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setViewingUser(u)}
                            className="p-1.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                            title="Переглянути"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setEditingUser(u);
                              setEditUserData({ surname: u.surname, name: u.name, patronymic: u.patronymic, email: u.email });
                            }}
                            className="p-1.5 text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                            title="Редагувати"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          {(u.attempts_remaining ?? 1) === 0 && (
                            <button
                              onClick={() => handleResetAttempt(u.id, `${u.surname} ${u.name}`)}
                              className="p-1.5 text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg transition-colors"
                              title="Скинути спробу"
                            >
                              <RefreshCw className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => setConfirmDeleteUser(u)}
                            className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            title="Видалити"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filteredUsers.length === 0 && (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">Учасників не знайдено</div>
            )}
          </div>
        )}
      </div>

      {/* ── Question Modal ── */}
      {showQuestionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                {editingQuestion ? 'Редагувати питання' : 'Нове питання'}
              </h3>
              <button onClick={() => { setShowQuestionModal(false); setEditingQuestion(null); }} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Категорія</label>
                <select
                  value={newQuestion.category}
                  onChange={(e) => setNewQuestion({ ...newQuestion, category: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg"
                >
                  {categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Складність</label>
                  <select
                    value={newQuestion.difficulty}
                    onChange={(e) => setNewQuestion({ ...newQuestion, difficulty: e.target.value as any })}
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg"
                  >
                    <option value="easy">Легка</option>
                    <option value="medium">Середня</option>
                    <option value="hard">Складна</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Тип питання</label>
                  <select
                    value={newQuestion.question_type}
                    onChange={(e) => setNewQuestion({ ...newQuestion, question_type: e.target.value as any })}
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg"
                  >
                    <option value="single">Одна відповідь</option>
                    <option value="multiple">Декілька відповідей</option>
                    <option value="true_false">True/False</option>
                    <option value="matching">Відповідність</option>
                    <option value="practical">Практичне</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Питання</label>
                <textarea
                  value={newQuestion.question}
                  onChange={(e) => setNewQuestion({ ...newQuestion, question: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg"
                  placeholder="Текст питання..."
                />
              </div>

              {/* Matching UI */}
              {newQuestion.question_type === 'matching' ? (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Пари відповідності</label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowPreview(!showPreview)}
                        className="flex items-center gap-1 px-3 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        {showPreview ? 'Сховати' : 'Показати'} перегляд
                      </button>
                      <button
                        onClick={addMatchingPair}
                        className="flex items-center gap-1 px-3 py-1 text-xs bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded-lg hover:bg-primary-200 dark:hover:bg-primary-900/50 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" /> Додати пару
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div className="text-xs font-semibold text-center text-gray-400 uppercase">Ліва колонка (термін)</div>
                    <div className="text-xs font-semibold text-center text-gray-400 uppercase">Права колонка (визначення)</div>
                  </div>

                  <div className="space-y-2">
                    {newQuestion.matchingPairs.map((pair, idx) => (
                      <div key={idx} className="grid grid-cols-2 gap-2 items-center">
                        <input
                          type="text"
                          value={pair.left}
                          onChange={(e) => updateMatchingPair(idx, 'left', e.target.value)}
                          className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-blue-200 dark:border-blue-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-300"
                          placeholder={`Термін ${idx + 1}`}
                        />
                        <div className="flex gap-1 items-center">
                          <input
                            type="text"
                            value={pair.right}
                            onChange={(e) => updateMatchingPair(idx, 'right', e.target.value)}
                            className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-green-200 dark:border-green-700 rounded-lg text-sm focus:ring-2 focus:ring-green-300"
                            placeholder={`Визначення ${idx + 1}`}
                          />
                          <div className="flex flex-col gap-0.5">
                            <button
                              onClick={() => moveRightItem(idx, -1)}
                              disabled={idx === 0}
                              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 disabled:opacity-30 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                              title="Перемістити вгору"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => moveRightItem(idx, 1)}
                              disabled={idx === newQuestion.matchingPairs.length - 1}
                              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 disabled:opacity-30 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                              title="Перемістити вниз"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <button
                            onClick={() => removeMatchingPair(idx)}
                            className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {showPreview && <MatchingPreview pairs={newQuestion.matchingPairs} />}
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Варіанти відповідей
                  </label>
                  {newQuestion.options.map((option, index) => (
                    <div key={index} className="flex items-center gap-2 mb-2">
                      <input
                        type="checkbox"
                        checked={newQuestion.correct_answers.includes(index)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNewQuestion({ ...newQuestion, correct_answers: [...newQuestion.correct_answers, index].sort() });
                          } else {
                            setNewQuestion({ ...newQuestion, correct_answers: newQuestion.correct_answers.filter((i) => i !== index) });
                          }
                        }}
                        className="rounded border-gray-300"
                      />
                      <input
                        type="text"
                        value={option}
                        onChange={(e) => {
                          const opts = [...newQuestion.options];
                          opts[index] = e.target.value;
                          setNewQuestion({ ...newQuestion, options: opts });
                        }}
                        className="flex-1 px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg"
                        placeholder={`Варіант ${index + 1}`}
                      />
                    </div>
                  ))}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Бали</label>
                <input
                  type="number"
                  value={newQuestion.points}
                  onChange={(e) => setNewQuestion({ ...newQuestion, points: parseInt(e.target.value) || 1 })}
                  min={1}
                  max={10}
                  className="w-24 px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-4 p-6 border-t border-gray-100 dark:border-gray-700">
              <button
                onClick={() => { setShowQuestionModal(false); setEditingQuestion(null); }}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Скасувати
              </button>
              <button
                onClick={handleSaveQuestion}
                className="px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors"
              >
                Зберегти
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── View User Modal ── */}
      {viewingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">Учасник</h3>
              <button onClick={() => setViewingUser(null)} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-3">
              {[
                ['ID', viewingUser.id.slice(0, 16) + '…'],
                ['Прізвище', viewingUser.surname],
                ["Ім'я", viewingUser.name],
                ['По батькові', viewingUser.patronymic],
                ['Email', viewingUser.email],
                ['Зареєстрований', new Date(viewingUser.created_at).toLocaleDateString('uk-UA')],
                ['Бали', viewingUser.result ? `${viewingUser.result.score}/${viewingUser.result.max_score}` : 'Не проходив'],
                ['Час проходження', viewingUser.result ? `${Math.floor(viewingUser.result.duration_seconds / 60)} хв ${viewingUser.result.duration_seconds % 60} сек` : '—'],
                ['Місце в рейтингу', viewingUser.place ? `#${viewingUser.place}` : '—'],
                ['Дата проходження', viewingUser.result ? new Date(viewingUser.result.finished_at).toLocaleDateString('uk-UA') : '—'],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between items-center text-sm">
                  <span className="text-gray-500 dark:text-gray-400 font-medium">{label}</span>
                  <span className="text-gray-900 dark:text-white font-semibold">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Edit User Modal ── */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">Редагувати учасника</h3>
              <button onClick={() => setEditingUser(null)} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {[
                { label: 'Прізвище', key: 'surname' as const },
                { label: "Ім'я", key: 'name' as const },
                { label: 'По батькові', key: 'patronymic' as const },
                { label: 'Email', key: 'email' as const },
              ].map(({ label, key }) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{label}</label>
                  <input
                    type={key === 'email' ? 'email' : 'text'}
                    value={editUserData[key]}
                    onChange={(e) => setEditUserData({ ...editUserData, [key]: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg"
                  />
                </div>
              ))}
            </div>
            <div className="flex items-center justify-end gap-4 p-6 border-t border-gray-100 dark:border-gray-700">
              <button onClick={() => setEditingUser(null)} className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">Скасувати</button>
              <button onClick={handleSaveUser} className="px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors">Зберегти</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete User Confirm ── */}
      {confirmDeleteUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-sm p-6 text-center">
            <Trash2 className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Видалити учасника?</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6 text-sm">
              Ви дійсно бажаєте видалити учасника <strong>{confirmDeleteUser.surname} {confirmDeleteUser.name}</strong> та його результат? Рейтинг буде автоматично перераховано.
            </p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setConfirmDeleteUser(null)} className="px-6 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-medium rounded-xl transition-colors">
                Скасувати
              </button>
              <button
                onClick={() => handleDeleteUser(confirmDeleteUser.id)}
                className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-xl transition-colors"
              >
                Видалити
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
