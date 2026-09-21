import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import functionUrls from '../../backend/func2url.json';

export interface Company {
  id: number;
  name: string;
  inn?: string | null;
  status: string;
  role_slug: string;
  role_name: string;
  role_color: string;
  subscription_status?: string;
  trial_ends_at?: string | null;
  current_period_end?: string | null;
  tariff_name?: string | null;
}

interface AuthUser {
  user_id: number;
  phone: string;
  full_name: string | null;
  email: string | null;
  is_platform_admin: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  companies: Company[];
  currentCompany: Company | null;
  isLoading: boolean;
  setCurrentCompanyId: (id: number) => void;
  loginWithPhone: (phone: string, fullName?: string) => Promise<AuthUser>;
  refreshCompanies: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const STORAGE_USER_KEY = 'ek_user';
const STORAGE_COMPANY_KEY = 'ek_current_company_id';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [currentCompanyId, setCurrentCompanyIdState] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_USER_KEY);
    if (stored) {
      try {
        const parsedUser: AuthUser = JSON.parse(stored);
        setUser(parsedUser);
        fetchCompanies(parsedUser.user_id).finally(() => setIsLoading(false));
        return;
      } catch {
        localStorage.removeItem(STORAGE_USER_KEY);
      }
    }
    setIsLoading(false);
  }, []);

  const fetchCompanies = async (userId: number) => {
    try {
      const res = await fetch(`${functionUrls['companies-list']}?user_id=${userId}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setCompanies(data.companies || []);

        const storedCompanyId = localStorage.getItem(STORAGE_COMPANY_KEY);
        const storedIdNum = storedCompanyId ? Number(storedCompanyId) : null;
        const exists = (data.companies || []).find((c: Company) => c.id === storedIdNum);

        if (exists) {
          setCurrentCompanyIdState(storedIdNum);
        } else if (data.companies && data.companies.length > 0) {
          setCurrentCompanyIdState(data.companies[0].id);
          localStorage.setItem(STORAGE_COMPANY_KEY, String(data.companies[0].id));
        } else {
          setCurrentCompanyIdState(null);
        }
      }
    } catch (error) {
      console.error('Failed to load companies:', error);
    }
  };

  const loginWithPhone = async (phone: string, fullName?: string): Promise<AuthUser> => {
    const res = await fetch(functionUrls['auth-phone'], {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, full_name: fullName })
    });
    const data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Не удалось выполнить вход');
    }

    const authUser: AuthUser = {
      user_id: data.user_id,
      phone: data.phone,
      full_name: data.full_name,
      email: data.email,
      is_platform_admin: data.is_platform_admin
    };

    setUser(authUser);
    localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(authUser));
    setCompanies(data.companies || []);

    if (data.companies && data.companies.length > 0) {
      setCurrentCompanyIdState(data.companies[0].id);
      localStorage.setItem(STORAGE_COMPANY_KEY, String(data.companies[0].id));
    } else {
      setCurrentCompanyIdState(null);
      localStorage.removeItem(STORAGE_COMPANY_KEY);
    }

    return authUser;
  };

  const refreshCompanies = async () => {
    if (user) {
      await fetchCompanies(user.user_id);
    }
  };

  const setCurrentCompanyId = (id: number) => {
    setCurrentCompanyIdState(id);
    localStorage.setItem(STORAGE_COMPANY_KEY, String(id));
  };

  const logout = () => {
    setUser(null);
    setCompanies([]);
    setCurrentCompanyIdState(null);
    localStorage.removeItem(STORAGE_USER_KEY);
    localStorage.removeItem(STORAGE_COMPANY_KEY);
    window.location.href = '/login';
  };

  const currentCompany = companies.find(c => c.id === currentCompanyId) || null;

  return (
    <AuthContext.Provider
      value={{
        user,
        companies,
        currentCompany,
        isLoading,
        setCurrentCompanyId,
        loginWithPhone,
        refreshCompanies,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
};
