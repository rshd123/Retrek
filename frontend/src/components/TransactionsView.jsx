import { useState, useMemo } from 'react';
import { api } from '../services/api';
import ScenarioBadge from './ScenarioBadge';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const BACKEND_BASE = API_BASE.replace(/\/api\/?$/, '');

function resolveCheckoutUrl(url) {
  if (!url) return url;
  if (url.startsWith('http')) return url;
  return `${BACKEND_BASE}${url}`;
}

export default function TransactionsView({
  transactions = [],
  loading = false,
  onRefresh,
  onSeed,
  setMessage
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [scenarioFilter, setScenarioFilter] = useState('ALL');
  const [selectedTx, setSelectedTx] = useState(null);
  const [processingId, setProcessingId] = useState(null);
  const [batchProcessing, setBatchProcessing] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  // Compute summary stats
  const stats = useMemo(() => {
    const totalCount = transactions.length;
    const totalAmount = transactions.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);

    const recovered = transactions.filter((tx) => tx.status === 'RECOVERED');
    const recoveredAmount = recovered.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);

    const pending = transactions.filter((tx) => tx.status === 'PENDING_APPROVAL');
    const linkSent = transactions.filter((tx) => tx.status === 'LINK_SENT');
    const failed = transactions.filter((tx) => tx.status === 'FAILED');
    const stopped = transactions.filter((tx) => tx.status === 'STOPPED' || tx.status === 'REFUSED');

    // Scenario counts
    const scenarioCounts = {};
    for (const tx of transactions) {
      const type = tx.scenario_type || 'payment_degradation';
      scenarioCounts[type] = (scenarioCounts[type] || 0) + 1;
    }

    return {
      totalCount,
      totalAmount,
      recoveredCount: recovered.length,
      recoveredAmount,
      pendingCount: pending.length,
      linkSentCount: linkSent.length,
      failedCount: failed.length,
      stoppedCount: stopped.length,
      scenarioCounts,
    };
  }, [transactions]);

  // Filter transactions based on search query, status filter, and scenario filter
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'STOPPED' && (tx.status === 'STOPPED' || tx.status === 'REFUSED')) ||
        tx.status === statusFilter;

      const matchesScenario =
        scenarioFilter === 'ALL' ||
        (tx.scenario_type || 'payment_degradation') === scenarioFilter;

      const query = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !query ||
        (tx.id && tx.id.toLowerCase().includes(query)) ||
        (tx.customer_name && tx.customer_name.toLowerCase().includes(query)) ||
        (tx.decline_code && tx.decline_code.toLowerCase().includes(query)) ||
        (tx.status && tx.status.toLowerCase().includes(query)) ||
        (tx.gate_decision && tx.gate_decision.toLowerCase().includes(query)) ||
        (tx.scenario_type && tx.scenario_type.toLowerCase().includes(query));

      return matchesStatus && matchesScenario && matchesSearch;
    });
  }, [transactions, statusFilter, scenarioFilter, searchQuery]);

  const copyToClipboard = (text, id) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleProcess = async (id) => {
    setProcessingId(id);
    try {
      const res = await api.processTransaction(id);
      const data = res.data || {};
      setMessage({
        type: 'success',
        text: `Transaction ${id} diagnosed! Gate: ${data.gate_decision || 'EVALUATED'} (Prob: ${(Number(data.recovery_probability || 0) * 100).toFixed(0)}%)`
      });
      if (onRefresh) onRefresh();
      setSelectedTx((prev) => {
        if (prev?.id === id) {
          return { ...prev, ...data, status: data.status || prev.status };
        }
        return { ...prev, ...data, id };
      });
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Processing failed' });
    } finally {
      setProcessingId(null);
    }
  };

  const handleBatchProcess = async () => {
    setBatchProcessing(true);
    try {
      const res = await api.batchProcessTransactions();
      setMessage({
        type: 'success',
        text: res.message || `Processed ${res.processed_count || 0} failed transactions through AI pipeline!`
      });
      if (onRefresh) onRefresh();
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Batch processing failed' });
    } finally {
      setBatchProcessing(false);
    }
  };

  const handleApprove = async (id) => {
    setProcessingId(id);
    try {
      await api.approveTransaction(id, 'Approved via Transactions management');
      setMessage({ type: 'success', text: `Transaction ${id} approved & recovery link generated!` });
      if (onRefresh) onRefresh();
      if (selectedTx?.id === id) setSelectedTx(null);
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Approval failed' });
    } finally {
      setProcessingId(null);
    }
  };

  const handleDecline = async (id) => {
    setProcessingId(id);
    try {
      await api.declineTransaction(id, 'Declined via Transactions management');
      setMessage({ type: 'success', text: `Transaction ${id} declined and recovery stopped.` });
      if (onRefresh) onRefresh();
      if (selectedTx?.id === id) setSelectedTx(null);
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Decline failed' });
    } finally {
      setProcessingId(null);
    }
  };

  const formatDeclineCode = (code) => {
    if (!code) return 'UNKNOWN';
    return code.replace(/_/g, ' ');
  };

  const getGateBadgeClass = (gate) => {
    if (!gate) return 'badge-neutral';
    switch (gate.toUpperCase()) {
      case 'AUTO_EXECUTE':
        return 'badge-gate-auto';
      case 'HUMAN_APPROVAL':
        return 'badge-gate-human';
      case 'STOP_RULE':
      case 'SAFETY_REFUSED':
        return 'badge-gate-stop';
      default:
        return 'badge-neutral';
    }
  };

  return (
    <div className="tab-view">
      {/* Top Header */}
      <div className="view-header">
        <div>
          <h2 className="view-title">Merchant Transactions Ledger</h2>
          <p className="view-subtitle">
            Autonomous AI failure diagnosis, ISO-8583 mapping, deterministic safety gates, and payment recovery
          </p>
        </div>
        <div className="header-actions-group" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            className="btn btn-outline"
            onClick={onRefresh}
            disabled={loading || batchProcessing}
            title="Reload transaction list"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '6px' }}>
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
            </svg>
            Refresh
          </button>

          {stats.failedCount > 0 && (
            <button
              className="btn btn-success"
              onClick={handleBatchProcess}
              disabled={loading || batchProcessing}
              title="Process all unresolved FAILED transactions through AI recovery engine"
            >
              {batchProcessing ? (
                <span>Diagnosing ({stats.failedCount})...</span>
              ) : (
                <span>AI Recover All ({stats.failedCount})</span>
              )}
            </button>
          )}

          <button
            className="btn btn-primary"
            onClick={onSeed}
            disabled={loading || batchProcessing}
            title="Seed synthetic transactions to test AI recovery"
          >
            {loading ? 'Processing...' : 'Seed 10 Test Cases'}
          </button>
        </div>
      </div>

      {/* Transaction Summary Metrics */}
      <div className="metrics-grid tx-metrics-grid">
        <div className="metric-card">
          <span className="metric-label">Total Transactions</span>
          <span className="metric-value">{stats.totalCount}</span>
          <span className="metric-sub">Volume: ₹{stats.totalAmount.toLocaleString('en-IN')}</span>
        </div>

        <div className="metric-card metric-card-highlight">
          <span className="metric-label">Capital Recovered</span>
          <span className="metric-value text-green">₹{stats.recoveredAmount.toLocaleString('en-IN')}</span>
          <span className="metric-sub">{stats.recoveredCount} payment(s) won back</span>
        </div>

        <div className="metric-card">
          <span className="metric-label">In Dunning Pipeline</span>
          <span className="metric-value" style={{ color: '#2b6cb0' }}>{stats.linkSentCount}</span>
          <span className="metric-sub">Active payment recovery links</span>
        </div>

        <div className="metric-card">
          <span className="metric-label">Pending Approval</span>
          <span className="metric-value" style={{ color: '#dd6b20' }}>{stats.pendingCount}</span>
          <span className="metric-sub">High-ticket review queue</span>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="tx-controls-bar">
        <div className="tx-search-box">
          <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            className="tx-search-input"
            placeholder="Search by ID, customer name, decline code, or gate decision..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="clear-search-btn" onClick={() => setSearchQuery('')}>
              �
            </button>
          )}
        </div>

        {/* Filter Pills — Status + Scenario */}
        <div className="tx-status-filters">
          {[
            { key: 'ALL', label: 'All', count: stats.totalCount },
            { key: 'FAILED', label: 'Failed', count: stats.failedCount },
            { key: 'LINK_SENT', label: 'Link Sent', count: stats.linkSentCount },
            { key: 'PENDING_APPROVAL', label: 'Pending', count: stats.pendingCount },
            { key: 'RECOVERED', label: 'Recovered', count: stats.recoveredCount },
            { key: 'STOPPED', label: 'Stopped', count: stats.stoppedCount },
          ].map((item) => (
            <button
              key={item.key}
              className={`filter-pill ${statusFilter === item.key ? 'filter-pill-active' : ''}`}
              onClick={() => setStatusFilter(item.key)}
            >
              {item.label} <span className="pill-count">{item.count}</span>
            </button>
          ))}
          <span className="filter-divider" />
          {[
            { key: 'payment_degradation', label: 'Payment', count: stats.scenarioCounts.payment_degradation || 0 },
            { key: 'checkout_dropoff', label: 'Checkout', count: stats.scenarioCounts.checkout_dropoff || 0 },
            { key: 'subscription_failure', label: 'Subscription', count: stats.scenarioCounts.subscription_failure || 0 },
            { key: 'b2b_receivables', label: 'B2B', count: stats.scenarioCounts.b2b_receivables || 0 },
            { key: 'mandate_retry', label: 'Mandate', count: stats.scenarioCounts.mandate_retry || 0 },
            { key: 'voice_recovery', label: 'Voice', count: stats.scenarioCounts.voice_recovery || 0 },
            { key: 'ptp_commitment', label: 'PTP', count: stats.scenarioCounts.ptp_commitment || 0 },
          ].map((item) => (
            <button
              key={item.key}
              className={`filter-pill filter-pill-scenario ${scenarioFilter === item.key ? 'filter-pill-active' : ''}`}
              onClick={() => setScenarioFilter(item.key)}
            >
              {item.label} <span className="pill-count">{item.count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Transactions Data Table */}
      {filteredTransactions.length === 0 ? (
        <div className="empty-state">
          {transactions.length === 0 ? (
            <div>
              <p style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>No transactions recorded yet.</p>
              <p style={{ marginBottom: '16px' }}>Click below to seed 20 synthetic scenarios covering all 7 recovery types and test the AI diagnosis engine.</p>
              <button className="btn btn-primary" onClick={onSeed} disabled={loading}>
            {loading ? 'Processing...' : 'Seed 20 Test Cases'}
          </button>
        </div>
      ) : (
        <div>
          <p>No transactions match your current search and filter criteria.</p>
              <button className="btn btn-outline" style={{ marginTop: '12px' }} onClick={() => { setSearchQuery(''); setStatusFilter('ALL'); setScenarioFilter('ALL'); }}>
                Reset Filters
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <colgroup>
              <col className="col-id" />
              <col className="col-customer" />
              <col className="col-amount" />
              <col className="col-decline" />
              <col className="col-gate" />
              <col className="col-status" />
              <col className="col-action" />
            </colgroup>
            <thead>
              <tr>
                <th>Transaction ID</th>
                <th>Customer</th>
                <th>Amount</th>
                <th>Decline Reason / ISO</th>
                <th>AI Decision Gate</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.map((tx) => {
                const prob = tx.recovery_probability !== null && tx.recovery_probability !== undefined
                  ? Number(tx.recovery_probability)
                  : null;
                const gate = tx.gate_decision || tx.ai_reasoning?.gate_decision;

                return (
                  <tr key={tx.id} className="tx-row" onClick={() => setSelectedTx(tx)}>
                    <td className="code-cell td-card-header" data-label="Transaction ID">
                      <span className="tx-id-badge" title="Click to copy full ID" onClick={(e) => { e.stopPropagation(); copyToClipboard(tx.id, tx.id); }}>
                        {tx.id.slice(0, 12)}
                        <span className="copy-indicator">{copiedId === tx.id ? '✓' : ''}</span>
                      </span>
                      <span className={`status-pill status-${(tx.status || 'unknown').toLowerCase()}`}>
                        {(tx.status || 'unknown').replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td data-label="Customer">
                      {tx.customer_name ? (
                        <div>
                          <div className="customer-name">{tx.customer_name}</div>
                          <div className="customer-meta">
                            Retries: {tx.retry_count || 0} · Past: {tx.past_success_count || 0}
                          </div>
                        </div>
                      ) : (
                        <span className="not-evaluated">—</span>
                      )}
                    </td>
                    <td className="text-amount" data-label="Amount">
                      ₹{Number(tx.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td data-label="Decline Reason">
                      <span className={`badge-decline badge-${(tx.decline_code || 'generic').toLowerCase()}`}>
                        {formatDeclineCode(tx.decline_code)}
                      </span>
                      <div style={{ marginTop: '4px' }}>
                        <ScenarioBadge scenarioType={tx.scenario_type} compact />
                      </div>
                    </td>
                    <td data-label="AI Decision Gate">
                      {gate ? (
                        <div className="gate-cell">
                          <span className={`gate-pill ${getGateBadgeClass(gate)}`}>
                            {gate.replace(/_/g, ' ')}
                          </span>
                          {prob !== null && (
                            <span
                              className="probability-text"
                              style={{ color: prob >= 0.8 ? '#166534' : prob >= 0.5 ? '#92400e' : '#991b1b' }}
                            >
                              {(prob * 100).toFixed(0)}% viability
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="not-evaluated">Not evaluated</span>
                      )}
                    </td>
                    <td className="td-standalone-status" data-label="Status">
                      <span className={`status-pill status-${(tx.status || 'unknown').toLowerCase()}`}>
                        {(tx.status || 'unknown').replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td data-label="Action">
                      <div className="action-buttons" onClick={(e) => e.stopPropagation()}>
                        {tx.status === 'PENDING_APPROVAL' ? (
                          <button
                            className="btn btn-sm btn-outline"
                            onClick={() => setSelectedTx(tx)}
                            title="Review diagnosis and decide"
                          >
                            Resolve
                          </button>
                        ) : (tx.status === 'FAILED' || tx.status === 'STOPPED') ? (
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() => handleProcess(tx.id)}
                            disabled={processingId === tx.id || batchProcessing}
                            title="Run Groq AI diagnosis and Policy Gate"
                          >
                            {processingId === tx.id ? 'Thinking...' : 'AI Recover'}
                          </button>
                        ) : (
                          <button
                            className="btn btn-sm btn-outline"
                            onClick={() => setSelectedTx(tx)}
                            title="View transaction details"
                          >
                            View
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Rich AI Diagnosis & Transaction Details Modal */}
      {selectedTx && (
        <div className="modal-overlay" onClick={() => setSelectedTx(null)}>
          <div className="modal-content modal-content-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Autonomous AI Diagnosis & Recovery</h3>
                <span className="modal-subtitle code-cell">{selectedTx.id}</span>
              </div>
              <button className="modal-close-btn" onClick={() => setSelectedTx(null)}>
                ✕
              </button>
            </div>

            <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto', overflowX: 'hidden' }}>
              {/* Telemetry Summary Header */}
              <div className="modal-grid">
                <div className="modal-info-group">
                  <span className="modal-label">Customer</span>
                  <span className="modal-val font-bold">{selectedTx.customer_name || 'Customer'}</span>
                </div>
                <div className="modal-info-group">
                  <span className="modal-label">Amount</span>
                  <span className="modal-val font-bold text-green" style={{ fontSize: '18px' }}>
                    ₹{Number(selectedTx.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="modal-info-group">
                  <span className="modal-label">Status</span>
                  <span className={`status-pill status-${(selectedTx.status || 'unknown').toLowerCase()}`}>
                    {selectedTx.status}
                  </span>
                </div>
                <div className="modal-info-group">
                  <span className="modal-label">Retry Attempts</span>
                  <span className="modal-val">{selectedTx.retry_count || 0} attempt(s)</span>
                </div>
                <div className="modal-info-group">
                  <span className="modal-label">Past Successes</span>
                  <span className="modal-val">{selectedTx.past_success_count || 0} order(s)</span>
                </div>
                <div className="modal-info-group">
                  <span className="modal-label">Gateway Decline Code</span>
                  <span className="modal-val font-bold" style={{ wordBreak: 'break-word' }}>
                    {selectedTx.decline_code}
                  </span>
                </div>
              </div>

              {/* 1. Cognitive AI Diagnosis Block */}
              <div className="modal-section-box" style={{ background: '#f8fafc', borderLeft: '4px solid #3b82f6', marginTop: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span className="modal-label" style={{ color: '#1e40af', fontWeight: '700', fontSize: '13px' }}>
                    Cognitive LLM Diagnosis (ISO-8583 Mapping)
                  </span>
                  {selectedTx.recovery_probability !== null && selectedTx.recovery_probability !== undefined && (
                    <span className="status-pill" style={{ background: '#dbeafe', color: '#1e40af', fontWeight: '700' }}>
                      P(recovery): {(Number(selectedTx.recovery_probability) * 100).toFixed(0)}%
                    </span>
                  )}
                </div>

                {selectedTx.iso_code && (
                  <p style={{ margin: '0 0 6px 0', fontSize: '13px', fontWeight: '600', color: '#334155' }}>
                    Standard: <span style={{ fontFamily: 'monospace', color: '#0284c7' }}>{selectedTx.iso_code}</span>
                  </p>
                )}

                <p style={{ margin: '0 0 6px 0', fontSize: '14px', color: '#1e293b' }}>
                  <strong>Root Cause:</strong> {selectedTx.root_cause || selectedTx.ai_reasoning?.root_cause || 'Click "AI Recover" to diagnose root cause with Groq LLM.'}
                </p>

                {selectedTx.ai_reasoning?.reasoning_summary && (
                  <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748b', fontStyle: 'italic' }}>
                    Reasoning: {selectedTx.ai_reasoning.reasoning_summary}
                  </p>
                )}
              </div>

              {/* 2. Deterministic Policy Gate Block */}
              <div className="modal-section-box" style={{ background: '#fcfaf6', borderLeft: '4px solid #f59e0b', marginTop: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span className="modal-label" style={{ color: '#b45309', fontWeight: '700', fontSize: '13px' }}>
                    Deterministic Safety Policy Gate
                  </span>
                  {selectedTx.gate_decision && (
                    <span className={`gate-pill ${getGateBadgeClass(selectedTx.gate_decision)}`}>
                      {selectedTx.gate_decision}
                    </span>
                  )}
                </div>
                <p style={{ margin: '0', fontSize: '13px', color: '#451a03' }}>
                  {selectedTx.policy_reason || selectedTx.ai_reasoning?.policy_reason || 'Safety rules evaluate amount thresholds (₹10,000 cap), fraud checks, and retry limits before link generation.'}
                </p>
              </div>

              {/* 3. Culturally Tuned Hinglish Customer Outreach */}
              {(selectedTx.customer_message_hinglish || selectedTx.ai_reasoning?.customer_message_hinglish) && (
                <div className="modal-section-box" style={{ background: '#f0fdf4', borderLeft: '4px solid #10b981', marginTop: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span className="modal-label" style={{ color: '#047857', fontWeight: '700', fontSize: '13px' }}>
                      Drafted Customer Outreach (Hinglish / English)
                    </span>
                    <button
                      className="btn btn-sm btn-outline"
                      style={{ fontSize: '11px', padding: '2px 8px' }}
                      onClick={() => copyToClipboard(selectedTx.customer_message_hinglish || selectedTx.ai_reasoning?.customer_message_hinglish, 'msg')}
                    >
                      {copiedId === 'msg' ? '✓ Copied' : 'Copy Text'}
                    </button>
                  </div>
                  <p style={{ margin: '0 0 6px 0', fontSize: '13px', color: '#064e3b', background: '#ffffff', padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1fae5' }}>
                    "{selectedTx.customer_message_hinglish || selectedTx.ai_reasoning?.customer_message_hinglish}"
                  </p>
                  {selectedTx.customer_message_english && (
                    <p style={{ margin: '0', fontSize: '12px', color: '#475569' }}>
                      <em>EN:</em> "{selectedTx.customer_message_english}"
                    </p>
                  )}
                </div>
              )}

              {/* 4. Razorpay Recovery Payment Link */}
              {selectedTx.payment_link_url && (
                <div className="modal-section-box highlight-box" style={{ marginTop: '12px' }}>
                  <span className="modal-label text-green" style={{ fontWeight: '700' }}>
                    Razorpay Checkout Link
                  </span>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '6px' }}>
                    <input
                      type="text"
                      readOnly
                      value={resolveCheckoutUrl(selectedTx.payment_link_url)}
                      className="tx-search-input"
                      style={{ fontSize: '13px', background: '#ffffff', fontFamily: 'monospace' }}
                    />
                    <button
                      className="btn btn-sm btn-outline"
                      onClick={() => copyToClipboard(resolveCheckoutUrl(selectedTx.payment_link_url), 'modal_link')}
                    >
                      {copiedId === 'modal_link' ? '✓ Copied' : 'Copy Link'}
                    </button>
                    <a
                      href={resolveCheckoutUrl(selectedTx.payment_link_url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-sm btn-primary"
                      style={{ textDecoration: 'none' }}
                    >
                      Open Checkout ?
                    </a>
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer" style={{ borderTop: '1px solid #e2e8f0', paddingTop: '12px' }}>
              {(selectedTx.status === 'FAILED' || selectedTx.status === 'STOPPED') && (
                <button
                  className="btn btn-primary"
                  onClick={() => handleProcess(selectedTx.id)}
                  disabled={processingId === selectedTx.id || batchProcessing}
                >
                  {processingId === selectedTx.id ? 'Running AI Engine...' : 'Run Autonomous AI Recovery'}
                </button>
              )}
              {selectedTx.status === 'PENDING_APPROVAL' && (
                <>
                  <button
                    className="btn btn-success"
                    onClick={() => handleApprove(selectedTx.id)}
                    disabled={processingId === selectedTx.id}
                  >
                    Approve Recovery Link
                  </button>
                  <button
                    className="btn btn-danger"
                    onClick={() => handleDecline(selectedTx.id)}
                    disabled={processingId === selectedTx.id}
                  >
                    Decline & Stop
                  </button>
                </>
              )}
              <button className="btn btn-outline" onClick={() => setSelectedTx(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
