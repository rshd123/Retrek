import { useState, useEffect, useMemo } from 'react';
import { api } from '../services/api';
import { useRefetchKey } from '../context/RealtimeContext';

export default function AuditTrail() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [gateFilter, setGateFilter] = useState('ALL');
  const [selectedLog, setSelectedLog] = useState(null);
  const refetchKey = useRefetchKey();

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.getAuditLogs();
        setLogs(res.data || []);
      } catch (err) {
        console.error('Audit log load error:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [refetchKey]);

  const filtered = useMemo(() => {
    return logs.filter((log) => {
      const matchesGate = gateFilter === 'ALL' || log.gate_decision === gateFilter;
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        (log.transaction_id && log.transaction_id.toLowerCase().includes(q)) ||
        (log.decline_code && log.decline_code.toLowerCase().includes(q)) ||
        (log.gate_decision && log.gate_decision.toLowerCase().includes(q)) ||
        (log.ai_reasoning?.root_cause && log.ai_reasoning.root_cause.toLowerCase().includes(q));
      return matchesGate && matchesSearch;
    });
  }, [logs, searchQuery, gateFilter]);

  const gateCounts = useMemo(() => {
    const counts = { ALL: logs.length, AUTO_EXECUTE: 0, HUMAN_APPROVAL: 0, STOP_RULE: 0 };
    logs.forEach((l) => {
      if (counts[l.gate_decision] !== undefined) counts[l.gate_decision]++;
    });
    return counts;
  }, [logs]);

  const formatTime = (ts) => {
    if (!ts) return '—';
    const d = new Date(ts);
    return d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  };

  if (loading) {
    return (
      <div className="tab-view">
        <div className="empty-state">
          <div className="spinner" />
          <p>Loading audit records...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="tab-view">
      <div className="view-header">
        <div>
          <h2 className="view-title">Audit Trail</h2>
          <p className="view-subtitle">Immutable provenance ledger of all AI diagnoses and policy gate decisions</p>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="metrics-grid" style={{ marginBottom: '24px' }}>
        <div className="metric-card">
          <span className="metric-label">Total Records</span>
          <span className="metric-value">{logs.length}</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Auto-Executed</span>
          <span className="metric-value" style={{ color: '#38a169' }}>{gateCounts.AUTO_EXECUTE}</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Human Review</span>
          <span className="metric-value" style={{ color: '#d69e2e' }}>{gateCounts.HUMAN_APPROVAL}</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Stopped</span>
          <span className="metric-value" style={{ color: '#e53e3e' }}>{gateCounts.STOP_RULE}</span>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="tx-controls-bar">
        <div className="tx-search-box">
          <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            className="tx-search-input"
            placeholder="Search by transaction ID, decline code, or root cause..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="clear-search-btn" onClick={() => setSearchQuery('')}>
              ✕
            </button>
          )}
        </div>
        <div className="tx-status-filters">
          {[
            { key: 'ALL', label: 'All' },
            { key: 'AUTO_EXECUTE', label: 'Auto-Execute' },
            { key: 'HUMAN_APPROVAL', label: 'Human Review' },
            { key: 'STOP_RULE', label: 'Stopped' },
          ].map((item) => (
            <button
              key={item.key}
              className={`filter-pill ${gateFilter === item.key ? 'filter-pill-active' : ''}`}
              onClick={() => setGateFilter(item.key)}
            >
              {item.label} <span className="pill-count">{gateCounts[item.key] || 0}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Audit Log Table */}
      {filtered.length === 0 ? (
        <div className="empty-state">
          <p>{logs.length === 0 ? 'No audit records yet. Process a transaction to generate audit logs.' : 'No records match your search.'}</p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <colgroup>
              <col style={{ width: '12%' }} />
              <col style={{ width: '16%' }} />
              <col style={{ width: '18%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '22%' }} />
            </colgroup>
            <thead>
              <tr>
                <th>Transaction</th>
                <th>Gate Decision</th>
                <th>Decline Code</th>
                <th>Probability</th>
                <th>Action Taken</th>
                <th>Latency</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((log) => {
                const ai = log.ai_reasoning || {};
                const prob = log.recovery_probability ?? ai.recovery_probability ?? null;
                return (
                  <tr
                    key={log.id || log.transaction_id}
                    className="tx-row"
                    onClick={() => setSelectedLog(log)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td className="code-cell" data-label="Transaction" style={{ paddingRight: '6px' }}>
                      <span className="tx-id-badge" style={{ fontSize: '12px', padding: '3px 8px' }}>
                        {log.transaction_id?.slice(0, 12) || '—'}
                      </span>
                    </td>
                    <td data-label="Gate Decision" style={{ paddingLeft: '6px', paddingRight: '6px' }}>
                      <span className={`gate-pill ${getGateBadgeClass(log.gate_decision)}`} style={{ whiteSpace: 'nowrap' }}>
                        {(log.gate_decision || '—').replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td data-label="Decline Code" style={{ paddingLeft: '6px', paddingRight: '6px' }}>
                      <span className={`badge-decline badge-${(log.decline_code || 'generic').toLowerCase()}`} style={{ fontSize: '11px', padding: '2px 6px', whiteSpace: 'nowrap' }}>
                        {(log.decline_code || '—').replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td data-label="Probability" style={{ paddingLeft: '6px' }}>
                      {prob !== null ? (
                        <span style={{
                          fontWeight: '700',
                          color: prob >= 0.8 ? '#166534' : prob >= 0.5 ? '#92400e' : '#991b1b',
                        }}>
                          {(Number(prob) * 100).toFixed(0)}%
                        </span>
                      ) : '—'}
                    </td>
                    <td data-label="Action Taken">
                      <span style={{ fontSize: '13px', color: '#475569' }}>
                        {(ai.action_taken || '—').replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td data-label="Latency">
                      <span style={{ fontSize: '13px', fontFamily: 'monospace', color: '#64748b' }}>
                        {ai.latency_ms != null ? `${ai.latency_ms}ms` : '—'}
                      </span>
                    </td>
                    <td data-label="Timestamp">
                      <span style={{ fontSize: '13px', color: '#64748b' }}>
                        {formatTime(log.created_at)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail Modal */}
      {selectedLog && (
        <div className="modal-overlay" onClick={() => setSelectedLog(null)}>
          <div className="modal-content modal-content-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Audit Record — Full Provenance</h3>
                <span className="modal-subtitle code-cell">{selectedLog.transaction_id}</span>
              </div>
              <button className="modal-close-btn" onClick={() => setSelectedLog(null)}>✕</button>
            </div>

            <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto', overflowX: 'hidden' }}>
              {/* Summary Grid */}
              <div className="modal-grid">
                <div className="modal-info-group">
                  <span className="modal-label">Gate Decision</span>
                  <span className={`gate-pill ${getGateBadgeClass(selectedLog.gate_decision)}`}>
                    {(selectedLog.gate_decision || '—').replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="modal-info-group">
                  <span className="modal-label">Recovery Probability</span>
                  <span className="modal-val" style={{ fontWeight: '700' }}>
                    {selectedLog.recovery_probability != null
                      ? `${(Number(selectedLog.recovery_probability) * 100).toFixed(0)}%`
                      : '—'}
                  </span>
                </div>
                <div className="modal-info-group">
                  <span className="modal-label">Decline Code</span>
                  <span className="modal-val">{selectedLog.decline_code || '—'}</span>
                </div>
                <div className="modal-info-group">
                  <span className="modal-label">Timestamp</span>
                  <span className="modal-val">{formatTime(selectedLog.created_at)}</span>
                </div>
              </div>

              {/* AI Reasoning Trace */}
              {selectedLog.ai_reasoning && (
                <>
                  {/* Root Cause */}
                  <div className="modal-section-box" style={{ background: '#f8fafc', borderLeft: '4px solid #3b82f6', marginTop: '16px' }}>
                    <span className="modal-label" style={{ color: '#1e40af', fontWeight: '700', fontSize: '13px' }}>
                      Root Cause Analysis
                    </span>
                    <p style={{ margin: '6px 0 0', fontSize: '14px', color: '#1e293b' }}>
                      {selectedLog.ai_reasoning.root_cause || '—'}
                    </p>
                    {selectedLog.ai_reasoning.reasoning_summary && (
                      <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b', fontStyle: 'italic' }}>
                        {selectedLog.ai_reasoning.reasoning_summary}
                      </p>
                    )}
                  </div>

                  {/* ISO & Category */}
                  <div className="modal-section-box" style={{ marginTop: '12px' }}>
                    <div className="modal-grid">
                      <div className="modal-info-group">
                        <span className="modal-label">ISO Code</span>
                        <span className="modal-val" style={{ fontFamily: 'monospace' }}>
                          {selectedLog.ai_reasoning.iso_code || '—'}
                        </span>
                      </div>
                      <div className="modal-info-group">
                        <span className="modal-label">Failure Category</span>
                        <span className="modal-val">
                          {(selectedLog.ai_reasoning.failure_category || '—').replace(/_/g, ' ')}
                        </span>
                      </div>
                      <div className="modal-info-group">
                        <span className="modal-label">Suggested Action</span>
                        <span className="modal-val">
                          {(selectedLog.ai_reasoning.suggested_action || '—').replace(/_/g, ' ')}
                        </span>
                      </div>
                      <div className="modal-info-group">
                        <span className="modal-label">AI Latency</span>
                        <span className="modal-val" style={{ fontFamily: 'monospace' }}>
                          {selectedLog.ai_reasoning.latency_ms != null ? `${selectedLog.ai_reasoning.latency_ms}ms` : '—'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Policy Gate Reason */}
                  {selectedLog.ai_reasoning.policy_reason && (
                    <div className="modal-section-box" style={{ background: '#fcfaf6', borderLeft: '4px solid #f59e0b', marginTop: '12px' }}>
                      <span className="modal-label" style={{ color: '#b45309', fontWeight: '700', fontSize: '13px' }}>
                        Policy Gate Decision
                      </span>
                      <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#451a03' }}>
                        {selectedLog.ai_reasoning.policy_reason}
                      </p>
                    </div>
                  )}

                  {/* Customer Message */}
                  {(selectedLog.ai_reasoning.customer_message_hinglish || selectedLog.ai_reasoning.customer_message_english) && (
                    <div className="modal-section-box" style={{ background: '#f0fdf4', borderLeft: '4px solid #10b981', marginTop: '12px' }}>
                      <span className="modal-label" style={{ color: '#047857', fontWeight: '700', fontSize: '13px' }}>
                        Customer Outreach Message
                      </span>
                      {selectedLog.ai_reasoning.customer_message_hinglish && (
                        <p style={{ margin: '6px 0 4px', fontSize: '13px', color: '#064e3b', background: '#ffffff', padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1fae5' }}>
                          "{selectedLog.ai_reasoning.customer_message_hinglish}"
                        </p>
                      )}
                      {selectedLog.ai_reasoning.customer_message_english && (
                        <p style={{ margin: '0', fontSize: '12px', color: '#475569' }}>
                          <em>EN:</em> "{selectedLog.ai_reasoning.customer_message_english}"
                        </p>
                      )}
                    </div>
                  )}

                  {/* Full Raw JSON */}
                  <div className="modal-section-box" style={{ marginTop: '12px' }}>
                    <span className="modal-label" style={{ fontWeight: '700', fontSize: '13px' }}>
                      Raw AI Reasoning JSON
                    </span>
                    <pre style={{
                      margin: '8px 0 0',
                      padding: '12px',
                      background: '#f8fafc',
                      borderRadius: '6px',
                      border: '1px solid #e2e8f0',
                      fontSize: '11px',
                      fontFamily: 'monospace',
                      overflowX: 'auto',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      color: '#334155',
                      maxHeight: '200px',
                      overflowY: 'auto',
                    }}>
                      {JSON.stringify(selectedLog.ai_reasoning, null, 2)}
                    </pre>
                  </div>
                </>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setSelectedLog(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getGateBadgeClass(gate) {
  if (!gate) return 'badge-neutral';
  switch (gate.toUpperCase()) {
    case 'AUTO_EXECUTE': return 'badge-gate-auto';
    case 'HUMAN_APPROVAL': return 'badge-gate-human';
    case 'STOP_RULE':
    case 'SAFETY_REFUSED': return 'badge-gate-stop';
    default: return 'badge-neutral';
  }
}
