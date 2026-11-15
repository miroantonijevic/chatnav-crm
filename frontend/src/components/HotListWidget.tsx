/**
 * Dashboard widget: the hot leads with their next action and follow-up status.
 * Links through to the full Hot leads page.
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { pipelineApi } from '../api';
import { PipelineItem, PipelineSummary } from '../types';
import { STAGE_META, detailPath, followUpInfo, formatDeal, formatMoney } from '../utils/pipeline';
import './Pipeline.css';

const LIMIT = 6;

export const HotListWidget: React.FC = () => {
  const [items, setItems] = useState<PipelineItem[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<PipelineSummary | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([pipelineApi.list({ limit: LIMIT }), pipelineApi.summary()])
      .then(([list, sum]) => {
        if (cancelled) return;
        setItems(list.items);
        setTotal(list.total);
        setSummary(sum);
      })
      .catch((err) => console.error('Failed to load hot leads:', err))
      .finally(() => !cancelled && setLoaded(true));
    return () => {
      cancelled = true;
    };
  }, []);

  if (!loaded) return null;

  return (
    <div className="pl-widget">
      <div className="pl-widget-head">
        <h2>🔥 Hot leads {total > 0 && <span className="pl-widget-count">{total}</span>}</h2>
        <div className="pl-widget-meta">
          {summary && summary.mrr > 0 && <span className="pl-widget-mrr">{formatMoney(summary.mrr)} / mo</span>}
          <Link to="/pipeline" className="pl-widget-link">
            {total > LIMIT ? `View all ${total} →` : 'Open hot leads →'}
          </Link>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="pl-widget-empty">
          No hot leads yet. Mark the companies and contacts you are actively working on with 🔥. <Link to="/pipeline">Open hot leads</Link>
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
                {fu.tone !== 'none' && <span className={`pl-followup pl-tone-${fu.tone}`} title={fu.title}>{fu.label}</span>}
              </span>
            </Link>
          );
        })
      )}
    </div>
  );
};
