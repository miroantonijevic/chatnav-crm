/**
 * Dashboard page
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MainLayout } from '../layouts/MainLayout';
import { contactApi, reminderApi } from '../api';
import { Contact, ReminderStats } from '../types';
import './Dashboard.css';

export const DashboardPage: React.FC = () => {
  const [dueContacts, setDueContacts] = useState<Contact[]>([]);
  const [upcomingContacts, setUpcomingContacts] = useState<Contact[]>([]);
  const [reminderStats, setReminderStats] = useState<ReminderStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [dueContactsData, upcomingContactsData, stats] = await Promise.all([
        contactApi.list({ due_only: true, limit: 10 }),
        contactApi.list({ upcoming_only: true, limit: 10 }),
        reminderApi.getStats(),
      ]);
      setDueContacts(dueContactsData);
      setUpcomingContacts(upcomingContactsData);
      setReminderStats(stats);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="loading">Loading dashboard...</div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="dashboard">
        <h1>Dashboard</h1>

        <div className="stats-grid">
          <div className="stat-card">
            <h3>Due Now</h3>
            <div className="stat-value">{reminderStats?.due_now || 0}</div>
            <p>Contacts needing follow-up</p>
          </div>

          <div className="stat-card">
            <h3>Upcoming (7 days)</h3>
            <div className="stat-value">{reminderStats?.upcoming_7_days || 0}</div>
            <p>Contacts with upcoming follow-ups</p>
          </div>
        </div>

        <div className="section">
          <div className="section-header">
            <h2>Needs Attention Now</h2>
            <Link to="/contacts?due_only=true" className="btn-link">View All</Link>
          </div>

          {dueContacts.length === 0 ? (
            <p className="empty-message">No overdue or due follow-ups at this time. Great job!</p>
          ) : (
            <div className="contacts-table">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Company</th>
                    <th>Contact Owner</th>
                    <th>Created By</th>
                    <th>Status</th>
                    <th>Due Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {dueContacts.map((contact) => (
                    <tr key={contact.id}>
                      <td>
                        {contact.first_name} {contact.last_name}
                      </td>
                      <td>{contact.company || '-'}</td>
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
                        <span className="status-badge">{contact.current_relationship_status}</span>
                      </td>
                      <td>
                        {contact.next_contact_due_at
                          ? new Date(contact.next_contact_due_at).toLocaleString()
                          : '-'}
                      </td>
                      <td>
                        <Link to={`/contacts/${contact.id}`} className="btn-link-small">
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="section">
          <div className="section-header">
            <h2>Upcoming Follow-ups</h2>
            <Link to="/contacts" className="btn-link">View All Contacts</Link>
          </div>

          {upcomingContacts.length === 0 ? (
            <p className="empty-message">No upcoming follow-ups scheduled.</p>
          ) : (
            <div className="contacts-table">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Company</th>
                    <th>Contact Owner</th>
                    <th>Created By</th>
                    <th>Status</th>
                    <th>Scheduled For</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {upcomingContacts.map((contact) => (
                    <tr key={contact.id}>
                      <td>
                        {contact.first_name} {contact.last_name}
                      </td>
                      <td>{contact.company || '-'}</td>
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
                        <span className="status-badge">{contact.current_relationship_status}</span>
                      </td>
                      <td>
                        {contact.next_contact_due_at
                          ? new Date(contact.next_contact_due_at).toLocaleString()
                          : '-'}
                      </td>
                      <td>
                        <Link to={`/contacts/${contact.id}`} className="btn-link-small">
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
};
