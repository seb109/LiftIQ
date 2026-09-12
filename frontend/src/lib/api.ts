import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  created_at?: string;
  avatar_url?: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthTokenData {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user?: UserProfile;
}

export interface APIResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

// Token Storage Helpers (SSR Safe)
export const getStoredAccessToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('liftiq_access_token');
};

export const getStoredRefreshToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('liftiq_refresh_token');
};

export const setStoredTokens = (accessToken: string, refreshToken: string): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem('liftiq_access_token', accessToken);
  localStorage.setItem('liftiq_refresh_token', refreshToken);
};

export const clearStoredTokens = (): void => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('liftiq_access_token');
  localStorage.removeItem('liftiq_refresh_token');
};

// Create Axios Instance
export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Request Interceptor: Attach Access Token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getStoredAccessToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Automatic Refresh Token Handling
let isRefreshing = false;
let failedQueue: Array<{ resolve: (value?: unknown) => void; reject: (reason?: any) => void }> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<APIResponse>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (originalRequest.url?.includes('/api/v1/auth/login') || originalRequest.url?.includes('/api/v1/auth/refresh')) {
        return Promise.reject(error);
      }

      originalRequest._retry = true;

      const refreshToken = getStoredRefreshToken();
      if (!refreshToken) {
        clearStoredTokens();
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => apiClient(originalRequest))
          .catch((err) => Promise.reject(err));
      }

      isRefreshing = true;

      try {
        const refreshResponse = await axios.post<APIResponse<AuthTokenData>>(
          `${API_BASE_URL}/api/v1/auth/refresh`,
          { refresh_token: refreshToken }
        );

        const tokenData = refreshResponse.data.data;
        if (tokenData?.access_token && tokenData?.refresh_token) {
          setStoredTokens(tokenData.access_token, tokenData.refresh_token);
          apiClient.defaults.headers.common.Authorization = `Bearer ${tokenData.access_token}`;
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${tokenData.access_token}`;
          }
          processQueue(null, tokenData.access_token);
          return apiClient(originalRequest);
        } else {
          throw new Error('Invalid refresh token response structure');
        }
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        clearStoredTokens();
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// Auth API Methods
export const authApi = {
  register: async (payload: RegisterRequest): Promise<APIResponse<{ user_id: string; name: string; email: string }>> => {
    const res = await apiClient.post<APIResponse>('/api/v1/auth/register', payload);
    return res.data;
  },

  login: async (payload: LoginRequest): Promise<APIResponse<AuthTokenData>> => {
    const res = await apiClient.post<APIResponse<AuthTokenData>>('/api/v1/auth/login', payload);
    if (res.data.success && res.data.data) {
      setStoredTokens(res.data.data.access_token, res.data.data.refresh_token);
    }
    return res.data;
  },

  logout: async (): Promise<APIResponse> => {
    const refreshToken = getStoredRefreshToken();
    try {
      if (refreshToken) {
        await apiClient.post('/api/v1/auth/logout', { refresh_token: refreshToken });
      }
    } catch {
      // Ignore network errors during logout
    } finally {
      clearStoredTokens();
    }
    return { success: true, message: 'Logged out successfully' };
  },

  getCurrentUser: async (): Promise<UserProfile> => {
    const res = await apiClient.get<APIResponse<UserProfile>>('/api/v1/users/me');
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.message || 'Failed to fetch user profile');
    }
    return res.data.data;
  },
};

export interface WorkoutSessionItem {
  id: string;
  exercise: string;
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  total_reps: number;
  average_form_score: number | null;
  status: string;
}

export interface AIReportItem {
  id: string;
  session_id: string;
  overall_score: number | null;
  form_score: number | null;
  strengths: string[];
  mistakes: string[];
  improvements: string[];
  coach_summary: string | null;
  next_session_focus: string | null;
  motivation: string | null;
  report_markdown: string | null;
  model_name: string | null;
  created_at: string | null;
}

export const sessionsApi = {
  getSessions: async (limit = 50): Promise<WorkoutSessionItem[]> => {
    const res = await apiClient.get<APIResponse<{ items: WorkoutSessionItem[]; count: number }>>(`/api/v1/sessions?limit=${limit}`);
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.message || 'Failed to fetch workout sessions');
    }
    return res.data.data.items || [];
  },
};

export const reportsApi = {
  getReports: async (limit = 50): Promise<AIReportItem[]> => {
    const res = await apiClient.get<APIResponse<{ items: AIReportItem[]; count: number }>>(`/api/v1/reports?limit=${limit}`);
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.message || 'Failed to fetch AI reports');
    }
    return res.data.data.items || [];
  },
};

// ── Workout session management (Milestone 6C) ────────────────────────────────

export interface StartSessionResponse {
  session_id: string;
  started_at: string;
  exercise: string;
}

export interface StopSessionResponse {
  session_id: string;
  exercise: string;
  total_reps: number;
  duration_seconds: number;
  average_form_score: number | null;
  ended_at: string;
  report_id?: string;
}

/** Live stats returned by GET /stats?session_id=<uuid> */
export interface WorkoutStats {
  counter: number;
  stage: string | null;
  feedback: string;
  ai_feedback: string;
  exercise: string;
  form_violations: string[];
  form_score: number | null;
  session_active: boolean;
  session_complete: boolean;
  current_set: number;
  target_sets: number;
  target_reps: number;
  completed_sets: unknown[];
  is_resting: boolean;
  rest_remaining: number;
  set_feedback: string;
  session_summary: string;
  session_id: string;
}

/** Start an authenticated workout session via the v1 API. */
export const startWorkoutSession = async (
  exercise: string,
  targetReps: number,
  targetSets: number,
): Promise<StartSessionResponse> => {
  const res = await apiClient.post<APIResponse<StartSessionResponse>>('/api/v1/sessions/start', {
    exercise,
    target_reps: targetReps,
    target_sets: targetSets,
  });
  if (!res.data.success || !res.data.data) {
    throw new Error(res.data.message || 'Failed to start workout session');
  }
  return res.data.data;
};

/** Stop/finalize an authenticated workout session. */
export const stopWorkoutSession = async (sessionId: string): Promise<StopSessionResponse> => {
  const res = await apiClient.post<APIResponse<StopSessionResponse>>(`/api/v1/sessions/${sessionId}/stop`);
  if (!res.data.success || !res.data.data) {
    throw new Error(res.data.message || 'Failed to stop workout session');
  }
  return res.data.data;
};

/** Poll live CV stats from the legacy /stats endpoint (no auth required). */
export const getWorkoutStats = async (sessionId: string): Promise<WorkoutStats> => {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const res = await fetch(`${baseUrl}/stats?session_id=${sessionId}`);
  if (!res.ok) throw new Error('Failed to fetch workout stats');
  return res.json() as Promise<WorkoutStats>;
};
