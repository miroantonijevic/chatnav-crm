/**
 * Type definitions for the application
 */

export enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
}

export enum RelationshipStatus {
  NEW = 'new',
  CONTACTED = 'contacted',
  FOLLOW_UP_NEEDED = 'follow-up-needed',
  INTERESTED = 'interested',
  NOT_INTERESTED = 'not-interested',
  CUSTOMER = 'customer',
  INACTIVE = 'inactive',
}

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  must_change_password: boolean;
  created_at: string;
  updated_at: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  must_change_password: boolean;
}

export interface PasswordChange {
  current_password: string;
  new_password: string;
}

export interface Contact {
  id: number;
  first_name: string;
  last_name: string;
  company?: string;
  job_title?: string;
  email?: string;
  phone?: string;
  notes?: string;
  owner_user_id: number;
  owner_email: string;
  owner_full_name: string;
  created_by_user_id: number;
  created_by_email: string;
  created_by_full_name: string;
  current_relationship_status: RelationshipStatus;
  last_contacted_at?: string;
  next_contact_due_at?: string;
  reminders_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface ContactCreate {
  first_name: string;
  last_name: string;
  company?: string;
  job_title?: string;
  email?: string;
  phone?: string;
  notes?: string;
  owner_user_id?: number;
  current_relationship_status?: RelationshipStatus;
  last_contacted_at?: string;
  next_contact_due_at?: string;
  reminders_enabled?: boolean;
}

export interface ContactUpdate extends Partial<ContactCreate> {}

export interface HistoryEntry {
  id: number;
  contact_id: number;
  changed_by_user_id: number;
  changed_by_full_name: string;
  entry_type: 'created' | 'edited' | 'interaction';
  status: RelationshipStatus;
  note?: string;
  interaction_at: string;
  next_contact_due_at?: string;
  created_at: string;
}

export interface HistoryCreate {
  status: RelationshipStatus;
  note?: string;
  interaction_at: string;
  next_contact_due_at?: string;
}

export interface UserCreate {
  email: string;
  full_name: string;
  role: UserRole;
  password: string;
}

export interface UserUpdate {
  email?: string;
  full_name?: string;
  role?: UserRole;
  is_active?: boolean;
}

export interface ReminderStats {
  due_now: number;
  upcoming_7_days: number;
  reminders_enabled: boolean;
  check_interval_minutes: number;
}
