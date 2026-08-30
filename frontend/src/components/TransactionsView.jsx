import { useState, useMemo } from 'react';
import { api } from '../services/api';

export default function TransactionsView({
  transactions = [],
  loading = false,
  onRefresh,
  onSeed,
  setMessage
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedTx, setSelectedTx] = useState(null);
  const [processingId, setProcessingId] = useState(null);
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

    return {
      totalCount,
      totalAmount,
      recoveredCount: recovered.length,
      recoveredAmount,
      pendingCount: pending.length,
      linkSentCount: linkSent.length,
      failedCount: failed.length,
      stoppedCount: stopped.length,
    };
  }, [transactions]);

  // Filter transactions based on search query and status filter
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'STOPPED' && (tx.status === 'STOPPED' || tx.status === 'REFUSED')) ||
        tx.status === statusFilter;

      const query = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !query ||
        (tx.id && tx.id.toLowerCase().includes(query)) ||
        (tx.customer_name && tx.customer_name.toLowerCase().includes(query)) ||
        (tx.decline_code && tx.decline_code.toLowerCase().includes(query)) ||
        (tx.status && tx.status.toLowerCase().includes(query));

      return matchesStatus && matchesSearch;
    });
  }, [transactions, statusFilter, searchQuery]);

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleProcess = async (id) => {
    setProcessingId(id);
    try {
      const res = await api.processTransaction(id);
      setMessage({
        type: 'success',
        text: `Transaction ${id} processed! Gate Decision: ${res.data?.gate_decision || 'Evaluated'}`
      });
      if (selectedTx?.id === id) {
        setSelectedTx((prev) => ({ ...prev, ...res.data, status: res.data?.status || prev.status }));
      }
      if (onRefresh) onRefresh();
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Processing failed' });
    } finally {
      setProcessingId(null);
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
      setMessage({ type: 'success', text: `Transaction ${id} declined and stopped.` });
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

  return (
    <div className="tab-view">
      {/* Top Header */}
      <div className="view-header">
        <div>
          <h2 className="view-title">Merchant Transactions Ledger</h2>
          <p className="view-subtitle">
            Live telemetry of all customer transactions, dunning interventions, and autonomous recovery states
          </p>
        </div>
        <div className="header-actions-group">
          <button
            className="btn btn-outline"
            onClick={onRefresh}
            disabled={loading}
            title="Reload transaction list"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '6px' }}>
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
            </svg>
            Refresh
          </button>
          <button
            className="btn btn-primary"
            onClick={onSeed}
            disabled={loading}
            title="Seed synthetic transactions to test AI recovery"
          >
            {loading ? 'Processing...' : ' Seed 10 Test Cases'}
          </button>
        </div>
      </div>

      {/* Transaction Summary Metrics */}
      <div className="metrics-grid tx-metrics-grid">
        <div className="metric-card">
          <span className="metric-label">Total Transactions</span>
          <span className="metric-value">{stats.totalCount}</span>
          <span className="metric-sub">Volume: ₹{stats.totalAmount.toLocaleString()}</span>
        </div>

        <div className="metric-card metric-card-highlight">
          <span className="metric-label">Capital Recovered</span>
          <span className="metric-value text-green">₹{stats.recoveredAmount.toLocaleString()}</span>
          <span className="metric-sub">{stats.recoveredCount} payment(s) successfully won back</span>
        </div>

        <div className="metric-card">
          <span className="metric-label">In Dunning Pipeline</span>
          <span className="metric-value" style={{ color: '#2b6cb0' }}>{stats.linkSentCount}</span>
          <span className="metric-sub">Smart recovery payment links sent</span>
        </div>

        <div className="metric-card">
          <span className="metric-label">Pending Approval</span>
          <span className="metric-value" style={{ color: '#dd6b20' }}>{stats.pendingCount}</span>
          <span className="metric-sub">Awaiting merchant review</span>
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
            placeholder="Search by ID, customer name, decline code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="clear-search-btn" onClick={() => setSearchQuery('')}>
              ×
            </button>
          )}
        </div>

        {/* Status Filter Pills */}
        <div className="tx-status-filters">
          {[
            { key: 'ALL', label: 'All', count: stats.totalCount },
            { key: 'RECOVERED', label: 'Recovered', count: stats.recoveredCount },
            { key: 'LINK_SENT', label: 'Link Sent', count: stats.linkSentCount },
            { key: 'PENDING_APPROVAL', label: 'Pending Approval', count: stats.pendingCount },
            { key: 'FAILED', label: 'Failed', count: stats.failedCount },
            { key: 'STOPPED', label: 'Stopped / Refused', count: stats.stoppedCount },
          ].map((item) => (
            <button
              key={item.key}
              className={`filter-pill ${statusFilter === item.key ? 'filter-pill-active' : ''}`}
              onClick={() => setStatusFilter(item.key)}
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
              <p style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>No transactions recorded in your account yet.</p>
              <p style={{ marginBottom: '16px' }}>Click below to seed synthetic merchant transactions and test the real-time AI recovery engine.</p>
              <button className="btn btn-primary" onClick={onSeed} disabled={loading}>
                {loading ? 'Processing...' : ' Seed 10 Test Cases'}
              </button>
            </div>
          ) : (
            <div>
              <p>No transactions match your current search and filter criteria.</p>
              <button className="btn btn-outline" style={{ marginTop: '12px' }} onClick={() => { setSearchQuery(''); setStatusFilter('ALL'); }}>
                Reset Filters
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Transaction ID</th>
                <th>Customer Name</th>
                <th>Amount</th>
                <th>Decline Reason</th>
                <th>Attempts</th>
                <th>Status</th>
                <th>Timestamp</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.map((tx) => (
                <tr key={tx.id} className="tx-row" onClick={() => setSelectedTx(tx)}>
                  <td className="code-cell">
                    <span className="tx-id-badge" title="Click to copy full ID" onClick={(e) => { e.stopPropagation(); copyToClipboard(tx.id, tx.id); }}>
                      {tx.id.slice(0, 10)}...
                      <span className="copy-indicator">{copiedId === tx.id ? '✓ Copied' : '📋'}</span>
                    </span>
                  </td>
                  <td>
                    {tx.customer_name ? (
                      <div className="customer-cell">
                        <div className="customer-avatar-sm">
                          {tx.customer_name.charAt(0).toUpperCase()}
                        </div>
                        <span className="customer-name font-bold">{tx.customer_name}</span>
                      </div>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="font-bold text-amount">
                    ₹{Number(tx.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td>
                    <span className={`badge-decline badge-${(tx.decline_code || 'generic').toLowerCase()}`}>
                      {formatDeclineCode(tx.decline_code)}
                    </span>
                  </td>
                  <td>
                    <span className="attempt-badge">
                      Retry: <strong>{tx.retry_count || 0}</strong> | Past: <strong>{tx.past_success_count || 0}</strong>
                    </span>
                  </td>
                  <td>
                    <span className={`status-pill status-${(tx.status || 'unknown').toLowerCase()}`}>
                      {tx.status}
                    </span>
                  </td>
                  <td className="text-muted">
                    {new Date(tx.created_at || Date.now()).toLocaleString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </td>
                  <td>
                    <div className="action-buttons" onClick={(e) => e.stopPropagation()}>
                      <button
                        className="btn btn-sm btn-outline"
                        onClick={() => setSelectedTx(tx)}
                        title="View complete transaction breakdown"
                      >
                        Inspect
                      </button>
                      {(tx.status === 'FAILED' || tx.status === 'STOPPED') && (
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => handleProcess(tx.id)}
                          disabled={processingId === tx.id}
                          title="Run AI Diagnosis and Recovery"
                        >
                          {processingId === tx.id ? '...' : 'AI Recover'}
                        </button>
                      )}
                      {tx.status === 'PENDING_APPROVAL' && (
                        <>
                          <button
                            className="btn btn-sm btn-success"
                            onClick={() => handleApprove(tx.id)}
                            disabled={processingId === tx.id}
                            title="Approve recovery link"
                          >
                            Approve
                          </button>
                          <button
                            className="btn btn-sm btn-danger"
                            onClick={() => handleDecline(tx.id)}
                            disabled={processingId === tx.id}
                            title="Stop recovery"
                          >
                            Decline
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Transaction Details Modal */}
      {selectedTx && (
        <div className="modal-overlay" onClick={() => setSelectedTx(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Transaction Details</h3>
                <span className="modal-subtitle code-cell">{selectedTx.id}</span>
              </div>
              <button className="modal-close-btn" onClick={() => setSelectedTx(null)}>
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div className="modal-grid">
                <div className="modal-info-group">
                  <span className="modal-label">Customer Name</span>
                  <span className="modal-val font-bold">{selectedTx.customer_name || 'Customer Name Unavailable'}</span>
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
                  <span className="modal-label">Decline Code</span>
                  <span className="modal-val font-bold">{selectedTx.decline_code}</span>
                </div>
                <div className="modal-info-group">
                  <span className="modal-label">Retry Attempts</span>
                  <span className="modal-val">{selectedTx.retry_count || 0} attempt(s)</span>
                </div>
                <div className="modal-info-group">
                  <span className="modal-label">Past Successful Orders</span>
                  <span className="modal-val">{selectedTx.past_success_count || 0} order(s)</span>
                </div>
              </div>

              {selectedTx.scenario && (
                <div className="modal-section-box">
                  <span className="modal-label">Scenario Context</span>
                  <p style={{ margin: '4px 0 0 0', fontSize: '14px' }}>{selectedTx.scenario}</p>
                </div>
              )}

              {selectedTx.payment_link_url && (
                <div className="modal-section-box highlight-box">
                  <span className="modal-label text-green">Razorpay Recovery Payment Link</span>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '6px' }}>
                    <input
                      type="text"
                      readOnly
                      value={selectedTx.payment_link_url}
                      className="tx-search-input"
                      style={{ fontSize: '13px', background: '#ffffff' }}
                    />
                    <button
                      className="btn btn-sm btn-outline"
                      onClick={() => copyToClipboard(selectedTx.payment_link_url, 'modal_link')}
                    >
                      {copiedId === 'modal_link' ? '✓ Copied' : 'Copy'}
                    </button>
                    <a
                      href={selectedTx.payment_link_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-sm btn-primary"
                      style={{ textDecoration: 'none' }}
                    >
                      Open
                    </a>
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              {(selectedTx.status === 'FAILED' || selectedTx.status === 'STOPPED') && (
                <button
                  className="btn btn-primary"
                  onClick={() => handleProcess(selectedTx.id)}
                  disabled={processingId === selectedTx.id}
                >
                  {processingId === selectedTx.id ? 'Processing...' : 'Run Autonomous AI Recovery'}
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
