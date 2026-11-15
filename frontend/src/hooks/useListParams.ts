/**
 * URL-backed list state (search, filters, sort, page) shared by the list pages.
 * Every change other than paging resets to page 1; the search box is debounced.
 */
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

export function useListParams(defaultPageSize = 25, pageSizes: number[] = [25, 50, 100]) {
  const [params, setParams] = useSearchParams();

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

  const search = params.get('search') ?? '';
  const sortBy = params.get('sort_by') ?? '';
  const sortOrder: 'asc' | 'desc' = params.get('sort_order') === 'desc' ? 'desc' : 'asc';
  const sizeParam = Number(params.get('size'));
  const pageSize = pageSizes.includes(sizeParam) ? sizeParam : defaultPageSize;
  const page = Math.max(1, parseInt(params.get('page') || '1', 10) || 1);

  // Debounced search box
  const [searchText, setSearchText] = useState(search);
  useEffect(() => setSearchText(search), [search]);
  useEffect(() => {
    if (searchText.trim() === search) return;
    const t = setTimeout(() => setParam({ search: searchText.trim() || null }, true), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchText]);

  const toggleSort = (column: string) => {
    if (sortBy === column) setParam({ sort_by: column, sort_order: sortOrder === 'asc' ? 'desc' : 'asc' });
    else setParam({ sort_by: column, sort_order: 'asc' });
  };

  const sortIndicator = (column: string) => (sortBy === column ? (sortOrder === 'asc' ? ' ▲' : ' ▼') : '');
  const ariaSort = (column: string): 'ascending' | 'descending' | 'none' =>
    sortBy === column ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none';

  /** Remove every filter but keep sort and page size. */
  const clearFilters = () => {
    setSearchText('');
    setParams(new URLSearchParams([...params].filter(([k]) => ['sort_by', 'sort_order', 'size'].includes(k))));
  };

  return {
    params, setParam, search, searchText, setSearchText, sortBy, sortOrder, pageSize, page, pageSizes,
    toggleSort, sortIndicator, ariaSort, clearFilters,
  };
}
