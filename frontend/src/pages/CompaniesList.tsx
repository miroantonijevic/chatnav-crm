/**
 * Companies list page
 */
import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { MainLayout } from '../layouts/MainLayout';
import { fmtDateTime, fromServer } from '../utils/dates';
import { companyApi } from '../api';
import { Company, RelationshipStatus } from '../types';
import { useAuth } from '../contexts/AuthContext';
import './Contacts.css';

const STATUS_LABELS: Record<string, string> = {
  new: 'New',
  contacted: 'Contacted',
  'follow-up-needed': 'Follow-up needed',
  interested: 'Interested',
  'not-interested': 'Not interested',
  customer: 'Customer',
  inactive: 'Inactive',
};

export const CompaniesListPage: React.FC = () => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();

  const search = searchParams.get('search') || '';

  useEffect(() => {
    loadCompanies();
  }, [search]);

  const loadCompanies = async () => {
    setLoading(true);
    try {
      const data = await companyApi.list({ search: search || undefined });
      setCompanies(data);
    } catch (error) {
      console.error('Failed to load companies:', error);
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

  const handleDelete = async (company: Company) => {
    if (!confirm(`Are you sure you want to delete ${company.name}?`)) return;
    try {
      await companyApi.delete(company.id);
      loadCompanies();
    } catch (error: any) {
      alert(error.message || 'Failed to delete company');
    }
  };

  const canDelete = (company: Company) => {
    return user?.role === 'admin' || company.owner_user_id === user?.id;
  };

  const getDetailsByType = (company: Company, type: string) => {
    const items = company.contact_details.filter((d) => d.type === type);
    if (items.length === 0) return '-';
    return items.map((d) => (d.label ? `${d.value} (${d.label})` : d.value)).join(', ');
  };

  return (
    <MainLayout>
      <div className="contacts-page">
        <div className="page-header">
          <h1>Companies</h1>
          <Link to="/companies/new" className="btn-primary-inline">
            + New Company
          </Link>
        </div>

        <div className="filters">
          <input
            type="text"
            placeholder="Search companies..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="search-input"
          />
        </div>

        {loading ? (
          <div className="loading">Loading companies...</div>
        ) : companies.length === 0 ? (
          <div className="empty-message">
            <p>No companies found.</p>
            <Link to="/companies/new">Create your first company</Link>
          </div>
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
                  <th>Next Follow-up</th>
                  <th>Websites</th>
                  <th>Phones</th>
                  <th>Emails</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {companies.map((company) => (
                  <tr key={company.id}>
                    <td>
                      <Link to={`/companies/${company.id}`} className="contact-name">
                        {company.name}
                      </Link>
                    </td>
                    <td>{company.industry || '-'}</td>
                    <td>
                      <span className="owner-badge" title={company.owner_email}>
                        {company.owner_full_name}
                      </span>
                    </td>
                    <td>
                      <span className="owner-info" title={company.created_by_email}>
                        {company.created_by_full_name || '-'}
                      </span>
                    </td>
                    <td>
                      <span className="status-badge">
                        {STATUS_LABELS[company.current_relationship_status] ?? company.current_relationship_status}
                      </span>
                    </td>
                    <td>
                      {company.next_contact_due_at
                        ? fmtDateTime(fromServer(company.next_contact_due_at))
                        : '-'}
                    </td>
                    <td>{getDetailsByType(company, 'website')}</td>
                    <td>{getDetailsByType(company, 'phone')}</td>
                    <td>{getDetailsByType(company, 'email')}</td>
                    <td>
                      <div className="table-actions">
                        <Link to={`/companies/${company.id}`} className="btn-link-small">
                          View
                        </Link>
                        <Link to={`/companies/${company.id}?edit=true`} className="btn-link-small">
                          Edit
                        </Link>
                        {canDelete(company) && (
                          <button
                            onClick={() => handleDelete(company)}
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
