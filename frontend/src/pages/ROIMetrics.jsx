import { useState, useEffect } from 'react';
import { api } from '../services/api';

export default function ROIMetrics() {
  const [roi, setRoi] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [roiRes, txRes] = await Promise.all([
          api.getROI(),
          api.getTransactions(),
        ]);
        setRoi(roiRes.data || roiRes);
        setTransactions(txRes.data || []);
      } catch (err) {
        console.error('ROI load error:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="tab-view">
        <div className="empty-state">
          <div className="spinner" />
          <p>Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (!roi) {
    return (
      <div className="tab-view">
        <div className="empty-state">
          <p>Failed to load ROI data.</p>
        </div>
      </div>
    );
  }

  // Derive decline code distribution
  const declineCodeMap = {};
  transactions.forEach((tx) => {
    const code = tx.decline_code || 'UNKNOWN';
    declineCodeMap[code] = (declineCodeMap[code] || 0) + 1;
  });
  const declineCodes = Object.entries(declineCodeMap)
    .sort((a, b) => b[1] - a[1]);

  // Derive status distribution
  const statusMap = {};
  transactions.forEach((tx) => {
    const s = tx.status || 'UNKNOWN';
    statusMap[s] = (statusMap[s] || 0) + 1;
  });

  const totalDecisions = (roi.autoExecuted || 0) + (roi.humanPending || 0) + (roi.stopped || 0);
  const autoPct = totalDecisions > 0 ? ((roi.autoExecuted / totalDecisions) * 100) : 0;
  const humanPct = totalDecisions > 0 ? ((roi.humanPending / totalDecisions) * 100) : 0;
  const stoppedPct = totalDecisions > 0 ? ((roi.stopped / totalDecisions) * 100) : 0;

  return (
    <div className="tab-view">
      <div className="view-header">
        <div>
          <h2 className="view-title">ROI & Recovery Analytics</h2>
          <p className="view-subtitle">Executive performance metrics and policy gate distribution</p>
        </div>
      </div>

      {/* Executive Summary */}
      <div className="metrics-grid" style={{ marginBottom: '28px' }}>
        <div className="metric-card metric-card-highlight">
          <span className="metric-label">Capital Recovered</span>
          <span className="metric-value text-green">
            ₹{Number(roi.totalRecovered || 0).toLocaleString('en-IN')}
          </span>
          <span className="metric-sub">{roi.recoveredCount || 0} payment(s) won back</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Total At Risk</span>
          <span className="metric-value">
            ₹{Number(roi.totalAmountAtRisk || 0).toLocaleString('en-IN')}
          </span>
          <span className="metric-sub">Across {roi.totalTransactions || 0} failed transactions</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Recovery Rate</span>
          <span className="metric-value">{roi.recoveryRate || '0%'}</span>
          <span className="metric-sub">Target: &gt; 40%</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Revenue Still At Risk</span>
          <span className="metric-value" style={{ color: '#dd6b20' }}>
            ₹{Number(roi.totalRevenueAtRisk || 0).toLocaleString('en-IN')}
          </span>
          <span className="metric-sub">Unrecovered amount</span>
        </div>
      </div>

      {/* Policy Gate Distribution */}
      <div style={{ marginBottom: '28px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '14px', color: 'var(--text)' }}>
          Policy Gate Distribution
        </h3>
        <div style={{
          background: '#ffffff',
          border: '1px solid rgba(23, 79, 67, 0.1)',
          borderRadius: '12px',
          padding: '20px',
        }}>
          {/* Visual bar */}
          <div style={{
            display: 'flex',
            height: '32px',
            borderRadius: '8px',
            overflow: 'hidden',
            marginBottom: '16px',
          }}>
            {autoPct > 0 && (
              <div style={{
                width: `${autoPct}%`,
                background: '#38a169',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: '12px',
                fontWeight: '700',
                minWidth: autoPct > 8 ? 'auto' : '0',
              }}>
                {autoPct > 8 && `${autoPct.toFixed(0)}%`}
              </div>
            )}
            {humanPct > 0 && (
              <div style={{
                width: `${humanPct}%`,
                background: '#d69e2e',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: '12px',
                fontWeight: '700',
                minWidth: humanPct > 8 ? 'auto' : '0',
              }}>
                {humanPct > 8 && `${humanPct.toFixed(0)}%`}
              </div>
            )}
            {stoppedPct > 0 && (
              <div style={{
                width: `${stoppedPct}%`,
                background: '#e53e3e',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: '12px',
                fontWeight: '700',
                minWidth: stoppedPct > 8 ? 'auto' : '0',
              }}>
                {stoppedPct > 8 && `${stoppedPct.toFixed(0)}%`}
              </div>
            )}
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#38a169' }} />
              <span style={{ fontSize: '13px', color: '#475569' }}>
                <strong>Auto-Execute</strong> — {roi.autoExecuted || 0} transactions
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#d69e2e' }} />
              <span style={{ fontSize: '13px', color: '#475569' }}>
                <strong>Human Review</strong> — {roi.humanPending || 0} transactions
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#e53e3e' }} />
              <span style={{ fontSize: '13px', color: '#475569' }}>
                <strong>Stopped</strong> — {roi.stopped || 0} transactions
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Recovery Funnel */}
      <div style={{ marginBottom: '28px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '14px', color: 'var(--text)' }}>
          Recovery Funnel
        </h3>
        <div style={{
          background: '#ffffff',
          border: '1px solid rgba(23, 79, 67, 0.1)',
          borderRadius: '12px',
          padding: '20px',
        }}>
          {[
            { label: 'Total Failed Transactions', value: roi.totalTransactions || 0, color: '#475569', width: '100%' },
            { label: 'AI Diagnosed (Processed)', value: totalDecisions, color: '#3182ce', width: '85%' },
            { label: 'Payment Link Sent', value: roi.linkSent || 0, color: '#2b6cb0', width: '65%' },
            { label: 'Recovered', value: roi.recoveredCount || 0, color: '#38a169', width: '45%' },
          ].map((step, i) => (
            <div key={i} style={{ marginBottom: i < 3 ? '8px' : 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: '13px', fontWeight: '600', color: '#475569' }}>{step.label}</span>
                <span style={{ fontSize: '13px', fontWeight: '700', color: step.color }}>{step.value}</span>
              </div>
              <div style={{
                height: '8px',
                background: '#f1f5f9',
                borderRadius: '4px',
                overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%',
                  width: step.width,
                  background: step.color,
                  borderRadius: '4px',
                  transition: 'width 0.5s ease',
                }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Decline Code Breakdown */}
      {declineCodes.length > 0 && (
        <div>
          <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '14px', color: 'var(--text)' }}>
            Decline Code Distribution
          </h3>
          <div style={{
            background: '#ffffff',
            border: '1px solid rgba(23, 79, 67, 0.1)',
            borderRadius: '12px',
            overflow: 'hidden',
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
              <thead>
                <tr style={{ background: '#f8f7f1' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '700', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#64748b' }}>Decline Code</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '700', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#64748b' }}>Count</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '700', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#64748b' }}>% of Total</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '700', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#64748b', width: '40%' }}>Distribution</th>
                </tr>
              </thead>
              <tbody>
                {declineCodes.map(([code, count]) => {
                  const pct = transactions.length > 0 ? (count / transactions.length) * 100 : 0;
                  return (
                    <tr key={code} style={{ borderBottom: '1px solid rgba(23, 79, 67, 0.06)' }}>
                      <td style={{ padding: '12px 16px', fontWeight: '600', fontFamily: 'monospace', fontSize: '13px' }}>
                        <span className={`badge-decline badge-${code.toLowerCase()}`}>
                          {code.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '700' }}>{count}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', color: '#64748b' }}>{pct.toFixed(1)}%</td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{
                          height: '6px',
                          background: '#f1f5f9',
                          borderRadius: '3px',
                          overflow: 'hidden',
                        }}>
                          <div style={{
                            height: '100%',
                            width: `${pct}%`,
                            background: '#174f43',
                            borderRadius: '3px',
                          }} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
