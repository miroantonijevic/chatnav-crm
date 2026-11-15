/**
 * Pipeline ("hot list") - companies and contacts being actively worked, in one list.
 *
 * All filtering, searching, sorting and paging happens on the server, and every
 * control lives in the URL, so views are shareable and survive a refresh.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { MainLayout } from '../layouts/MainLayout';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/UiContext';
import { usePageTitle } from '../hooks/usePageTitle';
import { pipelineApi, userApi } from '../api';
import {
  DealStage,
  EntityType,
  PipelineItem,
  PipelineQuery,
  PipelineSummary,
  PipelineUpdate,
  Priority,
  RelationshipStatus,
  User,
  WaitingOn,
} from '../types';
import { PriorityPicker } from '../components/PriorityBadge';
import { Pagination } from '../components/Pagination';
import { FavoriteStar } from '../components/FavoriteStar';
import { EmptyState, SearchBox, TableSkeleton } from '../components/ui';
import { DealCell, FollowUpCell, NextActionCell, ValueCell } from '../components/PipelineCells';
import { AddToPipelineModal, ContactedModal } from '../components/PipelineDialogs';
import { useScrollRestoration } from '../utils/useScrollRestoration';
import {
  PRIORITY_META,
  PRIORITY_ORDER,
  STAGE_META,
  STAGE_ORDER,
  STATUS_LABELS,
  WAITING_META,
  detailPath,
  formatMoney,
  initials,
  lastContactInfo,
} from '../utils/pipeline';
import '../components/Pipeline.css';

const PAGE_SIZES = [25, 50, 100];
const DEFAULT_PAGE_SIZE = 25;
const DUE_OPTIONS = ['overdue', 'week', 'none'] as const;
type Due = (typeof DUE_OPTIONS)[number];

const SORT_KEYS = ['priority', 'name', 'stage', 'due', 'value', 'last_contacted', 'owner', 'status'];

const itemKey = (i: Pick<PipelineItem, 'entity_type' | 'id'>) => `${i.entity_type}-${i.id}`;

export const PipelinePage: React.FC = () => {
  usePageTitle('Hot list');
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();

  // ── URL-backed filter state ──────────────────────────────────────────
  const q = params.get('q') ?? '';
  const typeParam = params.get('type');
  const type: EntityType | undefined = typeParam === 'company' || typeParam === 'contact' ? typeParam : undefined;
  const priorityParam = params.get('priority');
  const priority = (Object.values(Priority) as string[]).includes(priorityParam ?? '')
    ? (priorityParam as Priority)
    : undefined;
  const statusParam = params.get('status') ?? '';
  const status = (Object.values(RelationshipStatus) as string[]).includes(statusParam) ? statusParam : '';
  const ownerParam = Number(params.get('owner'));
  const owner = Number.isInteger(ownerParam) && ownerParam > 0 ? ownerParam : undefined;
  const dueParam = params.get('due');
  const due: Due | undefined = (DUE_OPTIONS as readonly string[]).includes(dueParam ?? '') ? (dueParam as Due) : undefined;
  const stageParam = params.get('stage') ?? '';
  const stage = (Object.values(DealStage) as string[]).includes(stageParam) ? (stageParam as DealStage) : undefined;
  const waitingParam = params.get('waiting');
  const waiting: WaitingOn | undefined = waitingParam === 'client' || waitingParam === 'us' ? waitingParam : undefined;
  const favorites = params.get('fav') === '1';
  const sort = SORT_KEYS.includes(params.get('sort') ?? '') ? (params.get('sort') as string) : '';
  const order: 'asc' | 'desc' = params.get('order') === 'desc' ? 'desc' : 'asc';
  const sizeParam = Number(params.get('size'));
  const pageSize = PAGE_SIZES.includes(sizeParam) ? sizeParam : DEFAULT_PAGE_SIZE;
  const page = Math.max(1, parseInt(params.get('page') || '1', 10) || 1);

  /** Update URL params. Any change other than paging itself resets to page 1. */
  const setParam = useCallback(
    (updates: Record<string, string | null>, replace = false) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [k, v] of Object.entries(updates)) {
            if (v === null || v === '') next.delete(k);
            else next.set(k, v);
          }
          if (!('page' in updates)) next.delete('page');
          return next;
        },
        { replace }
      );
    },
    [setParams]
  );

  // ── data ─────────────────────────────────────────────────────────────
  const [items, setItems] = useState<PipelineItem[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<PipelineSummary | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const reqRef = useRef(0);

  const query: PipelineQuery = useMemo(
    () => ({
      search: q || undefined,
      entity_type: type,
      priority: priority ? [priority] : undefined,
      status: status || undefined,
      owner_id: owner,
      due,
      stage,
      waiting_on: waiting,
      favorites: favorites || undefined,
      sort_by: sort || undefined,
      sort_order: order,
      skip: (page - 1) * pageSize,
      limit: pageSize,
    }),
    [q, type, priority, status, owner, due, stage, waiting, favorites, sort, order, page, pageSize]
  );

  const load = useCallback(
    async (silent = false) => {
      const id = ++reqRef.current;
      if (!silent) setRefreshing(true);
      try {
        const [list, sum] = await Promise.all([pipelineApi.list(query), pipelineApi.summary(query)]);
        if (id !== reqRef.current) return; // a newer request superseded this one
        setItems(list.items);
        setTotal(list.total);
        setSummary(sum);
        setError('');
        // The page may no longer exist (e.g. after removing the last item on it)
        if (list.items.length === 0 && list.total > 0 && page > 1) {
          setParam({ page: String(Math.ceil(list.total / pageSize)) }, true);
        }
      } catch (err: any) {
        if (id === reqRef.current) setError(err.message || 'Failed to load hot list');
      } finally {
        if (id === reqRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [query, page, pageSize, setParam]
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    userApi.list().then(setUsers).catch(() => undefined);
  }, []);

  useScrollRestoration('scroll:pipeline', !loading);

  // ── search box (debounced, kept in sync with the URL) ────────────────
  const [searchText, setSearchText] = useState(q);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSearchText(q);
  }, [q]);

  useEffect(() => {
    if (searchText.trim() === q) return;
    const t = setTimeout(() => setParam({ q: searchText.trim() || null }, true), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchText]);

  // "/" focuses the search box
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || el.isContentEditable) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const showToast = useToast();

  // ── mutations (optimistic, with rollback) ────────────────────────────
  const applyUpdate = useCallback(
    async (item: PipelineItem, patch: PipelineUpdate, message: string, undo?: PipelineUpdate) => {
      const k = itemKey(item);
      const defined = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
      const optimistic: PipelineItem = { ...item, ...defined };
      const removed = patch.priority === null && !favorites; // leaves the list unless viewing favourites
      setItems((prev) => (removed ? prev.filter((i) => itemKey(i) !== k) : prev.map((i) => (itemKey(i) === k ? optimistic : i))));
      if (removed) setTotal((t) => Math.max(0, t - 1));

      try {
        const saved = await pipelineApi.update(item.entity_type, item.id, patch);
        if (!removed) setItems((prev) => prev.map((i) => (itemKey(i) === k ? saved : i)));
        showToast(
          message,
          'success',
          undo ? { label: 'Undo', run: () => applyUpdate(saved, undo, 'Change undone') } : undefined
        );
        load(true); // refresh counts and values, and refill/re-sort the page in the background
      } catch (err: any) {
        setItems((prev) => (removed ? [item, ...prev] : prev.map((i) => (itemKey(i) === k ? item : i))));
        if (removed) setTotal((t) => t + 1);
        showToast(err.message || 'Could not save the change', 'error');
      }
    },
    [favorites, load, showToast]
  );

  const changePriority = (item: PipelineItem, next: Priority | null) => {
    const label = next ? `${item.name} is now ${PRIORITY_META[next].label.toLowerCase()}` : `${item.name} removed from the hot list`;
    applyUpdate(item, { priority: next }, label, { priority: item.priority ?? null });
  };

  /** Patch several deal fields at once; undo restores their previous values. */
  const changeDeal = (item: PipelineItem, patch: PipelineUpdate, message: string) => {
    const undo: PipelineUpdate = {};
    if ('deal_stage' in patch) undo.deal_stage = item.deal_stage ?? null;
    if ('waiting_on' in patch) undo.waiting_on = item.waiting_on ?? null;
    if ('deal_value' in patch || 'deal_value_period' in patch) {
      undo.deal_value = item.deal_value ?? null;
      undo.deal_value_period = item.deal_value_period ?? null;
    }
    applyUpdate(item, patch, message, undo);
  };

  const toggleFavorite = useCallback(
    async (item: PipelineItem, next: boolean) => {
      const k = itemKey(item);
      const leavesList = favorites && !next;
      setItems((prev) => (leavesList ? prev.filter((i) => itemKey(i) !== k) : prev.map((i) => (itemKey(i) === k ? { ...i, is_favorite: next } : i))));
      if (leavesList) setTotal((t) => Math.max(0, t - 1));
      try {
        await pipelineApi.setFavorite(item.entity_type, item.id, next);
        if (leavesList) showToast(`${item.name} removed from favorites`, 'success', { label: 'Undo', run: () => toggleFavorite({ ...item, is_favorite: false }, true) });
        load(true);
      } catch (err: any) {
        setItems((prev) => (leavesList ? [item, ...prev] : prev.map((i) => (itemKey(i) === k ? item : i))));
        if (leavesList) setTotal((t) => t + 1);
        showToast(err.message || 'Could not update favorites', 'error');
      }
    },
    [favorites, load, showToast]
  );

  // ── dialogs ──────────────────────────────────────────────────────────
  const [contactedItem, setContactedItem] = useState<PipelineItem | null>(null);
  const [adding, setAdding] = useState(false);

  // ── filter helpers ───────────────────────────────────────────────────
  const hasFilters = Boolean(q || type || priority || status || owner || due || stage || waiting || favorites);
  const clearFilters = () => {
    setSearchText('');
    setParams(new URLSearchParams(Object.fromEntries([...params].filter(([k]) => ['sort', 'order', 'size'].includes(k)))));
  };

  const toggleSort = (key: string) => {
    const current = sort || 'priority';
    if (current === key) setParam({ sort: key, order: order === 'asc' ? 'desc' : 'asc' });
    else setParam({ sort: key, order: key === 'value' ? 'desc' : 'asc' });
  };
  const sortIndicator = (key: string) => ((sort || 'priority') === key ? (order === 'asc' ? ' ▲' : ' ▼') : '');
  const ariaSort = (key: string): 'ascending' | 'descending' | 'none' =>
    (sort || 'priority') === key ? (order === 'asc' ? 'ascending' : 'descending') : 'none';
  const Th: React.FC<{ k: string; children: React.ReactNode; className?: string }> = ({ k, children, className }) => (
    <th aria-sort={ariaSort(k)} className={`pl-sortable ${className ?? ''}`} onClick={() => toggleSort(k)}>
      {children}{sortIndicator(k)}
    </th>
  );

  const activeUsers = users.filter((u) => u.is_active || u.id === owner);
  const pipelineEmpty = !loading && !hasFilters && summary?.total === 0;

  // ── render ───────────────────────────────────────────────────────────
  return (
    <MainLayout>
      <div className="page">
        <div className="page-header">
          <div>
            <h1 className="page-title">Hot list</h1>
            <p className="page-sub">The companies and contacts you are actively working, hottest first.</p>
          </div>
          <button type="button" className="btn btn-primary btn-lg" onClick={() => setAdding(true)}>
            + Add to hot list
          </button>
        </div>

        {/* Summary tiles double as filters */}
        <div className="pl-tiles">
          {PRIORITY_ORDER.map((p) => {
            const m = PRIORITY_META[p];
            const count = summary ? summary[p] : null;
            const value = summary ? summary[`${p}_mrr` as 'hot_mrr' | 'warm_mrr' | 'cold_mrr'] : 0;
            const active = priority === p;
            return (
              <button
                key={p}
                type="button"
                className={`pl-tile${active ? ' active' : ''}`}
                style={{ ['--tile-color' as string]: m.color, ['--tile-bg' as string]: m.bg, ['--tile-border' as string]: m.border } as React.CSSProperties}
                aria-pressed={active}
                onClick={() => setParam({ priority: active ? null : p })}
              >
                <span className="pl-tile-emoji" aria-hidden="true">{m.emoji}</span>
                <span className="pl-tile-count">{count ?? '–'}</span>
                <span className="pl-tile-text">
                  <span className="pl-tile-label">{m.label}</span>
                  {value > 0 && <span className="pl-tile-value">{formatMoney(value)} / mo</span>}
                </span>
              </button>
            );
          })}
          <button
            type="button"
            className={`pl-tile pl-tile-overdue${due === 'overdue' ? ' active' : ''}`}
            aria-pressed={due === 'overdue'}
            onClick={() => setParam({ due: due === 'overdue' ? null : 'overdue' })}
          >
            <span className="pl-tile-emoji" aria-hidden="true">⏰</span>
            <span className="pl-tile-count">{summary?.overdue ?? '–'}</span>
            <span className="pl-tile-text"><span className="pl-tile-label">Overdue</span></span>
          </button>
        </div>

        {summary && (summary.mrr > 0 || summary.one_time > 0) && (
          <div className="pl-valuebar">
            <span>Hot list value</span>
            <strong>{formatMoney(summary.mrr)} / mo</strong>
            <span className="pl-valuebar-yr">≈ {formatMoney(summary.mrr * 12)} / yr</span>
            {summary.one_time > 0 && <span className="pl-valuebar-one">+ {formatMoney(summary.one_time)} one-time</span>}
          </div>
        )}

        {/* Filters */}
        <div className="filters">
          <SearchBox
            inputRef={searchRef}
            value={searchText}
            onChange={setSearchText}
            placeholder="Search name, company, owner, notes…   ( / )"
            label="Search hot list"
          />

          <div className="segment" role="group" aria-label="Type">
            <button type="button" className={!type ? 'active' : ''} onClick={() => setParam({ type: null })}>
              All {summary ? <em>{summary.companies + summary.contacts}</em> : null}
            </button>
            <button type="button" className={type === 'company' ? 'active' : ''} onClick={() => setParam({ type: 'company' })}>
              Companies {summary ? <em>{summary.companies}</em> : null}
            </button>
            <button type="button" className={type === 'contact' ? 'active' : ''} onClick={() => setParam({ type: 'contact' })}>
              Contacts {summary ? <em>{summary.contacts}</em> : null}
            </button>
          </div>

          <button
            type="button"
            className={`chip chip-fav${favorites ? ' active' : ''}`}
            aria-pressed={favorites}
            onClick={() => setParam({ fav: favorites ? null : '1' })}
            title="Show only your starred items"
          >
            ★ Favorites{summary ? <em>{summary.favorites}</em> : null}
          </button>

          <button
            type="button"
            className={`chip${owner === user?.id ? ' active' : ''}`}
            onClick={() => user && setParam({ owner: owner === user.id ? null : String(user.id) })}
          >
            My items
          </button>

          <select value={owner ?? ''} onChange={(e) => setParam({ owner: e.target.value || null })} aria-label="Owner">
            <option value="">Any owner</option>
            {activeUsers.map((u) => (
              <option key={u.id} value={u.id}>{u.full_name}</option>
            ))}
          </select>

          <select value={stage ?? ''} onChange={(e) => setParam({ stage: e.target.value || null })} aria-label="Deal stage">
            <option value="">Any stage</option>
            {STAGE_ORDER.map((s) => (
              <option key={s} value={s}>{STAGE_META[s].label}</option>
            ))}
          </select>

          <select value={waiting ?? ''} onChange={(e) => setParam({ waiting: e.target.value || null })} aria-label="Whose turn">
            <option value="">Anyone's turn</option>
            <option value="client">{WAITING_META.client.label}</option>
            <option value="us">{WAITING_META.us.label}</option>
          </select>

          <select value={status} onChange={(e) => setParam({ status: e.target.value || null })} aria-label="Relationship status">
            <option value="">Any status</option>
            {Object.values(RelationshipStatus).map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s] ?? s}</option>
            ))}
          </select>

          <select value={due ?? ''} onChange={(e) => setParam({ due: e.target.value || null })} aria-label="Follow-up">
            <option value="">Any follow-up</option>
            <option value="overdue">Overdue</option>
            <option value="week">Next 7 days</option>
            <option value="none">No follow-up set</option>
          </select>

          {hasFilters && (
            <button type="button" className="link-btn" onClick={clearFilters}>Clear filters</button>
          )}
        </div>

        {error && (
          <div className="alert alert-error">
            {error} <button type="button" onClick={() => load()}>Retry</button>
          </div>
        )}

        {/* Body */}
        {loading ? (
          <TableSkeleton />
        ) : pipelineEmpty ? (
          <EmptyState
            icon="🔥"
            title="Your hot list is empty"
            action={<button type="button" className="btn btn-primary btn-lg" onClick={() => setAdding(true)}>+ Add your first one</button>}
          >
            Add the companies and contacts you are actively working on and rank them Hot, Warm or Cold. You will see what needs
            attention at a glance.
          </EmptyState>
        ) : items.length === 0 ? (
          <EmptyState
            compact
            title={favorites && !hasFilters ? 'No favorites yet' : 'No matches'}
            action={hasFilters ? <button type="button" className="btn" onClick={clearFilters}>Clear filters</button> : undefined}
          >
            {favorites ? 'Star the items you want to keep an eye on.' : 'Nothing in the hot list fits the current filters.'}
          </EmptyState>
        ) : (
          <>
            <div className={`card pl-card${refreshing ? ' pl-refreshing' : ''}`}>
              <div className="pl-table-wrap">
                <table className="pl-table">
                  <thead>
                    <tr>
                      <th className="pl-col-star" aria-label="Favorite" />
                      <Th k="priority">Priority</Th>
                      <Th k="name">Name</Th>
                      <Th k="stage">Deal</Th>
                      <th>Next action</th>
                      <Th k="due">Follow-up</Th>
                      <Th k="value" className="pl-th-right">Value</Th>
                      <Th k="last_contacted">Last contact</Th>
                      <Th k="owner">Owner</Th>
                      <th aria-label="Actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => {
                      const last = lastContactInfo(item.last_contacted_at);
                      return (
                        <tr key={itemKey(item)} className={`pl-row${item.priority ? ` pl-row-${item.priority}` : ' pl-row-none'}`}>
                          <td className="pl-col-star">
                            <FavoriteStar value={item.is_favorite} onToggle={(v) => toggleFavorite(item, v)} size="sm" />
                          </td>

                          <td className="pl-col-priority">
                            <PriorityPicker value={item.priority} onChange={(p) => changePriority(item, p)} />
                          </td>

                          <td className="pl-col-name">
                            <div className="pl-name-line">
                              <span className={`pl-type pl-type-${item.entity_type}`}>
                                {item.entity_type === 'company' ? 'Company' : 'Contact'}
                              </span>
                              <Link to={detailPath(item.entity_type, item.id)} className="pl-name">{item.name}</Link>
                              {item.emails[0] && (
                                <a className="pl-quick" href={`mailto:${item.emails[0]}`} title={item.emails[0]} aria-label={`Email ${item.name}`}>✉</a>
                              )}
                              {item.phones[0] && (
                                <a className="pl-quick" href={`tel:${item.phones[0]}`} title={item.phones[0]} aria-label={`Call ${item.name}`}>☎</a>
                              )}
                            </div>
                            <div className="pl-sub">
                              {item.entity_type === 'contact' ? (
                                <>
                                  {item.job_title}
                                  {item.job_title && item.company_name ? ' · ' : ''}
                                  {item.company_id && item.company_name ? (
                                    <Link to={`/companies/${item.company_id}`}>{item.company_name}</Link>
                                  ) : (
                                    item.company_name
                                  )}
                                </>
                              ) : (
                                item.industry
                              )}
                              <span className="pl-status">{STATUS_LABELS[item.status] ?? item.status}</span>
                            </div>
                          </td>

                          <td className="pl-col-deal">
                            <DealCell
                              stage={item.deal_stage}
                              waitingOn={item.waiting_on}
                              onSave={(patch) => changeDeal(item, patch, `Deal updated for ${item.name}`)}
                            />
                          </td>

                          <td className="pl-col-action">
                            <NextActionCell
                              value={item.next_action}
                              onSave={(v) =>
                                applyUpdate(item, { next_action: v }, 'Next action saved', { next_action: item.next_action ?? null })
                              }
                            />
                          </td>

                          <td>
                            <FollowUpCell
                              value={item.next_contact_due_at}
                              onSave={(iso) =>
                                applyUpdate(item, { next_contact_due_at: iso }, iso ? 'Follow-up scheduled' : 'Follow-up cleared', {
                                  next_contact_due_at: item.next_contact_due_at ?? null,
                                })
                              }
                            />
                          </td>

                          <td className="pl-col-value">
                            <ValueCell
                              value={item.deal_value}
                              period={item.deal_value_period}
                              onSave={(patch) => changeDeal(item, patch, `Deal value updated for ${item.name}`)}
                            />
                          </td>

                          <td className={`pl-last${item.last_contacted_at ? '' : ' pl-muted'}`} title={last.title}>{last.label}</td>

                          <td>
                            <span className="pl-owner" title={item.owner_full_name}>
                              <span className="pl-avatar">{initials(item.owner_full_name)}</span>
                              <span className="pl-owner-name">{item.owner_full_name.split(' ')[0]}</span>
                            </span>
                          </td>

                          <td className="pl-col-actions">
                            <button type="button" className="btn btn-sm" onClick={() => setContactedItem(item)}>
                              ✓ Contacted
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <Pagination
              page={page}
              pageSize={pageSize}
              total={total}
              pageSizeOptions={PAGE_SIZES}
              onPageChange={(p) => {
                setParam({ page: p > 1 ? String(p) : null });
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              onPageSizeChange={(s) => setParam({ size: s === DEFAULT_PAGE_SIZE ? null : String(s) })}
            />
          </>
        )}
      </div>

      {contactedItem && (
        <ContactedModal
          item={contactedItem}
          onClose={() => setContactedItem(null)}
          onSaved={() => {
            showToast(`Logged contact with ${contactedItem.name}`);
            setContactedItem(null);
            load(true);
          }}
        />
      )}

      {adding && (
        <AddToPipelineModal
          onClose={() => setAdding(false)}
          onChanged={() => {
            showToast('Hot list updated');
            load(true);
          }}
        />
      )}

    </MainLayout>
  );
};
