import { useState } from 'react';
import { api } from '../services/api';

const PILLAR_META = [
  { key: 'pillar_1_adversarial_safety', label: 'Adversarial Safety & Fraud Refusal', target: '100%' },
  { key: 'pillar_2_webhook_idempotency', label: 'Webhook Deduplication Rate', target: '100%' },
  { key: 'pillar_3_policy_latency', label: 'Policy Evaluation Latency', target: '< 50ms' },
  { key: 'pillar_4_audit_provenance', label: 'Audit Provenance Coverage', target: '100%' },
];

export default function BenchmarkPage() {
  const [report, setReport] = useState(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);

  const runBenchmark = async () => {
    setRunning(true);
    setError(null);
    setReport(null);
    try {
      const res = await api.runBenchmark();
      setReport(res.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setRunning(false);
    }
  };

  const loadCached = async () => {
    try {
      const res = await api.getBenchmarkResults();
      setReport(res.data);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="tab-view">
      <div className="view-header">
        <div>
          <h2 className="view-title">Benchmark & Evaluation</h2>
          <p className="view-subtitle">Automated evaluation suite across 4 core safety & performance pillars</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-outline" onClick={loadCached} disabled={running}>
            Load Last Run
          </button>
          <button className="btn btn-primary" onClick={runBenchmark} disabled={running}>
            {running ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="spinner" style={{ width: '14px', height: '14px' }} />
                Running...
              </span>
            ) : 'Run Live Benchmark'}
          </button>
        </div>
      </div>

      {error && (
        <div style={{
          background: '#fff5f5',
          border: '1px solid #fc8181',
          borderRadius: '10px',
          padding: '14px 18px',
          marginBottom: '24px',
          color: '#c53030',
          fontSize: '14px',
        }}>
          {error}
        </div>
      )}

      {running && (
        <div style={{
          background: '#ffffff',
          border: '1px solid rgba(23, 79, 67, 0.1)',
          borderRadius: '12px',
          padding: '40px',
          textAlign: 'center',
          marginBottom: '24px',
        }}>
          <div className="spinner" style={{ margin: '0 auto 16px' }} />
          <p style={{ fontSize: '15px', fontWeight: '600', color: '#475569' }}>
            Executing benchmark suite...
          </p>
          <p style={{ fontSize: '13px', color: '#94a3b8', marginTop: '6px' }}>
            Processing 10 test scenarios + webhook stress test + latency measurement
          </p>
        </div>
      )}

      {!running && !report && !error && (
        <div style={{
          background: '#ffffff',
          border: '1px solid rgba(23, 79, 67, 0.1)',
          borderRadius: '12px',
          padding: '48px',
          textAlign: 'center',
        }}>
          <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px', color: '#1f2937' }}>
            No Benchmark Data
          </h3>
          <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '20px' }}>
            Click "Run Live Benchmark" to execute the full evaluation suite.
          </p>
          <button className="btn btn-primary" onClick={runBenchmark}>
            Run Live Benchmark
          </button>
        </div>
      )}

      {report && (
        <>
          {/* Summary Bar */}
          <div style={{
            background: '#ffffff',
            border: '1px solid rgba(23, 79, 67, 0.1)',
            borderRadius: '12px',
            padding: '16px 20px',
            marginBottom: '24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '14px', color: '#64748b' }}>Run at</span>
              <span style={{ fontSize: '13px', fontWeight: '600', fontFamily: 'monospace' }}>
                {new Date(report.benchmark_timestamp).toLocaleString()}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '13px', color: '#64748b' }}>
                Duration: <strong>{((report.duration_ms || 0) / 1000).toFixed(1)}s</strong>
              </span>
              <span style={{ fontSize: '13px', color: '#64748b' }}>
                Scenarios: <strong>{report.metrics?.total_transactions || 0}</strong>
              </span>
              <span style={{ fontSize: '13px', color: '#64748b' }}>
                Revenue at Risk: <strong>₹{Number(report.metrics?.total_revenue_at_risk || 0).toLocaleString('en-IN')}</strong>
              </span>
            </div>
          </div>

          {/* 4 Evaluation Pillars */}
          <div style={{ marginBottom: '28px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '14px', color: 'var(--text)' }}>
              Evaluation Pillars
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
              {PILLAR_META.map((meta) => {
                const pillar = report.pillars?.[meta.key];
                const passed = pillar?.status === 'PASS';
                return (
                  <div key={meta.key} style={{
                    background: '#ffffff',
                    border: `1px solid ${passed ? 'rgba(56, 161, 105, 0.3)' : 'rgba(229, 62, 62, 0.3)'}`,
                    borderRadius: '12px',
                    padding: '18px',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                      <span style={{
                        fontSize: '11px',
                        fontWeight: '700',
                        padding: '3px 10px',
                        borderRadius: '20px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        background: passed ? '#c6f6d5' : '#fed7d7',
                        color: passed ? '#22543d' : '#9b2c2c',
                      }}>
                        {pillar?.status || 'N/A'}
                      </span>
                    </div>
                    <h4 style={{ fontSize: '14px', fontWeight: '700', color: '#1f2937', marginBottom: '6px' }}>
                      {meta.label}
                    </h4>
                    <div style={{ fontSize: '24px', fontWeight: '800', color: '#174f43', marginBottom: '4px' }}>
                      {pillar?.score || '—'}
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>
                      Target: {meta.target}
                    </div>
                    <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '8px', lineHeight: '1.5' }}>
                      {pillar?.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Revenue Breakdown */}
          <div style={{ marginBottom: '28px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '14px', color: 'var(--text)' }}>
              Revenue Recovery Breakdown
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '14px' }}>
              {[
                { label: 'Auto-Executed Revenue', value: report.metrics?.auto_executed_revenue || 0, color: '#38a169' },
                { label: 'Human-Approved Revenue', value: report.metrics?.human_approved_revenue || 0, color: '#d69e2e' },
                { label: 'Stopped (Fraud)', value: report.metrics?.stopped_revenue || 0, color: '#e53e3e' },
                { label: 'Recovery Yield', value: report.metrics?.recovery_yield_percent || '0%', color: '#3182ce', isPercent: true },
              ].map((item) => (
                <div key={item.label} style={{
                  background: '#ffffff',
                  border: '1px solid rgba(23, 79, 67, 0.1)',
                  borderRadius: '12px',
                  padding: '18px',
                }}>
                  <span style={{ fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#64748b' }}>
                    {item.label}
                  </span>
                  <div style={{ fontSize: '22px', fontWeight: '800', color: item.color, marginTop: '6px' }}>
                    {item.isPercent ? item.value : `₹${Number(item.value).toLocaleString('en-IN')}`}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Timing */}
          <div style={{ marginBottom: '28px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '14px', color: 'var(--text)' }}>
              Performance Timing
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '14px' }}>
              <div style={{
                background: '#ffffff',
                border: '1px solid rgba(23, 79, 67, 0.1)',
                borderRadius: '12px',
                padding: '18px',
              }}>
                <span style={{ fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#64748b' }}>
                  Avg Policy Latency
                </span>
                <div style={{ fontSize: '22px', fontWeight: '800', color: '#174f43', marginTop: '6px' }}>
                  {report.timing?.average_policy_latency_ms ?? '—'} ms
                </div>
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>SLA: &lt; 50ms</span>
              </div>
              <div style={{
                background: '#ffffff',
                border: '1px solid rgba(23, 79, 67, 0.1)',
                borderRadius: '12px',
                padding: '18px',
              }}>
                <span style={{ fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#64748b' }}>
                  Avg AI Inference Latency
                </span>
                <div style={{ fontSize: '22px', fontWeight: '800', color: '#3182ce', marginTop: '6px' }}>
                  {report.timing?.average_ai_latency_ms ?? '—'} ms
                </div>
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>Groq qwen3.6-27b</span>
              </div>
              <div style={{
                background: '#ffffff',
                border: '1px solid rgba(23, 79, 67, 0.1)',
                borderRadius: '12px',
                padding: '18px',
              }}>
                <span style={{ fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#64748b' }}>
                  Total Duration
                </span>
                <div style={{ fontSize: '22px', fontWeight: '800', color: '#174f43', marginTop: '6px' }}>
                  {((report.timing?.total_duration_ms || 0) / 1000).toFixed(1)}s
                </div>
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>End-to-end</span>
              </div>
            </div>
          </div>

          {/* Scenario Breakdown Table */}
          {report.scenarios?.length > 0 && (
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '14px', color: 'var(--text)' }}>
                Scenario Breakdown ({report.scenarios.length} test cases)
              </h3>
              <div style={{
                background: '#ffffff',
                border: '1px solid rgba(23, 79, 67, 0.1)',
                borderRadius: '12px',
                overflow: 'hidden',
              }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', minWidth: '900px' }}>
                    <thead>
                      <tr style={{ background: '#f8f7f1' }}>
                        {['ID', 'Customer', 'Amount', 'Decline Code', 'Recovery %', 'Gate Decision', 'Status', 'AI Latency', 'Policy Latency', 'Expected'].map((h) => (
                          <th key={h} style={{
                            padding: '12px 14px',
                            textAlign: h === 'Customer' || h === 'Decline Code' || h === 'Gate Decision' || h === 'Status' ? 'left' : 'right',
                            fontWeight: '700',
                            fontSize: '11px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                            color: '#64748b',
                            whiteSpace: 'nowrap',
                          }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {report.scenarios.map((sc, i) => (
                        <tr key={sc.transaction_id || i} style={{ borderBottom: '1px solid rgba(23, 79, 67, 0.06)' }}>
                          <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: '12px', fontWeight: '600' }}>
                            {sc.transaction_id}
                          </td>
                          <td style={{ padding: '10px 14px', fontWeight: '600' }}>
                            {sc.customer_name}
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: '700' }}>
                            ₹{Number(sc.amount).toLocaleString('en-IN')}
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <span style={{
                              fontSize: '11px',
                              fontWeight: '600',
                              padding: '2px 8px',
                              borderRadius: '6px',
                              background: '#f1f5f9',
                              color: '#475569',
                              fontFamily: 'monospace',
                            }}>
                              {sc.decline_code}
                            </span>
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: '700', color: sc.recovery_probability >= 0.8 ? '#38a169' : sc.recovery_probability >= 0.5 ? '#d69e2e' : '#e53e3e' }}>
                            {sc.recovery_probability != null ? `${(sc.recovery_probability * 100).toFixed(0)}%` : '—'}
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <span style={{
                              fontSize: '11px',
                              fontWeight: '700',
                              padding: '3px 10px',
                              borderRadius: '20px',
                              background: sc.gate_decision === 'AUTO_EXECUTE' ? '#c6f6d5' : sc.gate_decision === 'HUMAN_APPROVAL' ? '#fefcbf' : '#fed7d7',
                              color: sc.gate_decision === 'AUTO_EXECUTE' ? '#22543d' : sc.gate_decision === 'HUMAN_APPROVAL' ? '#744210' : '#9b2c2c',
                            }}>
                              {sc.gate_decision}
                            </span>
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <span style={{
                              fontSize: '11px',
                              fontWeight: '700',
                              padding: '3px 10px',
                              borderRadius: '20px',
                              background: sc.status === 'LINK_SENT' ? '#c6f6d5' : sc.status === 'PENDING_APPROVAL' ? '#fefcbf' : sc.status === 'STOPPED' ? '#fed7d7' : '#f1f5f9',
                              color: sc.status === 'LINK_SENT' ? '#22543d' : sc.status === 'PENDING_APPROVAL' ? '#744210' : sc.status === 'STOPPED' ? '#9b2c2c' : '#475569',
                            }}>
                              {sc.status}
                            </span>
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace', fontSize: '12px' }}>
                            {sc.ai_latency_ms != null ? `${sc.ai_latency_ms}ms` : '—'}
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace', fontSize: '12px' }}>
                            {sc.policy_latency_ms != null ? `${sc.policy_latency_ms}ms` : '—'}
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                            {sc.passed_expected ? (
                              <span style={{ color: '#38a169', fontWeight: '700', fontSize: '14px' }}>✓</span>
                            ) : (
                              <span style={{ color: '#e53e3e', fontWeight: '700', fontSize: '14px' }}>✗</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
