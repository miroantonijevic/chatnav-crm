/**
 * Dashboard page
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MainLayout } from '../layouts/MainLayout';
import { fromServer, fmtDateTime } from '../utils/dates';
import { contactApi, companyApi, reminderApi } from '../api';
import { Contact, Company, ReminderStats } from '../types';
import './Dashboard.css';

export const DashboardPage: React.FC = () => {
  const [dueContacts, setDueContacts] = useState<Contact[]>([]);
  const [upcomingContacts, setUpcomingContacts] = useState<Contact[]>([]);
  const [dueCompanies, setDueCompanies] = useState<Company[]>([]);
  const [upcomingCompanies, setUpcomingCompanies] = useState<Company[]>([]);
  const [reminderStats, setReminderStats] = useState<ReminderStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [dueContactsData, upcomingContactsData, dueCompaniesData, upcomingCompaniesData, stats] = await Promise.all([
        contactApi.list({ due_only: true, limit: 10 }),
        contactApi.list({ upcoming_only: true, limit: 10 }),
        companyApi.list({ due_only: true, limit: 10 }),
        companyApi.list({ upcoming_only: true, limit: 10 }),
        reminderApi.getStats(),
      ]);
      setDueContacts(dueContactsData);
      setUpcomingContacts(upcomingContactsData);
      setDueCompanies(dueCompaniesData);
      setUpcomingCompanies(upcomingCompaniesData);
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
            <h3>Contacts Due Now</h3>
            <div className="stat-value">{reminderStats?.due_now || 0}</div>
            <p>Contacts needing follow-up</p>
          </div>

          <div className="stat-card">
            <h3>Contacts Upcoming (7 days)</h3>
            <div className="stat-value">{reminderStats?.upcoming_7_days || 0}</div>
            <p>Contacts with upcoming follow-ups</p>
          </div>

          <div className="stat-card">
            <h3>Companies Due Now</h3>
            <div className="stat-value">{reminderStats?.companies_due_now || 0}</div>
            <p>Companies needing follow-up</p>
          </div>

          <div className="stat-card">
            <h3>Companies Upcoming (7 days)</h3>
            <div className="stat-value">{reminderStats?.companies_upcoming_7_days || 0}</div>
            <p>Companies with upcoming follow-ups</p>
          </div>
        </div>

        {/* Contacts needing attention */}
        <div className="section">
          <div className="section-header">
            <h2>Contacts Needing Attention</h2>
            <Link to="/contacts?due_only=true" className="btn-link">View All</Link>
          </div>

          {dueContacts.length === 0 ? (
            <p className="empty-message">No overdue or due contact follow-ups at this time. Great job!</p>
          ) : (
            <div className="contacts-table">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Company</th>
                    <th>Relationship Owner</th>
                    <th>Created By</th>
                    <th>Status</th>
                    <th>Due Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {dueContacts.map((contact) => (
                    <tr key={contact.id}>
                      <td>{contact.first_name} {contact.last_name}</td>
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
                        <span className="status-badge">{contact.current_relationship_status}</span>
                      </td>
                      <td>
                        {contact.next_contact_due_at
                          ? fmtDateTime(fromServer(contact.next_contact_due_at))
                          : '-'}
                      </td>
                      <td>
                        <Link to={`/contacts/${contact.id}`} className="btn-link-small">View</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Companies needing attention */}
        <div className="section">
          <div className="section-header">
            <h2>Companies Needing Attention</h2>
            <Link to="/companies" className="btn-link">View All</Link>
          </div>

          {dueCompanies.length === 0 ? (
            <p className="empty-message">No overdue or due company follow-ups at this time. Great job!</p>
          ) : (
            <div className="contacts-table">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Industry</th>
                    <th>Relationship Owner</th>
                    <th>Created By</th>
                    <th>Status</th>
                    <th>Due Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {dueCompanies.map((company: Company) => (
                    <tr key={company.id}>
                      <td>{company.name}</td>
                      <td>{company.industry || '-'}</td>
                      <td>
                        <span className="owner-badge" title={company.owner_email}>
                          {company.owner_full_name}
                        </span>
                      </td>
                      <td>
                        <span className="owner-badge" title={company.created_by_email}>
                          {company.created_by_full_name}
                        </span>
                      </td>
                      <td>
                        <span className="status-badge">{company.current_relationship_status}</span>
                      </td>
                      <td>
                        {company.next_contact_due_at
                          ? fmtDateTime(fromServer(company.next_contact_due_at))
                          : '-'}
                      </td>
                      <td>
                        <Link to={`/companies/${company.id}`} className="btn-link-small">View</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Upcoming contact follow-ups */}
        <div className="section">
          <div className="section-header">
            <h2>Upcoming Contact Follow-ups</h2>
            <Link to="/contacts" className="btn-link">View All Contacts</Link>
          </div>

          {upcomingContacts.length === 0 ? (
            <p className="empty-message">No upcoming contact follow-ups scheduled.</p>
          ) : (
            <div className="contacts-table">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Company</th>
                    <th>Relationship Owner</th>
                    <th>Created By</th>
                    <th>Status</th>
                    <th>Scheduled For</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {upcomingContacts.map((contact) => (
                    <tr key={contact.id}>
                      <td>{contact.first_name} {contact.last_name}</td>
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
                        <span className="status-badge">{contact.current_relationship_status}</span>
                      </td>
                      <td>
                        {contact.next_contact_due_at
                          ? fmtDateTime(fromServer(contact.next_contact_due_at))
                          : '-'}
                      </td>
                      <td>
                        <Link to={`/contacts/${contact.id}`} className="btn-link-small">View</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Upcoming company follow-ups */}
        <div className="section">
          <div className="section-header">
            <h2>Upcoming Company Follow-ups</h2>
            <Link to="/companies" className="btn-link">View All Companies</Link>
          </div>

          {upcomingCompanies.length === 0 ? (
            <p className="empty-message">No upcoming company follow-ups scheduled.</p>
          ) : (
            <div className="contacts-table">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Industry</th>
                    <th>Relationship Owner</th>
                    <th>Created By</th>
                    <th>Status</th>
                    <th>Scheduled For</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {upcomingCompanies.map((company: Company) => (
                    <tr key={company.id}>
                      <td>{company.name}</td>
                      <td>{company.industry || '-'}</td>
                      <td>
                        <span className="owner-badge" title={company.owner_email}>
                          {company.owner_full_name}
                        </span>
                      </td>
                      <td>
                        <span className="owner-badge" title={company.created_by_email}>
                          {company.created_by_full_name}
                        </span>
                      </td>
                      <td>
                        <span className="status-badge">{company.current_relationship_status}</span>
                      </td>
                      <td>
                        {company.next_contact_due_at
                          ? fmtDateTime(fromServer(company.next_contact_due_at))
                          : '-'}
                      </td>
                      <td>
                        <Link to={`/companies/${company.id}`} className="btn-link-small">View</Link>
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
