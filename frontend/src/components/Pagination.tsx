/**
 * Pagination bar: range info, page-size selector and numbered pages.
 * Purely presentational - paging is done by the server.
 */
import React from 'react';
import './Pipeline.css';

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  pageSizeOptions?: number[];
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
}

/** Page numbers to show: always first/last, current +-1, with "…" gaps. */
function pageList(page: number, totalPages: number): (number | '…')[] {
  const pages = new Set<number>([1, totalPages, page - 1, page, page + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  const out: (number | '…')[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push('…');
    out.push(p);
  });
  return out;
}

export const Pagination: React.FC<PaginationProps> = ({
  page,
  pageSize,
  total,
  pageSizeOptions = [25, 50, 100],
  onPageChange,
  onPageSizeChange,
}) => {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="pl-pagination">
      <div className="pl-pagination-info">
        Showing <strong>{from}–{to}</strong> of <strong>{total}</strong>
      </div>

      <div className="pl-pagination-pages" role="navigation" aria-label="Pagination">
        <button type="button" disabled={page <= 1} onClick={() => onPageChange(page - 1)} aria-label="Previous page">
          ←
        </button>
        {pageList(page, totalPages).map((p, i) =>
          p === '…' ? (
            <span key={`gap-${i}`} className="pl-pagination-gap">…</span>
          ) : (
            <button
              key={p}
              type="button"
              className={p === page ? 'active' : ''}
              aria-current={p === page ? 'page' : undefined}
              onClick={() => onPageChange(p)}
            >
              {p}
            </button>
          )
        )}
        <button type="button" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} aria-label="Next page">
          →
        </button>
      </div>

      {onPageSizeChange && (
        <label className="pl-pagination-size">
          Per page
          <select value={pageSize} onChange={(e) => onPageSizeChange(Number(e.target.value))}>
            {pageSizeOptions.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
};
