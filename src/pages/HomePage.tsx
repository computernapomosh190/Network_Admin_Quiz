import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  Network,
  Trophy,
  FileCheck,
  PlayCircle,
  Users,
  Clock,
  Shield,
  Zap,
  CheckCircle,
  ArrowRight,
} from 'lucide-react';

const categories = [
  'TCP/IP', 'OSI', 'DHCP', 'DNS', 'VLAN', 'STP', 'OSPF', 'BGP',
  'NAT', 'VPN', 'IPv6', 'Linux Networking', 'Network Security', 'Wireshark', 'Zabbix', 'Troubleshooting'
];

const features = [
  {
    icon: Network,
    title: '35 питань',
    description: 'Професійні питання з мережевого адміністрування',
  },
  {
    icon: Clock,
    title: 'Таймер',
    description: 'Фіксуємо час для справедливого рейтингу',
  },
  {
    icon: Trophy,
    title: 'Рейтинг',
    description: 'Змагайтеся з іншими адміністраторами',
  },
  {
    icon: FileCheck,
    title: 'Сертифікати',
    description: 'ТОП-3 отримують престижні сертифікати',
  },
];

export function HomePage() {
  const { user } = useAuth();

  return (
    <div className="space-y-8 md:space-y-12 pb-20 md:pb-0">
      <section className="text-center py-8 md:py-12 lg:py-16 px-2 md:px-4">
        <div className="inline-flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-1.5 md:py-2 bg-primary-50 dark:bg-primary-900/30 rounded-full text-primary-600 dark:text-primary-400 text-xs md:text-sm font-medium mb-4 md:mb-6">
          <Zap className="w-3.5 h-3.5 md:w-4 md:h-4" />
          <span className="hidden sm:inline">Онлайн-вікторина для мережевих адміністраторів</span>
          <span className="sm:hidden">Вікторина для мережевих адмінів</span>
        </div>

        <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-white mb-4 md:mb-6 leading-tight">
          <span className="hidden sm:inline">Network Administrator</span>
          <span className="sm:hidden">Network Admin</span>
          <span className="block text-transparent bg-clip-text bg-gradient-to-r from-primary-500 to-primary-700 text-2xl sm:text-3xl md:text-4xl lg:text-5xl mt-1 md:mt-2">
            Quiz Championship
          </span>
        </h1>

        <p className="text-sm md:text-base lg:text-lg text-gray-600 dark:text-gray-400 max-w-xl md:max-w-2xl mx-auto mb-6 md:mb-8 px-4">
          Перевірте свої знання з мережевого адміністрування та змагайтеся
          за перше місце у рейтингу учасників
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 md:gap-4">
          {user ? (
            <Link
              to="/quiz"
              className="group w-full sm:w-auto flex items-center justify-center gap-2 md:gap-3 px-6 md:px-8 py-3 md:py-4 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-xl shadow-lg shadow-primary-500/25 hover:shadow-primary-500/40 transition-all text-sm md:text-base"
            >
              <PlayCircle className="w-5 h-5 md:w-6 md:h-6" />
              Почати вікторину
              <ArrowRight className="w-4 h-4 md:w-5 md:h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
          ) : (
            <Link
              to="/register"
              className="group w-full sm:w-auto flex items-center justify-center gap-2 md:gap-3 px-6 md:px-8 py-3 md:py-4 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-xl shadow-lg shadow-primary-500/25 hover:shadow-primary-500/40 transition-all text-sm md:text-base"
            >
              <Shield className="w-5 h-5 md:w-6 md:h-6" />
              Зареєструватися
              <ArrowRight className="w-4 h-4 md:w-5 md:h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
          )}
          <Link
            to="/ranking"
            className="w-full sm:w-auto flex items-center justify-center gap-2 md:gap-3 px-6 md:px-8 py-3 md:py-4 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-900 dark:text-white font-semibold rounded-xl shadow-md border border-gray-200 dark:border-gray-700 transition-all text-sm md:text-base"
          >
            <Trophy className="w-5 h-5 md:w-6 md:h-6 text-gold-500" />
            Рейтинг
          </Link>
        </div>
      </section>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6 px-2 md:px-0">
        {features.map((feature, index) => (
          <div
            key={index}
            className="bg-white dark:bg-gray-800 rounded-xl md:rounded-2xl p-4 md:p-6 shadow-md border border-gray-100 dark:border-gray-700 hover:shadow-lg hover:border-primary-200 dark:hover:border-primary-800 transition-all animate-slide-up"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className="w-10 h-10 md:w-12 md:h-12 bg-primary-100 dark:bg-primary-900/30 rounded-xl flex items-center justify-center mb-3 md:mb-4">
              <feature.icon className="w-5 h-5 md:w-6 md:h-6 text-primary-600 dark:text-primary-400" />
            </div>
            <h3 className="text-base md:text-lg font-semibold text-gray-900 dark:text-white mb-1 md:mb-2">
              {feature.title}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 text-xs md:text-sm hidden sm:block">
              {feature.description}
            </p>
          </div>
        ))}
      </section>

      <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700 p-4 md:p-6 lg:p-8 mx-2 md:mx-0">
        <div className="flex items-center gap-2 md:gap-3 mb-4 md:mb-6">
          <div className="w-8 h-8 md:w-10 md:h-10 bg-accent-100 dark:bg-accent-900/30 rounded-xl flex items-center justify-center">
            <CheckCircle className="w-4 h-4 md:w-5 md:h-5 text-accent-600 dark:text-accent-400" />
          </div>
          <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">
            Категорії питань
          </h2>
        </div>

        <div className="flex flex-wrap gap-1.5 md:gap-2">
          {categories.map((category) => (
            <span
              key={category}
              className="px-2.5 md:px-4 py-1 md:py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-xs md:text-sm font-medium hover:bg-primary-50 dark:hover:bg-primary-900/30 hover:text-primary-600 dark:hover:text-primary-400 transition-colors cursor-default"
            >
              {category}
            </span>
          ))}
        </div>
      </section>

      <section className="bg-gradient-to-br from-primary-600 to-primary-800 rounded-2xl p-6 md:p-8 text-white mx-2 md:mx-0">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-xl md:text-2xl lg:text-3xl font-bold mb-3 md:mb-4">
            Готові випробувати свої знання?
          </h2>
          <p className="text-primary-100 mb-4 md:mb-6 text-sm md:text-base">
            Зареєструйтеся та пройдіть вікторину. Найкращі учасники отримають
            офіційні сертифікати.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 md:gap-4">
            <div className="flex items-center gap-2 md:gap-3 px-4 md:px-6 py-2.5 md:py-3 bg-white/10 backdrop-blur rounded-xl">
              <Users className="w-4 h-4 md:w-5 md:h-5" />
              <span className="text-sm md:text-base">Змагайтесь з колегами</span>
            </div>
            <div className="flex items-center gap-2 md:gap-3 px-4 md:px-6 py-2.5 md:py-3 bg-white/10 backdrop-blur rounded-xl">
              <FileCheck className="w-4 h-4 md:w-5 md:h-5" />
              <span className="text-sm md:text-base">Отримайте сертифікат</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
