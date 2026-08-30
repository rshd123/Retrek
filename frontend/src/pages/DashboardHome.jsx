import { useState, useEffect } from 'react';
import { api } from '../services/api';

export default function DashboardHome({ navigate, seedVersion }) {
  const [roiData, setRoiData] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [roiRes, txRes, appRes] = await Promise.all([
          api.getROI(),
          api.getTransactions(),
          api.getPendingApprovals(),
        ]);
        setRoiData(roiRes.data || roiRes);
        setTransactions(txRes.data || []);
        setApprovals(appRes.data || []);
      } catch (err) {
        console.error('Dashboard load error:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [seedVersion]);

  const totalRecovered = roiData?.recovered_amount || 0;
  const totalAtRisk = roiData?.total_at_risk || 0;
  const recoveryRate = roiData?.recovery_rate || 0;
  const pendingApprovals = approvals.length || 0;
  const totalTransactions = transactions.length || 0;

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
            {recoveryRate}%
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

      <div style={{ marginTop: 24, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <button className="btn btn-primary" onClick={() => navigate('/dashboard/transactions')}>
          View Transactions
        </button>
        <button className="btn btn-outline" onClick={() => navigate('/dashboard/approvals')} style={{ border: '1px solid rgba(23,79,67,0.2)', color: 'var(--text)' }}>
          Approvals Queue {pendingApprovals > 0 && `(${pendingApprovals})`}
        </button>
        <button className="btn btn-outline" onClick={() => navigate('/dashboard/roi')} style={{ border: '1px solid rgba(23,79,67,0.2)', color: 'var(--text)' }}>
          ROI & Metrics
        </button>
      </div>
    </div>
  );
}
