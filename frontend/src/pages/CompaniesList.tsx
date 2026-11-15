/**
 * Companies list page
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { MainLayout } from '../layouts/MainLayout';
import { companyApi } from '../api';
import { Company, EntityStats, RelationshipStatus } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useConfirm, useToast } from '../contexts/UiContext';
import { useListParams } from '../hooks/useListParams';
import { usePageTitle } from '../hooks/usePageTitle';
import { useScrollRestoration } from '../utils/useScrollRestoration';
import { fromServer, fmtDate } from '../utils/dates';
import { STATUS_LABELS, detailPath } from '../utils/pipeline';
import { PriorityBadge } from '../components/PriorityBadge';
import { Pagination } from '../components/Pagination';
import { ContactLinks, FollowUpBadge } from '../components/EntityBits';
import { Alert, EmptyState, Person, RowMenu, SearchBox, StatusBadge, TableSkeleton } from '../components/ui';
import '../styles/lists.css';

export const CompaniesListPage: React.FC = () => {
  usePageTitle('Companies');
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const list = useListParams();
  const { params, setParam, search, page, pageSize, sortBy, sortOrder } = list;
  const dueOnly = params.get('due_only') === 'true';

  const [companies, setCompanies] = useState<Company[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<EntityStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const reqRef = useRef(0);
  useScrollRestoration('scroll:companies', !loading);

  const load = useCallback(async () => {
    const id = ++reqRef.current;
    setRefreshing(true);
    try {
      const data = await companyApi.list({
        search: search || undefined,
        due_only: dueOnly,
        skip: (page - 1) * pageSize,
        limit: pageSize,
        sort_by: sortBy || undefined,
        sort_order: sortOrder,
      });
      if (id !== reqRef.current) return;
      setCompanies(data.items);
      setTotal(data.total);
      setError('');
      if (data.items.length === 0 && data.total > 0 && page > 1) setParam({ page: String(Math.ceil(data.total / pageSize)) }, true);
    } catch (err: any) {
      if (id === reqRef.current) setError(err.message || 'Failed to load companies');
    } finally {
      if (id === reqRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [search, dueOnly, page, pageSize, sortBy, sortOrder, setParam]);

  const loadStats = useCallback(async () => {
    try {
      setStats(await companyApi.getStats());
    } catch (err) {
      console.error('Failed to load company stats:', err);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const hasFilters = Boolean(search || dueOnly);
  const canDelete = (c: Company) => user?.role === 'admin' || c.owner_user_id === user?.id;

  const handleDelete = async (c: Company) => {
    const ok = await confirm({
      title: 'Delete company?',
      message: <>{c.name} will be removed from your lists. Its history is kept.</>,
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await companyApi.delete(c.id);
      toast(`${c.name} deleted`);
      load();
      loadStats();
    } catch (err: any) {
      toast(err.message || 'Failed to delete company', 'error');
    }
  };

  const detailValues = (c: Company, type: string) => c.contact_details.filter((d) => d.type === type).map((d) => d.value);

  const Th: React.FC<{ k: string; children: React.ReactNode }> = ({ k, children }) => (
    <th className="sortable" aria-sort={list.ariaSort(k)} onClick={() => list.toggleSort(k)}>
      {children}{list.sortIndicator(k)}
    </th>
  );

  return (
    <MainLayout>
      <div className="page">
        <div className="page-header">
          <div>
            <h1 className="page-title">Companies</h1>
            <p className="page-sub">{stats ? `${stats.total} organisations you work with` : 'Organisations you work with'}</p>
          </div>
          <div className="page-actions">
            <Link to="/companies/new" className="btn btn-primary btn-lg">+ New company</Link>
          </div>
        </div>

        {stats && (
          <div className="stat-row" role="group" aria-label="Summary">
            <button type="button" className={`stat-pill${!dueOnly ? ' active' : ''}`} onClick={() => setParam({ due_only: null })}>
              <strong>{stats.total}</strong> All
            </button>
            <button type="button" className={`stat-pill is-warn${dueOnly ? ' active' : ''}`} onClick={() => setParam({ due_only: dueOnly ? null : 'true' })}>
              <strong>{stats.due_now}</strong> Needs follow-up
            </button>
            {Object.values(RelationshipStatus).map((s) => (
              <span key={s} className="stat-pill static">
                <strong>{stats.by_status[s] ?? 0}</strong> {STATUS_LABELS[s] ?? s}
              </span>
            ))}
          </div>
        )}

        <div className="filters">
          <SearchBox value={list.searchText} onChange={list.setSearchText} placeholder="Search name, industry, owner, contact details, notes…" label="Search companies" />
          {hasFilters && <button type="button" className="link-btn" onClick={list.clearFilters}>Clear filters</button>}
        </div>

        {error && <Alert tone="error">{error}</Alert>}

        {loading ? (
          <TableSkeleton />
        ) : companies.length === 0 ? (
          hasFilters ? (
            <EmptyState compact title="No companies match" action={<button type="button" className="btn" onClick={list.clearFilters}>Clear filters</button>}>
              Try a different search or remove a filter.
            </EmptyState>
          ) : (
            <EmptyState icon="🏢" title="No companies yet" action={<Link to="/companies/new" className="btn btn-primary btn-lg">+ Add your first company</Link>}>
              Companies group your contacts and let you track a deal with a whole organisation.
            </EmptyState>
          )
        ) : (
          <>
            <div className={`card table-card${refreshing ? ' is-refreshing' : ''}`}>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <Th k="name">Name</Th>
                      <th>Contact</th>
                      <Th k="status">Status</Th>
                      <Th k="next_contact_due_at">Follow-up</Th>
                      <Th k="owner">Owner</Th>
                      <Th k="created_at">Created</Th>
                      <th aria-label="Actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {companies.map((c) => (
                      <tr key={c.id}>
                        <td>
                          <div className="name-cell">
                            <Link to={detailPath('company', c.id)} className="row-link">{c.name}</Link>
                            {c.priority && <PriorityBadge value={c.priority} size="sm" />}
                          </div>
                          {c.industry && <div className="cell-sub">{c.industry}</div>}
                        </td>
                        <td><ContactLinks emails={detailValues(c, 'email')} phones={detailValues(c, 'phone')} /></td>
                        <td><StatusBadge status={c.current_relationship_status} /></td>
                        <td><FollowUpBadge value={c.next_contact_due_at} /></td>
                        <td><Person name={c.owner_full_name} title={c.owner_email} firstNameOnly /></td>
                        <td>
                          <div className="nowrap">{fmtDate(fromServer(c.created_at))}</div>
                          {c.created_by_full_name && <div className="cell-sub">by {c.created_by_full_name.split(' ')[0]}</div>}
                        </td>
                        <td className="right">
                          <RowMenu
                            actions={[
                              { label: 'Open', to: detailPath('company', c.id) },
                              { label: 'Edit', to: `${detailPath('company', c.id)}?edit=true` },
                              { label: 'Delete', onClick: () => handleDelete(c), danger: true, hidden: !canDelete(c) },
                            ]}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <Pagination
              page={page}
              pageSize={pageSize}
              total={total}
              pageSizeOptions={list.pageSizes}
              onPageChange={(p) => setParam({ page: p > 1 ? String(p) : null })}
              onPageSizeChange={(s) => setParam({ size: s === 25 ? null : String(s) })}
            />
          </>
        )}
      </div>
    </MainLayout>
  );
};
