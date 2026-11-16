/**
 * Contacts list page
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { MainLayout } from '../layouts/MainLayout';
import { contactApi } from '../api';
import { Contact, EntityStats, RelationshipStatus } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useConfirm, useToast } from '../contexts/UiContext';
import { useListParams } from '../hooks/useListParams';
import { usePageTitle } from '../hooks/usePageTitle';
import { useScrollRestoration } from '../utils/useScrollRestoration';
import { fromServer, fmtDate } from '../utils/dates';
import { STATUS_LABELS, detailPath } from '../utils/pipeline';
import { HotBadge } from '../components/HotToggle';
import { Pagination } from '../components/Pagination';
import { ContactLinks, FollowUpBadge } from '../components/EntityBits';
import { Alert, EmptyState, Person, RowMenu, SearchBox, StatusBadge, TableSkeleton } from '../components/ui';
import '../styles/lists.css';

export const ContactsListPage: React.FC = () => {
  usePageTitle('Contacts');
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const list = useListParams();
  const { params, setParam, search, page, pageSize, sortBy, sortOrder } = list;

  const status = (Object.values(RelationshipStatus) as string[]).includes(params.get('status') ?? '') ? params.get('status')! : '';
  const dueOnly = params.get('due_only') === 'true';
  const upcomingOnly = params.get('upcoming_only') === 'true';

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<EntityStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const reqRef = useRef(0);
  useScrollRestoration('scroll:contacts', !loading);

  const load = useCallback(async () => {
    const id = ++reqRef.current;
    setRefreshing(true);
    try {
      const data = await contactApi.list({
        search: search || undefined,
        status: status || undefined,
        due_only: dueOnly,
        upcoming_only: upcomingOnly,
        skip: (page - 1) * pageSize,
        limit: pageSize,
        sort_by: sortBy || undefined,
        sort_order: sortOrder,
      });
      if (id !== reqRef.current) return;
      setContacts(data.items);
      setTotal(data.total);
      setError('');
      if (data.items.length === 0 && data.total > 0 && page > 1) setParam({ page: String(Math.ceil(data.total / pageSize)) }, true);
    } catch (err: any) {
      if (id === reqRef.current) setError(err.message || 'Failed to load contacts');
    } finally {
      if (id === reqRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [search, status, dueOnly, upcomingOnly, page, pageSize, sortBy, sortOrder, setParam]);

  const loadStats = useCallback(async () => {
    try {
      setStats(await contactApi.getStats());
    } catch (err) {
      console.error('Failed to load contact stats:', err);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const hasFilters = Boolean(search || status || dueOnly || upcomingOnly);
  const canDelete = (c: Contact) => user?.role === 'admin' || c.owner_user_id === user?.id;

  const handleDelete = async (c: Contact) => {
    const ok = await confirm({
      title: 'Delete contact?',
      message: <>{c.first_name} {c.last_name} will be removed from your lists. Their history is kept.</>,
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await contactApi.delete(c.id);
      toast(`${c.first_name} ${c.last_name} deleted`);
      load();
      loadStats();
    } catch (err: any) {
      toast(err.message || 'Failed to delete contact', 'error');
    }
  };

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
            <h1 className="page-title">Contacts</h1>
            <p className="page-sub">{stats ? `${stats.total} people you are in touch with` : 'People you are in touch with'}</p>
          </div>
          <div className="page-actions">
            <Link to="/contacts/new" className="btn btn-primary btn-lg">+ New contact</Link>
          </div>
        </div>

        {stats && (
          <div className="stat-row" role="group" aria-label="Filter by status">
            <button type="button" className={`stat-pill${!status && !dueOnly && !upcomingOnly ? ' active' : ''}`} onClick={() => setParam({ status: null, due_only: null, upcoming_only: null })}>
              <strong>{stats.total}</strong> All
            </button>
            <button type="button" className={`stat-pill is-warn${dueOnly ? ' active' : ''}`} onClick={() => setParam({ due_only: dueOnly ? null : 'true', upcoming_only: null })}>
              <strong>{stats.due_now}</strong> Needs follow-up
            </button>
            {Object.values(RelationshipStatus).map((s) => (
              <button key={s} type="button" className={`stat-pill${status === s ? ' active' : ''}`} onClick={() => setParam({ status: status === s ? null : s })}>
                <strong>{stats.by_status[s] ?? 0}</strong> {STATUS_LABELS[s] ?? s}
              </button>
            ))}
          </div>
        )}

        <div className="filters">
          <SearchBox value={list.searchText} onChange={list.setSearchText} placeholder="Search name, company, owner, e-mail, notes…" label="Search contacts" />
          {hasFilters && <button type="button" className="link-btn" onClick={list.clearFilters}>Clear filters</button>}
        </div>

        {error && <Alert tone="error">{error}</Alert>}

        {loading ? (
          <TableSkeleton />
        ) : contacts.length === 0 ? (
          hasFilters ? (
            <EmptyState compact title="No contacts match" action={<button type="button" className="btn" onClick={list.clearFilters}>Clear filters</button>}>
              Try a different search or remove a filter.
            </EmptyState>
          ) : (
            <EmptyState icon="👤" title="No contacts yet" action={<Link to="/contacts/new" className="btn btn-primary btn-lg">+ Add your first contact</Link>}>
              Contacts are the people you work with. Add one to start tracking conversations and follow-ups.
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
                      <Th k="company">Company</Th>
                      <th>Contact</th>
                      <Th k="status">Status</Th>
                      <Th k="next_contact_due_at">Follow-up</Th>
                      <Th k="owner">Owner</Th>
                      <Th k="created_at">Created</Th>
                      <th aria-label="Actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {contacts.map((c) => (
                      <tr key={c.id}>
                        <td>
                          <div className="name-cell">
                            <Link to={detailPath('contact', c.id)} className="row-link">{c.first_name} {c.last_name}</Link>
                            {c.is_hot && <HotBadge size="sm" />}
                          </div>
                          {c.job_title && <div className="cell-sub">{c.job_title}</div>}
                        </td>
                        <td>
                          {c.company_id && c.company_name ? <Link to={`/companies/${c.company_id}`}>{c.company_name}</Link> : <span className="faint">—</span>}
                        </td>
                        <td>
                          <ContactLinks
                            emails={[...(c.email ? [c.email] : []), ...c.contact_details.filter((d) => d.type === 'email').map((d) => d.value)].filter((v, i, a) => a.indexOf(v) === i)}
                            phones={[...(c.phone ? [c.phone] : []), ...c.contact_details.filter((d) => d.type === 'phone').map((d) => d.value)].filter((v, i, a) => a.indexOf(v) === i)}
                          />
                        </td>
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
                              { label: 'Open', to: detailPath('contact', c.id) },
                              { label: 'Edit', to: `${detailPath('contact', c.id)}?edit=true` },
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
