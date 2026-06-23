import React, { useState, useEffect } from 'react';
import { supabase, User, QuizResult, Question } from '../../lib/supabase';
import {
  Users,
  Trophy,
  BarChart3,
  TrendingUp,
  Calendar,
  Search,
  Download,
  Trash2,
  Edit3,
  Plus,
  X,
  AlertTriangle,
  FileSpreadsheet,
  FileText,
  Filter,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

interface Stats {
  totalParticipants: number;
  totalAttempts: number;
  averageScore: number;
  bestScore: number;
  bestResult: QuizResult | null;
}

interface ResultWithUser extends QuizResult {
  users: User;
}

export function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({
    totalParticipants: 0,
    totalAttempts: 0,
    averageScore: 0,
    bestScore: 0,
    bestResult: null,
  });
  const [results, setResults] = useState<ResultWithUser[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [activeTab, setActiveTab] = useState<'results' | 'questions'>('results');
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [deletingResult, setDeletingResult] = useState<string | null>(null);
  const [newQuestion, setNewQuestion] = useState({
    category: 'TCP/IP',
    difficulty: 'medium' as 'easy' | 'medium' | 'hard',
    question: '',
    question_type: 'single' as 'single' | 'multiple' | 'matching' | 'true_false' | 'practical',
    options: ['', '', '', ''],
    correct_answers: [] as number[],
    points: 1,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: usersData } = await supabase.from('users').select('id');
      const { data: resultsData } = await supabase.from('quiz_results').select('*');
      const { data: fullResults } = await supabase
        .from('quiz_results')
        .select(`
          *,
          users!quiz_results_user_id_fkey(id, surname, name, patronymic, email, role, created_at)
        `)
        .order('finished_at', { ascending: false });
      const { data: questionsData } = await supabase.from('questions').select('*');

      if (usersData && resultsData && fullResults && questionsData) {
        const totalParticipants = new Set(resultsData.map((r) => r.user_id)).size;
        const totalAttempts = resultsData.length;
        const averageScore = resultsData.length
          ? resultsData.reduce((sum, r) => sum + r.score, 0) / resultsData.length
          : 0;
        const bestResult = resultsData.reduce(
          (best, current) => (current.score > (best?.score || 0) ? current : best),
          null as QuizResult | null
        );

        setStats({
          totalParticipants,
          totalAttempts,
          averageScore: Math.round(averageScore * 10) / 10,
          bestScore: bestResult?.score || 0,
          bestResult: bestResult as QuizResult | null,
        });
        setResults(fullResults as ResultWithUser[]);
        setQuestions(questionsData);
      }
    } catch (error) {
      console.error('Error loading admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredResults = results.filter((result) => {
    const user = result.users;
    if (!user) return false;
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch =
      searchQuery === '' ||
      user.surname.toLowerCase().includes(searchLower) ||
      user.name.toLowerCase().includes(searchLower) ||
      user.email.toLowerCase().includes(searchLower);

    const matchesDate =
      !dateFilter || new Date(result.finished_at).toLocaleDateString('uk-UA') === dateFilter;

    return matchesSearch && matchesDate;
  });

  const exportToExcel = () => {
    const exportData = results.map((r) => ({
      ID: r.id,
      Surname: r.users?.surname || '',
      Name: r.users?.name || '',
      Email: r.users?.email || '',
      Score: r.score,
      MaxScore: r.max_score,
      Percentage: r.percentage.toFixed(2) + '%',
      DurationSec: r.duration_seconds,
      Date: new Date(r.finished_at).toLocaleString('uk-UA'),
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Results');
    XLSX.writeFile(wb, 'quiz_results.xlsx');
  };

  const exportToPDF = () => {
    const doc = new jsPDF('l', 'mm', 'a4');
    doc.setFontSize(16);
    doc.text('Результати Network Admin Quiz Championship', 14, 15);

    const tableData = results.map((r) => [
      r.users?.surname + ' ' + r.users?.name || '',
      r.users?.email || '',
      r.score + '/' + r.max_score,
      r.percentage.toFixed(1) + '%',
      Math.floor(r.duration_seconds / 60) + ':' + (r.duration_seconds % 60).toString().padStart(2, '0'),
      new Date(r.finished_at).toLocaleDateString('uk-UA'),
    ]);

    (doc as any).autoTable({
      startY: 25,
      head: [['Учасник', 'Email', 'Бали', 'Відсоток', 'Час', 'Дата']],
      body: tableData,
      styles: { fontSize: 8 },
    });

    doc.save('quiz_results.pdf');
  };

  const handleDeleteResult = async (resultId: string) => {
    if (!window.confirm('Ви впевнені, що хочете видалити цей результат?')) return;

    try {
      const { error } = await supabase.from('quiz_results').delete().eq('id', resultId);
      if (error) throw error;
      setResults((prev) => prev.filter((r) => r.id !== resultId));
      loadData();
    } catch (error) {
      console.error('Error deleting result:', error);
      alert('Помилка при видаленні');
    }
  };

  const handleSaveQuestion = async () => {
    try {
      const questionData = {
        category: newQuestion.category,
        difficulty: newQuestion.difficulty,
        question: newQuestion.question,
        question_type: newQuestion.question_type,
        options: newQuestion.options.filter((o) => o !== ''),
        correct_answers: newQuestion.correct_answers,
        points: newQuestion.points,
      };

      if (editingQuestion) {
        const { error } = await supabase
          .from('questions')
          .update(questionData)
          .eq('id', editingQuestion.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('questions').insert(questionData);
        if (error) throw error;
      }

      setShowQuestionModal(false);
      setEditingQuestion(null);
      resetQuestionForm();
      loadData();
    } catch (error: any) {
      console.error('Error saving question:', error);
      alert('Помилка при збереженні: ' + (error?.message || String(error)));
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    if (!window.confirm('Ви впевнені, що хочете видалити це питання?')) return;

    try {
      const { error } = await supabase.from('questions').delete().eq('id', questionId);
      if (error) throw error;
      setQuestions((prev) => prev.filter((q) => q.id !== questionId));
    } catch (error) {
      console.error('Error deleting question:', error);
      alert('Помилка при видаленні');
    }
  };

  const resetQuestionForm = () => {
    setNewQuestion({
      category: 'TCP/IP',
      difficulty: 'medium',
      question: '',
      question_type: 'single',
      options: ['', '', '', ''],
      correct_answers: [],
      points: 1,
    });
  };

  const startEditQuestion = (question: Question) => {
    setEditingQuestion(question);
    setNewQuestion({
      category: question.category,
      difficulty: question.difficulty,
      question: question.question,
      question_type: question.question_type,
      options: question.options as string[],
      correct_answers: question.correct_answers as number[],
      points: question.points,
    });
    setShowQuestionModal(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const categories = [
    'TCP/IP', 'OSI', 'DHCP', 'DNS', 'VLAN', 'STP', 'OSPF', 'BGP',
    'NAT', 'VPN', 'IPv6', 'Linux Networking', 'Network Security', 'Wireshark', 'Zabbix', 'Troubleshooting'
  ];

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Адміністративна панель
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Керування вікториною та результатами
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700 p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900/30 rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Учасників</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.totalParticipants}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700 p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-accent-100 dark:bg-accent-900/30 rounded-xl flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-accent-600 dark:text-accent-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Пройдень</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.totalAttempts}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700 p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gold-100 dark:bg-gold-900/30 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-gold-600 dark:text-gold-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Середній бал</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.averageScore}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700 p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-bronze-100 dark:bg-bronze-900/30 rounded-xl flex items-center justify-center">
              <Trophy className="w-6 h-6 text-bronze-600 dark:text-bronze-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Найкращий</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.bestScore}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700 mb-8">
        <div className="flex border-b border-gray-100 dark:border-gray-700">
          <button
            onClick={() => setActiveTab('results')}
            className={`flex-1 px-6 py-4 font-medium transition-colors ${
              activeTab === 'results'
                ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600 dark:border-primary-400'
                : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            Результати
          </button>
          <button
            onClick={() => setActiveTab('questions')}
            className={`flex-1 px-6 py-4 font-medium transition-colors ${
              activeTab === 'questions'
                ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600 dark:border-primary-400'
                : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            Питання
          </button>
        </div>

        {activeTab === 'results' && (
          <div className="p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Пошук за ПІБ або email..."
                    className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
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
                <button
                  onClick={exportToExcel}
                  className="flex items-center gap-2 px-4 py-2 bg-accent-600 hover:bg-accent-700 text-white font-medium rounded-lg transition-colors"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  Excel
                </button>
                <button
                  onClick={exportToPDF}
                  className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors"
                >
                  <FileText className="w-4 h-4" />
                  PDF
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700 border-y border-gray-100 dark:border-gray-600">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">ID</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Учасник</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Email</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Бали</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">%</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Час</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Дата</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Дії</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {filteredResults.map((result) => (
                    <tr key={result.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 font-mono">
                        {result.id.slice(0, 8)}...
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900 dark:text-white">
                          {result.users?.surname} {result.users?.name}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {result.users?.patronymic}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {result.users?.email}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="font-semibold text-primary-600 dark:text-primary-400">
                          {result.score}/{result.max_score}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          result.percentage >= 80
                            ? 'bg-accent-100 dark:bg-accent-900/30 text-accent-700 dark:text-accent-400'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                        }`}>
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
                        <button
                          onClick={() => handleDeleteResult(result.id)}
                          className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          title="Видалити"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filteredResults.length === 0 && (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                Результатів не знайдено
              </div>
            )}
          </div>
        )}

        {activeTab === 'questions' && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Питання: {questions.length}
              </h3>
              <button
                onClick={() => {
                  resetQuestionForm();
                  setEditingQuestion(null);
                  setShowQuestionModal(true);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                Додати питання
              </button>
            </div>

            <div className="space-y-4">
              {questions.map((question) => (
                <div
                  key={question.id}
                  className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-100 dark:border-gray-600"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2 py-1 text-xs font-medium bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded">
                          {question.category}
                        </span>
                        <span className="px-2 py-1 text-xs font-medium bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300 rounded">
                          {question.difficulty}
                        </span>
                        <span className="px-2 py-1 text-xs font-medium bg-gold-100 dark:bg-gold-900/30 text-gold-600 dark:text-gold-400 rounded">
                          {question.points} бал(ів)
                        </span>
                      </div>
                      <p className="text-gray-900 dark:text-white">{question.question}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => startEditQuestion(question)}
                        className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                        title="Редагувати"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteQuestion(question.id)}
                        className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        title="Видалити"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {showQuestionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                {editingQuestion ? 'Редагувати питання' : 'Нове питання'}
              </h3>
              <button
                onClick={() => {
                  setShowQuestionModal(false);
                  setEditingQuestion(null);
                }}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Категорія
                </label>
                <select
                  value={newQuestion.category}
                  onChange={(e) => setNewQuestion({ ...newQuestion, category: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg"
                >
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Складність
                  </label>
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
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Тип питання
                  </label>
                  <select
                    value={newQuestion.question_type}
                    onChange={(e) => setNewQuestion({ ...newQuestion, question_type: e.target.value as any })}
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg"
                  >
                    <option value="single">О одна відповідь</option>
                    <option value="multiple">Декілька відповідей</option>
                    <option value="true_false">True/False</option>
                    <option value="matching">Відповідність</option>
                    <option value="practical">Практичне</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Питання
                </label>
                <textarea
                  value={newQuestion.question}
                  onChange={(e) => setNewQuestion({ ...newQuestion, question: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg"
                  placeholder="Текст питання..."
                />
              </div>

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
                          setNewQuestion({
                            ...newQuestion,
                            correct_answers: [...newQuestion.correct_answers, index].sort(),
                          });
                        } else {
                          setNewQuestion({
                            ...newQuestion,
                            correct_answers: newQuestion.correct_answers.filter((i) => i !== index),
                          });
                        }
                      }}
                      className="rounded border-gray-300"
                    />
                    <input
                      type="text"
                      value={option}
                      onChange={(e) => {
                        const newOptions = [...newQuestion.options];
                        newOptions[index] = e.target.value;
                        setNewQuestion({ ...newQuestion, options: newOptions });
                      }}
                      className="flex-1 px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg"
                      placeholder={`Варіант ${index + 1}`}
                    />
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Бали
                </label>
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
                onClick={() => {
                  setShowQuestionModal(false);
                  setEditingQuestion(null);
                }}
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
    </div>
  );
}
