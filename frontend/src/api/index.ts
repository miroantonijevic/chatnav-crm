/**
 * API service functions for all endpoints
 */
import { apiClient } from './client';
import type {
  LoginRequest,
  LoginResponse,
  PasswordChange,
  User,
  UserCreate,
  UserUpdate,
  Contact,
  ContactCreate,
  ContactUpdate,
  ContactListResponse,
  HistoryEntry,
  HistoryCreate,
  ReminderStats,
  Company,
  CompanyListItem,
  CompanyListResponse,
  CompanyCreate,
  CompanyUpdate,
  CompanyHistoryEntry,
  CompanyHistoryCreate,
  EntityStats,
  ActivityStats,
} from '../types';

// Auth endpoints
export const authApi = {
  login: (data: LoginRequest) => apiClient.post<LoginResponse>('/auth/login', data, false),
  changePassword: (data: PasswordChange) => apiClient.post('/auth/change-password', data),
  getCurrentUser: () => apiClient.get<User>('/auth/me'),
};

// User endpoints
export const userApi = {
  list: () => apiClient.get<User[]>('/users'),
  create: (data: UserCreate) => apiClient.post<User>('/users', data),
  get: (id: number) => apiClient.get<User>(`/users/${id}`),
  update: (id: number, data: UserUpdate) => apiClient.put<User>(`/users/${id}`, data),
  activate: (id: number) => apiClient.patch<User>(`/users/${id}/activate`),
  deactivate: (id: number) => apiClient.patch<User>(`/users/${id}/deactivate`),
  delete: (id: number) => apiClient.delete(`/users/${id}`),
};

// Contact endpoints
export const contactApi = {
  list: (params?: {
    skip?: number;
    limit?: number;
    search?: string;
    status?: string;
    due_only?: boolean;
    upcoming_only?: boolean;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
  }) => {
    const queryParams = new URLSearchParams();
    if (params?.skip) queryParams.append('skip', params.skip.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.search) queryParams.append('search', params.search);
    if (params?.status) queryParams.append('status', params.status);
    if (params?.due_only) queryParams.append('due_only', 'true');
    if (params?.upcoming_only) queryParams.append('upcoming_only', 'true');
    if (params?.sort_by) queryParams.append('sort_by', params.sort_by);
    if (params?.sort_order) queryParams.append('sort_order', params.sort_order);

    const query = queryParams.toString();
    return apiClient.get<ContactListResponse>(`/contacts${query ? `?${query}` : ''}`);
  },
  create: (data: ContactCreate) => apiClient.post<Contact>('/contacts', data),
  get: (id: number) => apiClient.get<Contact>(`/contacts/${id}`),
  update: (id: number, data: ContactUpdate) => apiClient.put<Contact>(`/contacts/${id}`, data),
  delete: (id: number) => apiClient.delete(`/contacts/${id}`),
  getHistory: (id: number) => apiClient.get<HistoryEntry[]>(`/contacts/${id}/history`),
  addHistory: (id: number, data: HistoryCreate) =>
    apiClient.post<HistoryEntry>(`/contacts/${id}/history`, data),
  markContacted: (id: number, payload: { note?: string; status?: string; interaction_at?: string; next_contact_due_at?: string | null }) =>
    apiClient.post<HistoryEntry>(`/contacts/${id}/mark-contacted`, payload),
  getStats: () => apiClient.get<EntityStats>('/contacts/stats'),
};

// Company endpoints
export const companyApi = {
  list: (params?: {
    skip?: number;
    limit?: number;
    search?: string;
    due_only?: boolean;
    upcoming_only?: boolean;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
  }) => {
    const queryParams = new URLSearchParams();
    if (params?.skip) queryParams.append('skip', params.skip.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.search) queryParams.append('search', params.search);
    if (params?.due_only) queryParams.append('due_only', 'true');
    if (params?.upcoming_only) queryParams.append('upcoming_only', 'true');
    if (params?.sort_by) queryParams.append('sort_by', params.sort_by);
    if (params?.sort_order) queryParams.append('sort_order', params.sort_order);
    const query = queryParams.toString();
    return apiClient.get<CompanyListResponse>(`/companies${query ? `?${query}` : ''}`);
  },
  listSimple: () => apiClient.get<CompanyListItem[]>('/companies/list/simple'),
  create: (data: CompanyCreate) => apiClient.post<Company>('/companies', data),
  get: (id: number) => apiClient.get<Company>(`/companies/${id}`),
  update: (id: number, data: CompanyUpdate) => apiClient.put<Company>(`/companies/${id}`, data),
  delete: (id: number) => apiClient.delete(`/companies/${id}`),
  getHistory: (id: number) => apiClient.get<CompanyHistoryEntry[]>(`/companies/${id}/history`),
  addHistory: (id: number, data: CompanyHistoryCreate) =>
    apiClient.post<CompanyHistoryEntry>(`/companies/${id}/history`, data),
  markContacted: (id: number, payload: { note?: string; status?: string; interaction_at?: string; next_contact_due_at?: string | null }) =>
    apiClient.post<CompanyHistoryEntry>(`/companies/${id}/mark-contacted`, payload),
  getStats: () => apiClient.get<EntityStats>('/companies/stats'),
};

// Reminder endpoints
export const reminderApi = {
  getStats: () => apiClient.get<ReminderStats>('/reminders/stats'),
  triggerCheck: () => apiClient.post('/reminders/check', {}),
};

// Dashboard aggregate endpoints
export const dashboardApi = {
  getActivity: (days = 30) => apiClient.get<ActivityStats>(`/dashboard/activity?days=${days}`),
};
