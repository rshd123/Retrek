import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useRefetchKey } from '../context/RealtimeContext';
import ScenarioBadge from '../components/ScenarioBadge';

const SCENARIO_ORDER = [
  'payment_degradation',
  'checkout_dropoff',
  'subscription_failure',
  'b2b_receivables',
  'mandate_retry',
  'voice_recovery',
  'ptp_commitment',
];

export default function DashboardHome({ navigate }) {
  const [roiData, setRoiData] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [scenarioData, setScenarioData] = useState(null);
  const [loading, setLoading] = useState(true);
  const refetchKey = useRefetchKey();

  useEffect(() => {
    const load = async () => {
      try {
        const [roiRes, txRes, appRes, scRes] = await Promise.allSettled([
          api.getROI(),
          api.getTransactions(),
          api.getPendingApprovals(),
          api.getScenarioStats(),
        ]);
        if (roiRes.status === 'fulfilled') setRoiData(roiRes.value.data || roiRes.value);
        if (txRes.status === 'fulfilled') setTransactions(txRes.value.data || []);
        if (appRes.status === 'fulfilled') setApprovals(appRes.value.data || []);
        if (scRes.status === 'fulfilled') setScenarioData(scRes.value.data || scRes.value);
      } catch (err) {
        console.error('Dashboard load error:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [refetchKey]);

  const totalRecovered = roiData?.totalRecovered || roiData?.recovered_amount || 0;
  const totalAtRisk = roiData?.totalRevenueAtRisk || roiData?.total_at_risk || 0;
  const recoveryRate = roiData?.recoveryRate || roiData?.recovery_rate || '0%';
  const recoveryRateDisplay = typeof recoveryRate === 'string' && recoveryRate.includes('%') ? recoveryRate : `${recoveryRate}%`;
  const pendingApprovals = approvals.length || 0;
  const totalTransactions = transactions.length || 0;

  const scenarios = scenarioData?.scenarios || [];
  const scenarioMap = {};
  scenarios.forEach((s) => { scenarioMap[s.type] = s; });

  if (loading) {
    return (
      <div className="tab-view">
        <div className="empty-state">
          <div className="spinner" />
          <p>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="tab-view">
      <div className="view-header">
        <div>
          <h2 className="view-title">Dashboard Overview</h2>
          <p className="view-subtitle">Welcome to Retrek — your autonomous payment recovery command center</p>
        </div>
      </div>

      <div className="metrics-grid">
        <div className="metric-card metric-card-highlight">
          <span className="metric-label">Capital Recovered</span>
          <span className="metric-value text-green">
            ₹{Number(totalRecovered).toLocaleString()}
          </span>
          <span className="metric-sub">Recovered via smart links</span>
        </div>

        <div className="metric-card">
          <span className="metric-label">Total At Risk</span>
          <span className="metric-value">
            ₹{Number(totalAtRisk).toLocaleString()}
          </span>
          <span className="metric-sub">Across failed transactions</span>
        </div>

        <div className="metric-card">
          <span className="metric-label">Recovery Rate</span>
          <span className="metric-value">
            {recoveryRateDisplay}
          </span>
          <span className="metric-sub">Target: &gt; 40%</span>
        </div>

        <div className="metric-card">
          <span className="metric-label">Pending Approvals</span>
          <span className="metric-value">{pendingApprovals}</span>
          <span className="metric-sub">Awaiting operator review</span>
        </div>

        <div className="metric-card">
          <span className="metric-label">Total Transactions</span>
          <span className="metric-value">{totalTransactions}</span>
          <span className="metric-sub">Processed through pipeline</span>
        </div>
      </div>

      {/* Scenario Breakdown */}
      {SCENARIO_ORDER.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '14px', color: 'var(--text)' }}>
            Scenario Breakdown
          </h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: '12px',
          }}>
            {SCENARIO_ORDER.map((type) => {
              const s = scenarioMap[type];
              const count = s?.count || 0;
              const recovered = s?.recovered_count || 0;
              const amount = s?.recovered_amount || 0;
              const rate = count > 0 ? ((recovered / count) * 100).toFixed(0) : '0';

              return (
                <div
                  key={type}
                  style={{
                    background: '#fff',
                    border: '1px solid rgba(23, 79, 67, 0.1)',
                    borderRadius: '12px',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  <ScenarioBadge scenarioType={type} />
                  <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text)' }}>
                    {count}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                    {recovered} recovered · ₹{Number(amount).toLocaleString('en-IN')}
                  </div>
                  <div style={{
                    height: '4px',
                    background: '#f1f5f9',
                    borderRadius: '2px',
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      height: '100%',
                      width: `${rate}%`,
                      background: count > 0 ? '#38a169' : '#e2e8f0',
                      borderRadius: '2px',
                      transition: 'width 0.5s ease',
                    }} />
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>
                    {rate}% recovery rate
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ marginTop: 24, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <button className="btn btn-primary" onClick={() => navigate('/dashboard/transactions')}>
          View Transactions
        </button>
        <button className="btn btn-outline" onClick={() => navigate('/dashboard/roi')} style={{ border: '1px solid rgba(23,79,67,0.2)', color: 'var(--text)' }}>
          ROI & Metrics
        </button>
      </div>
    </div>
  );
}
