/**
 * Contacts list page
 */
import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { MainLayout } from '../layouts/MainLayout';
import { fromServer, fmtDate } from '../utils/dates';
import { contactApi } from '../api';
import { Contact, RelationshipStatus, EntityStats } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useScrollRestoration } from '../utils/useScrollRestoration';
import './Contacts.css';

const PAGE_SIZE = 50;

const STATUS_LABELS: Record<string, string> = {
  new: 'New',
  contacted: 'Contacted',
  'follow-up-needed': 'Follow-up Needed',
  interested: 'Interested',
  'not-interested': 'Not Interested',
  customer: 'Customer',
  inactive: 'Inactive',
};

export const ContactsListPage: React.FC = () => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<EntityStats | null>(null);
  const [loading, setLoading] = useState(true);
  useScrollRestoration('scroll:contacts', !loading);
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();

  const search = searchParams.get('search') || '';
  const status = searchParams.get('status') || '';
  const dueOnly = searchParams.get('due_only') === 'true';
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
  const sortBy = searchParams.get('sort_by') || '';
  const sortOrder = searchParams.get('sort_order') === 'desc' ? 'desc' : 'asc';

  useEffect(() => {
    loadContacts();
  }, [search, status, dueOnly, page, sortBy, sortOrder]);

  useEffect(() => {
    loadStats();
  }, []);

  // Reset to page 1 whenever filters or sorting change
  useEffect(() => {
    if (page !== 1) {
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('page');
      setSearchParams(newParams);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status, dueOnly, sortBy, sortOrder]);

  const loadContacts = async () => {
    setLoading(true);
    try {
      const data = await contactApi.list({
        search: search || undefined,
        status: status || undefined,
        due_only: dueOnly,
        skip: (page - 1) * PAGE_SIZE,
        limit: PAGE_SIZE,
        sort_by: sortBy || undefined,
        sort_order: sortOrder,
      });
      setContacts(data.items);
      setTotal(data.total);
    } catch (error) {
      console.error('Failed to load contacts:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const data = await contactApi.getStats();
      setStats(data);
    } catch (error) {
      console.error('Failed to load contact stats:', error);
    }
  };

  const handleSort = (column: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (sortBy === column) {
      newParams.set('sort_order', sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      newParams.set('sort_by', column);
      newParams.set('sort_order', 'asc');
    }
    setSearchParams(newParams);
  };

  const sortArrow = (column: string) => (sortBy === column ? (sortOrder === 'asc' ? ' \u25b2' : ' \u25bc') : '');

  const handleSearchChange = (value: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (value) {
      newParams.set('search', value);
    } else {
      newParams.delete('search');
    }
    setSearchParams(newParams);
  };

  const handleStatusChange = (value: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (value) {
      newParams.set('status', value);
    } else {
      newParams.delete('status');
    }
    setSearchParams(newParams);
  };

  const handleDueOnlyChange = (checked: boolean) => {
    const newParams = new URLSearchParams(searchParams);
    if (checked) {
      newParams.set('due_only', 'true');
    } else {
      newParams.delete('due_only');
    }
    setSearchParams(newParams);
  };

  const goToPage = (newPage: number) => {
    const newParams = new URLSearchParams(searchParams);
    if (newPage > 1) {
      newParams.set('page', newPage.toString());
    } else {
      newParams.delete('page');
    }
    setSearchParams(newParams);
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const handleDelete = async (contact: Contact) => {
    if (!confirm(`Are you sure you want to delete ${contact.first_name} ${contact.last_name}?`)) return;

    try {
      await contactApi.delete(contact.id);
      // Reload contacts after deletion
      loadContacts();
      loadStats();
    } catch (error: any) {
      alert(error.message || 'Failed to delete contact');
    }
  };

  const canDelete = (contact: Contact) => {
    return user?.role === 'admin' || contact.owner_user_id === user?.id;
  };

  return (
    <MainLayout>
      <div className="contacts-page">
        <div className="page-header">
          <h1>Contacts</h1>
          <Link to="/contacts/new" className="btn-primary-inline">
            + New Contact
          </Link>
        </div>

        {stats && (
          <div className="stats-bar">
            <span className="stats-bar-item stats-bar-total">
              <strong>{stats.total}</strong> Total
            </span>
            <span className="stats-bar-item stats-bar-due">
              <strong>{stats.due_now}</strong> Due Now
            </span>
            {Object.values(RelationshipStatus).map((s) => (
              <span key={s} className="stats-bar-item">
                <strong>{stats.by_status[s] ?? 0}</strong> {STATUS_LABELS[s] ?? s}
              </span>
            ))}
          </div>
        )}

        <div className="filters">
          <input
            type="text"
            placeholder="Search contacts..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="search-input"
          />

          <select
            value={status}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="filter-select"
          >
            <option value="">All Statuses</option>
            {Object.values(RelationshipStatus).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={dueOnly}
              onChange={(e) => handleDueOnlyChange(e.target.checked)}
            />
            Needs Follow-up Now
          </label>
        </div>

        {loading ? (
          <div className="loading">Loading contacts...</div>
        ) : contacts.length === 0 ? (
          <div className="empty-message">
            <p>No contacts found.</p>
            <Link to="/contacts/new">Create your first contact</Link>
          </div>
        ) : (
          <div className="contacts-table">
            <table>
              <thead>
                <tr>
                  <th className="sortable-header" onClick={() => handleSort('name')}>Name{sortArrow('name')}</th>
                  <th className="sortable-header" onClick={() => handleSort('company')}>Company{sortArrow('company')}</th>
                  <th className="sortable-header" onClick={() => handleSort('owner')}>Relationship Owner{sortArrow('owner')}</th>
                  <th className="sortable-header" onClick={() => handleSort('created_by')}>Created By{sortArrow('created_by')}</th>
                  <th className="sortable-header" onClick={() => handleSort('created_at')}>Created At{sortArrow('created_at')}</th>
                  <th>Emails</th>
                  <th>Phones</th>
                  <th className="sortable-header" onClick={() => handleSort('status')}>Status{sortArrow('status')}</th>
                  <th className="sortable-header" onClick={() => handleSort('next_contact_due_at')}>Next Follow-up{sortArrow('next_contact_due_at')}</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((contact) => (
                  <tr key={contact.id}>
                    <td>
                      <Link to={`/contacts/${contact.id}`} className="contact-name">
                        {contact.first_name} {contact.last_name}
                      </Link>
                    </td>
                    <td>{contact.company_name || '-'}</td>
                    <td>
                      <span className="owner-badge" title={contact.owner_email}>
                        {contact.owner_full_name}
                      </span>
                    </td>
                    <td>
                      <span className="owner-badge" title={contact.created_by_email}>
                        {contact.created_by_full_name}
                      </span>
                    </td>
                    <td>{fmtDate(fromServer(contact.created_at))}</td>
                    <td>
                      {contact.contact_details.filter((d: { type: string }) => d.type === 'email').length > 0
                        ? contact.contact_details.filter((d: { type: string }) => d.type === 'email').map((d: { value: string }) => d.value).join(', ')
                        : '-'}
                    </td>
                    <td>
                      {contact.contact_details.filter((d: { type: string }) => d.type === 'phone').length > 0
                        ? contact.contact_details.filter((d: { type: string }) => d.type === 'phone').map((d: { value: string }) => d.value).join(', ')
                        : '-'}
                    </td>
                    <td>
                      <span className="status-badge">{contact.current_relationship_status}</span>
                    </td>
                    <td>
                      {contact.next_contact_due_at
                        ? fmtDate(fromServer(contact.next_contact_due_at))
                        : '-'}
                    </td>
                    <td>
                      <div className="table-actions">
                        <Link to={`/contacts/${contact.id}`} className="btn-link-small">
                          View
                        </Link>
                        <Link to={`/contacts/${contact.id}?edit=true`} className="btn-link-small">
                          Edit
                        </Link>
                        {canDelete(contact) && (
                          <button
                            onClick={() => handleDelete(contact)}
                            className="btn-link-small btn-danger-link"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && total > 0 && (
          <div className="pagination">
            <span className="pagination-info">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
            </span>
            <div className="pagination-controls">
              <button
                className="btn-link-small"
                disabled={page <= 1}
                onClick={() => goToPage(page - 1)}
              >
                ← Previous
              </button>
              <span className="pagination-page">
                Page {page} of {totalPages}
              </span>
              <button
                className="btn-link-small"
                disabled={page >= totalPages}
                onClick={() => goToPage(page + 1)}
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};
