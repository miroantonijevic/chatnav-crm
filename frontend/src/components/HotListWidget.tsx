/**
 * Dashboard widget: the hottest items in the pipeline and the user's favourites,
 * with their next action and follow-up status. Links through to the Pipeline page.
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { pipelineApi } from '../api';
import { PipelineItem, PipelineSummary, Priority } from '../types';
import { PriorityBadge } from './PriorityBadge';
import { STAGE_META, detailPath, followUpInfo, formatDeal, formatMoney } from '../utils/pipeline';
import './Pipeline.css';

const LIMIT = 6;
type Tab = 'hot' | 'favorites';

interface TabData {
  items: PipelineItem[];
  total: number;
}

export const HotListWidget: React.FC = () => {
  const [tab, setTab] = useState<Tab>('hot');
  const [data, setData] = useState<Record<Tab, TabData>>({ hot: { items: [], total: 0 }, favorites: { items: [], total: 0 } });
  const [summary, setSummary] = useState<PipelineSummary | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      pipelineApi.list({ priority: [Priority.HOT], limit: LIMIT }),
      pipelineApi.list({ favorites: true, limit: LIMIT }),
      pipelineApi.summary(),
    ])
      .then(([hot, fav, sum]) => {
        if (cancelled) return;
        setData({ hot: { items: hot.items, total: hot.total }, favorites: { items: fav.items, total: fav.total } });
        setSummary(sum);
      })
      .catch((err) => console.error('Failed to load hot list:', err))
      .finally(() => !cancelled && setLoaded(true));
    return () => {
      cancelled = true;
    };
  }, []);

  if (!loaded) return null;

  const { items, total } = data[tab];
  const link = tab === 'hot' ? '/pipeline?priority=hot' : '/pipeline?fav=1';

  return (
    <div className="pl-widget">
      <div className="pl-widget-head">
        <div className="pl-widget-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'hot'} className={tab === 'hot' ? 'active' : ''} onClick={() => setTab('hot')}>
            🔥 Hot list <em>{data.hot.total}</em>
          </button>
          <button type="button" role="tab" aria-selected={tab === 'favorites'} className={tab === 'favorites' ? 'active' : ''} onClick={() => setTab('favorites')}>
            ★ Favorites <em>{data.favorites.total}</em>
          </button>
        </div>
        <div className="pl-widget-meta">
          {summary && summary.mrr > 0 && <span className="pl-widget-mrr">Pipeline {formatMoney(summary.mrr)} / mo</span>}
          <Link to={total > 0 ? link : '/pipeline'} className="pl-widget-link">
            {total > LIMIT ? `View all ${total} →` : 'Open pipeline →'}
          </Link>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="pl-widget-empty">
          {tab === 'favorites' ? (
            <>Star the companies and contacts you want to keep an eye on to see them here. <Link to="/pipeline">Open the pipeline</Link></>
          ) : summary && summary.total > 0 ? (
            <>Nothing is hot right now. <Link to="/pipeline">Open the pipeline</Link> to see {summary.total} other item{summary.total === 1 ? '' : 's'}.</>
          ) : (
            <>Rank the companies and contacts you are actively working on to see them here. <Link to="/pipeline">Start your pipeline</Link></>
          )}
        </p>
      ) : (
        items.map((item) => {
          const fu = followUpInfo(item.next_contact_due_at);
          const stage = item.deal_stage ? STAGE_META[item.deal_stage] : null;
          return (
            <Link key={`${item.entity_type}-${item.id}`} to={detailPath(item.entity_type, item.id)} className="pl-widget-item">
              <div style={{ minWidth: 0 }}>
                <div className="pl-widget-name">{item.name}</div>
                <div className="pl-widget-sub">
                  {item.entity_type === 'contact' ? item.company_name || 'Contact' : item.industry || 'Company'}
                  {item.deal_value !== null && item.deal_value !== undefined && ` · ${formatDeal(item.deal_value, item.deal_value_period)}`}
                </div>
              </div>
              <div className={`pl-widget-action${item.next_action ? '' : ' pl-muted'}`} title={item.next_action ?? undefined}>
                {item.next_action || 'No next action'}
              </div>
              <span className="pl-widget-badges">
                {stage && <span className="pl-stage" style={{ color: stage.color, background: stage.bg }}>{stage.label}</span>}{' '}
                <PriorityBadge value={item.priority} size="sm" />{' '}
                {fu.tone !== 'none' && <span className={`pl-followup pl-tone-${fu.tone}`} title={fu.title}>{fu.label}</span>}
              </span>
            </Link>
          );
        })
      )}
    </div>
  );
};
