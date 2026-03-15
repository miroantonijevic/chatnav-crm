/**
 * Contacts list page
 */
import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { MainLayout } from '../layouts/MainLayout';
import { fromServer, fmtDate } from '../utils/dates';
import { contactApi } from '../api';
import { Contact, RelationshipStatus } from '../types';
import { useAuth } from '../contexts/AuthContext';
import './Contacts.css';

export const ContactsListPage: React.FC = () => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();

  const search = searchParams.get('search') || '';
  const status = searchParams.get('status') || '';
  const dueOnly = searchParams.get('due_only') === 'true';

  useEffect(() => {
    loadContacts();
  }, [search, status, dueOnly]);

  const loadContacts = async () => {
    setLoading(true);
    try {
      const data = await contactApi.list({
        search: search || undefined,
        status: status || undefined,
        due_only: dueOnly,
      });
      setContacts(data);
    } catch (error) {
      console.error('Failed to load contacts:', error);
    } finally {
      setLoading(false);
    }
  };

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

  const handleDelete = async (contact: Contact) => {
    if (!confirm(`Are you sure you want to delete ${contact.first_name} ${contact.last_name}?`)) return;

    try {
      await contactApi.delete(contact.id);
      // Reload contacts after deletion
      loadContacts();
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
                  <th>Name</th>
                  <th>Company</th>
                  <th>Relationship Owner</th>
                  <th>Created By</th>
                  <th>Emails</th>
                  <th>Phones</th>
                  <th>Status</th>
                  <th>Next Follow-up</th>
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
      </div>
    </MainLayout>
  );
};
