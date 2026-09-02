import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useRefetchKey } from '../context/RealtimeContext';
import ScenarioBadge from '../components/ScenarioBadge';

function getDaysUntil(dateStr) {
  if (!dateStr) return null;
  const target = new Date(dateStr);
  const now = new Date();
  return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
}

function getAgingBucket(dateStr) {
  if (!dateStr) return 'current';
  const days = Math.abs(getDaysUntil(dateStr));
  if (days <= 30) return '0-30 days';
  if (days <= 60) return '31-60 days';
  return '60+ days';
}

const CARD_STYLE = {
  background: '#fff',
  border: '1px solid rgba(23, 79, 67, 0.1)',
  borderRadius: '12px',
  padding: '20px',
  marginBottom: '24px',
};

const TH_STYLE = {
  padding: '12px 16px',
  textAlign: 'left',
  fontWeight: '700',
  fontSize: '12px',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  color: '#64748b',
};

const TD_STYLE = {
  padding: '12px 16px',
  fontSize: '14px',
  borderBottom: '1px solid rgba(23, 79, 67, 0.06)',
};

export default function RecoveryTracker() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const refetchKey = useRefetchKey();

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.getTransactions();
        setTransactions(res.data || []);
      } catch (err) {
        console.error('Recovery tracker load error:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [refetchKey]);

  const ptpTxns = transactions.filter((tx) => tx.scenario_type === 'ptp_commitment');
  const mandateTxns = transactions.filter((tx) => tx.scenario_type === 'mandate_retry');
  const b2bTxns = transactions.filter((tx) => tx.scenario_type === 'b2b_receivables');

  const agingBuckets = { '0-30 days': [], '31-60 days': [], '60+ days': [] };
  b2bTxns.forEach((tx) => {
    const bucket = getAgingBucket(tx.created_at);
    agingBuckets[bucket]?.push(tx);
  });

  if (loading) {
    return (
      <div className="tab-view">
        <div className="empty-state">
          <div className="spinner" />
          <p>Loading recovery tracker...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="tab-view">
      <div className="view-header">
        <div>
          <h2 className="view-title">Recovery Tracker</h2>
          <p className="view-subtitle">Track PTP commitments, mandate retries, and B2B receivables aging</p>
        </div>
      </div>

      {/* PTP Commitments */}
      <div style={CARD_STYLE}>
        <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '14px', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <ScenarioBadge scenarioType="ptp_commitment" /> Promise-to-Pay Commitments
        </h3>
        {ptpTxns.length === 0 ? (
          <p style={{ color: '#64748b', fontSize: '14px' }}>No PTP commitments found. Seed data to see tracking.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
              <thead>
                <tr style={{ background: '#f8f7f1' }}>
                  <th style={TH_STYLE}>Customer</th>
                  <th style={TH_STYLE}>Amount</th>
                  <th style={TH_STYLE}>PTP Date</th>
                  <th style={TH_STYLE}>Days Until</th>
                  <th style={TH_STYLE}>Status</th>
                  <th style={TH_STYLE}>Recovery Status</th>
                </tr>
              </thead>
              <tbody>
                {ptpTxns.map((tx) => {
                  const days = getDaysUntil(tx.ptp_date);
                  const isOverdue = days !== null && days < 0;
                  const isDueSoon = days !== null && days >= 0 && days <= 3;
                  return (
                    <tr key={tx.id}>
                      <td style={TD_STYLE}>{tx.customer_name || '—'}</td>
                      <td style={{ ...TD_STYLE, fontWeight: '700' }}>₹{Number(tx.amount).toLocaleString('en-IN')}</td>
                      <td style={TD_STYLE}>{tx.ptp_date || '—'}</td>
                      <td style={{ ...TD_STYLE, color: isOverdue ? '#e53e3e' : isDueSoon ? '#d69e2e' : '#38a169', fontWeight: '700' }}>
                        {days === null ? '—' : isOverdue ? `${Math.abs(days)}d overdue` : days === 0 ? 'Today' : `${days}d`}
                      </td>
                      <td style={TD_STYLE}>
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: '600',
                          background: isOverdue ? '#fed7d7' : isDueSoon ? '#fefcbf' : '#c6f6d5',
                          color: isOverdue ? '#c53030' : isDueSoon ? '#975a16' : '#276749',
                        }}>
                          {isOverdue ? 'Overdue' : isDueSoon ? 'Due Soon' : 'On Track'}
                        </span>
                      </td>
                      <td style={TD_STYLE}>
                        <span className={`status-pill status-${(tx.status || 'unknown').toLowerCase()}`}>
                          {(tx.status || 'unknown').replace(/_/g, ' ')}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Mandate Retry Schedule */}
      <div style={CARD_STYLE}>
        <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '14px', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <ScenarioBadge scenarioType="mandate_retry" /> Mandate Retry Schedule
        </h3>
        {mandateTxns.length === 0 ? (
          <p style={{ color: '#64748b', fontSize: '14px' }}>No mandate retries found. Seed data to see tracking.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
              <thead>
                <tr style={{ background: '#f8f7f1' }}>
                  <th style={TH_STYLE}>Customer</th>
                  <th style={TH_STYLE}>Amount</th>
                  <th style={TH_STYLE}>Retry Count</th>
                  <th style={TH_STYLE}>Next Retry At</th>
                  <th style={TH_STYLE}>Retry In</th>
                  <th style={TH_STYLE}>Status</th>
                </tr>
              </thead>
              <tbody>
                {mandateTxns.map((tx) => {
                  const days = getDaysUntil(tx.next_retry_at);
                  return (
                    <tr key={tx.id}>
                      <td style={TD_STYLE}>{tx.customer_name || '—'}</td>
                      <td style={{ ...TD_STYLE, fontWeight: '700' }}>₹{Number(tx.amount).toLocaleString('en-IN')}</td>
                      <td style={{ ...TD_STYLE, textAlign: 'center', fontWeight: '700' }}>{tx.retry_count || 0}</td>
                      <td style={TD_STYLE}>{tx.next_retry_at ? new Date(tx.next_retry_at).toLocaleString('en-IN') : '—'}</td>
                      <td style={{ ...TD_STYLE, color: days !== null && days <= 1 ? '#d69e2e' : '#475569', fontWeight: '600' }}>
                        {days === null ? '—' : days <= 0 ? 'Now' : `${days}d`}
                      </td>
                      <td style={TD_STYLE}>
                        <span className={`status-pill status-${(tx.status || 'unknown').toLowerCase()}`}>
                          {(tx.status || 'unknown').replace(/_/g, ' ')}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* B2B Receivables Aging */}
      <div style={CARD_STYLE}>
        <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '14px', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <ScenarioBadge scenarioType="b2b_receivables" /> B2B Receivables Aging
        </h3>
        {b2bTxns.length === 0 ? (
          <p style={{ color: '#64748b', fontSize: '14px' }}>No B2B receivables found. Seed data to see tracking.</p>
        ) : (
          <>
            {/* Aging Summary */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px', marginBottom: '20px' }}>
              {Object.entries(agingBuckets).map(([bucket, txns]) => {
                const total = txns.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
                return (
                  <div key={bucket} style={{
                    background: '#f8f7f1',
                    borderRadius: '8px',
                    padding: '12px',
                    textAlign: 'center',
                  }}>
                    <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: '#64748b', marginBottom: '4px' }}>{bucket}</div>
                    <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text)' }}>{txns.length}</div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>₹{Number(total).toLocaleString('en-IN')}</div>
                  </div>
                );
              })}
            </div>

            {/* Full Table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr style={{ background: '#f8f7f1' }}>
                    <th style={TH_STYLE}>Customer</th>
                    <th style={TH_STYLE}>Amount</th>
                    <th style={TH_STYLE}>Created</th>
                    <th style={TH_STYLE}>Aging</th>
                    <th style={TH_STYLE}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {b2bTxns.map((tx) => {
                    const bucket = getAgingBucket(tx.created_at);
                    return (
                      <tr key={tx.id}>
                        <td style={TD_STYLE}>{tx.customer_name || '—'}</td>
                        <td style={{ ...TD_STYLE, fontWeight: '700' }}>₹{Number(tx.amount).toLocaleString('en-IN')}</td>
                        <td style={TD_STYLE}>{tx.created_at ? new Date(tx.created_at).toLocaleDateString('en-IN') : '—'}</td>
                        <td style={TD_STYLE}>
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: '600',
                            background: bucket === '0-30 days' ? '#c6f6d5' : bucket === '31-60 days' ? '#fefcbf' : '#fed7d7',
                            color: bucket === '0-30 days' ? '#276749' : bucket === '31-60 days' ? '#975a16' : '#c53030',
                          }}>
                            {bucket}
                          </span>
                        </td>
                        <td style={TD_STYLE}>
                          <span className={`status-pill status-${(tx.status || 'unknown').toLowerCase()}`}>
                            {(tx.status || 'unknown').replace(/_/g, ' ')}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
