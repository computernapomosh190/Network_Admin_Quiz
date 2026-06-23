import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase, User } from '../lib/supabase';
import bcrypt from 'bcryptjs';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ error: string | null }>;
  register: (data: RegisterData) => Promise<{ error: string | null }>;
  logout: () => void;
  isAdmin: boolean;
}

interface RegisterData {
  surname: string;
  name: string;
  patronymic: string;
  email: string;
  password: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem('quiz_user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        localStorage.removeItem('quiz_user');
      }
    }
    setLoading(false);
  }, []);

  const sha256Hash = async (message: string): Promise<string> => {
    const msgBuffer = new TextEncoder().encode(message + 'quiz-salt-2024');
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const login = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single();

      if (error || !data) {
        return { error: 'Користувача не знайдено' };
      }

      let isValid = false;

      if (data.password_hash.startsWith('$2')) {
        isValid = await bcrypt.compare(password, data.password_hash);
      } else {
        const hashedInput = await sha256Hash(password);
        isValid = hashedInput === data.password_hash;
      }

      if (!isValid) {
        return { error: 'Невірний пароль' };
      }

      const userData: User = {
        id: data.id,
        surname: data.surname,
        name: data.name,
        patronymic: data.patronymic,
        email: data.email,
        role: data.role,
        created_at: data.created_at,
      };

      setUser(userData);
      localStorage.setItem('quiz_user', JSON.stringify(userData));
      return { error: null };
    } catch {
      return { error: 'Помилка авторизації' };
    }
  };

  const register = async (data: RegisterData) => {
    try {
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('email', data.email)
        .single();

      if (existingUser) {
        return { error: 'Користувач з таким email вже існує' };
      }

      const passwordHash = await bcrypt.hash(data.password, 10);

      const { error } = await supabase.from('users').insert({
        surname: data.surname,
        name: data.name,
        patronymic: data.patronymic,
        email: data.email,
        password_hash: passwordHash,
        role: 'user',
      });

      if (error) {
        return { error: 'Помилка реєстрації' };
      }

      return await login(data.email, data.password);
    } catch {
      return { error: 'Помилка реєстрації' };
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('quiz_user');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
        isAdmin: user?.role === 'admin',
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
