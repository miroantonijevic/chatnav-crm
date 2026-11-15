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

export enum DealStage {
  LEAD = 'lead',
  DEMO = 'demo',
  TRIAL = 'trial',
  PROPOSAL = 'proposal',
  NEGOTIATION = 'negotiation',
  WON = 'won',
  LOST = 'lost',
}

export type WaitingOn = 'client' | 'us';
export type DealPeriod = 'monthly' | 'yearly' | 'one_time';

/** Pipeline / deal fields shared by contacts and companies. */
export interface DealFields {
  is_hot?: boolean;
  next_action?: string | null;
  deal_value?: number | null; // EUR
  deal_value_period?: DealPeriod | null;
  deal_stage?: DealStage | null;
  waiting_on?: WaitingOn | null;
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

export interface ContactContactDetail {
  id: number;
  type: 'email' | 'phone';
  value: string;
  label?: string;
}

export interface ContactContactDetailCreate {
  type: 'email' | 'phone';
  value: string;
  label?: string;
}

export interface Contact {
  id: number;
  first_name: string;
  last_name: string;
  company_id?: number;
  company_name?: string;
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
  is_hot?: boolean;
  next_action?: string | null;
  deal_value?: number | null;
  deal_value_period?: DealPeriod | null;
  deal_stage?: DealStage | null;
  waiting_on?: WaitingOn | null;
  contact_details: ContactContactDetail[];
  created_at: string;
  updated_at: string;
}

export interface ContactCreate {
  first_name: string;
  last_name: string;
  company_id?: number;
  job_title?: string;
  email?: string;
  phone?: string;
  notes?: string;
  owner_user_id?: number;
  current_relationship_status?: RelationshipStatus;
  last_contacted_at?: string | null;
  next_contact_due_at?: string | null;
  reminders_enabled?: boolean;
  is_hot?: boolean;
  next_action?: string | null;
  deal_value?: number | null;
  deal_value_period?: DealPeriod | null;
  deal_stage?: DealStage | null;
  waiting_on?: WaitingOn | null;
  contact_details?: ContactContactDetailCreate[];
}

export interface ContactUpdate extends Partial<ContactCreate> {}

export interface HistoryEntry {
  id: number;
  contact_id: number;
  changed_by_user_id: number;
  changed_by_full_name: string;
  entry_type: 'created' | 'edited' | 'interaction' | 'marked_contacted';
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
  new_password?: string;
  must_change_password?: boolean;
}

export interface ReminderStats {
  due_now: number;
  upcoming_7_days: number;
  companies_due_now: number;
  companies_upcoming_7_days: number;
  reminders_enabled: boolean;
  check_interval_minutes: number;
  last_run_at?: string | null;
  last_run_sent?: number;
  last_run_simulated?: number;
  last_run_failed?: number;
  last_run_errors?: string[];
}

export interface EntityStats {
  total: number;
  due_now: number;
  by_status: Record<string, number>;
}

export interface ActivityByDay {
  date: string;
  count: number;
}

export interface ActivityByUser {
  user_id: number;
  user_name: string;
  created: number;
  edited: number;
  interactions: number;
  total: number;
  by_day: ActivityByDay[];
}

export interface ActivityStats {
  days: number;
  by_user: ActivityByUser[];
  by_day: ActivityByDay[];
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
}

export type ContactListResponse = PaginatedResponse<Contact>;

export interface CompanyContactDetail {
  id: number;
  type: 'website' | 'phone' | 'email' | 'address';
  value: string;
  label?: string;
}

export interface CompanyContactDetailCreate {
  type: 'website' | 'phone' | 'email' | 'address';
  value: string;
  label?: string;
}

export interface Company {
  id: number;
  name: string;
  industry?: string;
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
  is_hot?: boolean;
  next_action?: string | null;
  deal_value?: number | null;
  deal_value_period?: DealPeriod | null;
  deal_stage?: DealStage | null;
  waiting_on?: WaitingOn | null;
  contact_details: CompanyContactDetail[];
  created_at: string;
  updated_at: string;
}

export interface CompanyListItem {
  id: number;
  name: string;
}

export interface CompanyCreate {
  name: string;
  industry?: string;
  notes?: string;
  owner_user_id?: number;
  current_relationship_status?: RelationshipStatus;
  reminders_enabled?: boolean;
  next_contact_due_at?: string | null;
  is_hot?: boolean;
  next_action?: string | null;
  deal_value?: number | null;
  deal_value_period?: DealPeriod | null;
  deal_stage?: DealStage | null;
  waiting_on?: WaitingOn | null;
  contact_details: CompanyContactDetailCreate[];
}

export interface CompanyUpdate {
  name?: string;
  industry?: string;
  notes?: string;
  owner_user_id?: number;
  current_relationship_status?: RelationshipStatus;
  reminders_enabled?: boolean;
  next_contact_due_at?: string | null;
  is_hot?: boolean;
  next_action?: string | null;
  deal_value?: number | null;
  deal_value_period?: DealPeriod | null;
  deal_stage?: DealStage | null;
  waiting_on?: WaitingOn | null;
  contact_details?: CompanyContactDetailCreate[];
}

export interface CompanyHistoryEntry {
  id: number;
  company_id: number;
  changed_by_user_id: number;
  changed_by_full_name: string;
  entry_type: 'created' | 'edited' | 'interaction' | 'marked_contacted';
  status: RelationshipStatus;
  note?: string;
  interaction_at: string;
  next_contact_due_at?: string;
  created_at: string;
}

export interface CompanyHistoryCreate {
  status: RelationshipStatus;
  note?: string;
  interaction_at: string;
  next_contact_due_at?: string;
}

export type CompanyListResponse = PaginatedResponse<Company>;

// ── Pipeline ("hot list") ─────────────────────────────────────────────

export type EntityType = 'company' | 'contact';

export interface PipelineItem {
  entity_type: EntityType;
  id: number;
  name: string;
  company_id?: number | null;
  company_name?: string | null;
  job_title?: string | null;
  industry?: string | null;
  is_hot: boolean;
  next_action?: string | null;
  deal_value?: number | null;
  deal_value_period?: DealPeriod | null;
  deal_stage?: DealStage | null;
  waiting_on?: WaitingOn | null;
  status: RelationshipStatus;
  last_contacted_at?: string | null;
  next_contact_due_at?: string | null;
  reminders_enabled: boolean;
  owner_user_id: number;
  owner_full_name: string;
  emails: string[];
  phones: string[];
  updated_at: string;
}

export interface PipelineListResponse {
  items: PipelineItem[];
  total: number;
}

export interface PipelineSummary {
  total: number;
  overdue: number;
  companies: number;
  contacts: number;
  mrr: number;
  one_time: number;
}

export interface PipelineUpdate extends DealFields {
  next_contact_due_at?: string | null;
}

export interface PipelineQuery {
  skip?: number;
  limit?: number;
  search?: string;
  entity_type?: EntityType;
  status?: string;
  owner_id?: number;
  due?: 'overdue' | 'week' | 'none';
  stage?: DealStage;
  waiting_on?: WaitingOn;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}
