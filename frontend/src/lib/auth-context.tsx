'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  UserProfile,
  LoginRequest,
  RegisterRequest,
  authApi,
  apiErrorMessage,
  getStoredAccessToken,
  clearStoredTokens,
} from './api';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextType {
  user: UserProfile | null;
  status: AuthStatus;
  error: string | null;
  login: (credentials: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [error, setError] = useState<string | null>(null);

  const bootstrapAuth = useCallback(async () => {
    const token = getStoredAccessToken();
    if (!token) {
      setUser(null);
      setStatus('unauthenticated');
      return;
    }

    try {
      const userProfile = await authApi.getCurrentUser();
      setUser(userProfile);
      setStatus('authenticated');
    } catch (err: any) {
      clearStoredTokens();
      setUser(null);
      setStatus('unauthenticated');
    }
  }, []);

  useEffect(() => {
    bootstrapAuth();
  }, [bootstrapAuth]);

  const login = async (credentials: LoginRequest) => {
    setError(null);
    try {
      const response = await authApi.login(credentials);
      if (response.success && response.data) {
        if (response.data.user) {
          setUser(response.data.user);
        } else {
          const profile = await authApi.getCurrentUser();
          setUser(profile);
        }
        setStatus('authenticated');
      } else {
        throw new Error(response.message || 'Login failed');
      }
    } catch (err: unknown) {
      const msg = apiErrorMessage(err, 'Invalid email or password');
      setError(msg);
      setStatus('unauthenticated');
      throw new Error(msg);
    }
  };

  const register = async (data: RegisterRequest) => {
    setError(null);
    try {
      const response = await authApi.register(data);
      if (response.success) {
        // Automatically log in after registration
        await login({ email: data.email, password: data.password });
      } else {
        throw new Error(response.message || 'Registration failed');
      }
    } catch (err: unknown) {
      const msg = apiErrorMessage(err, 'Registration failed');
      setError(msg);
      throw new Error(msg);
    }
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } finally {
      setUser(null);
      setStatus('unauthenticated');
      setError(null);
    }
  };

  const clearError = () => setError(null);

  return (
    <AuthContext.Provider
      value={{
        user,
        status,
        error,
        login,
        register,
        logout,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
