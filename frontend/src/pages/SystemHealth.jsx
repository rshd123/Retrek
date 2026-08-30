import { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';

const SERVICES = [
  { key: 'database', label: 'Supabase Database', provider: 'PostgreSQL' },
  { key: 'llm', label: 'Groq LLM Inference', provider: 'qwen/qwen3.6-27b' },
  { key: 'razorpay', label: 'Razorpay Payments', provider: 'REST API' },
];

export default function SystemHealth() {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [latencyHistory, setLatencyHistory] = useState({ database: [], llm: [], razorpay: [] });
  const intervalRef = useRef(null);

  const fetchHealth = async () => {
    try {
      const res = await api.getHealth();
      setHealth(res);
      setError(null);

      setLatencyHistory((prev) => {
        const next = { ...prev };
        for (const svc of ['database', 'llm', 'razorpay']) {
          const val = res.services?.[svc]?.latencyMs;
          if (val != null) {
            next[svc] = [...prev[svc].slice(-29), val];
          }
        }
        return next;
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    intervalRef.current = setInterval(fetchHealth, 10000);
    return () => clearInterval(intervalRef.current);
  }, []);

  const statusColor = (status) => {
    if (status === 'connected' || status === 'healthy') return '#38a169';
    if (status === 'degraded') return '#d69e2e';
    return '#e53e3e';
  };

  const statusBg = (status) => {
    if (status === 'connected' || status === 'healthy') return '#c6f6d5';
    if (status === 'degraded') return '#fefcbf';
    return '#fed7d7';
  };

  if (loading) {
    return (
      <div className="tab-view">
        <div className="empty-state">
          <div className="spinner" />
          <p>Checking system health...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="tab-view">
      <div className="view-header">
        <div>
          <h2 className="view-title">System Health & Diagnostics</h2>
          <p className="view-subtitle">Live service connectivity, latency monitoring, and configuration status</p>
        </div>
        <button className="btn btn-outline" onClick={fetchHealth} disabled={loading}>
          Refresh
        </button>
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

      {health && (
        <>
          {/* Overall Status */}
          <div style={{
            background: '#ffffff',
            border: `1px solid ${statusColor(health.status)}33`,
            borderRadius: '12px',
            padding: '20px 24px',
            marginBottom: '24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{
                width: '14px',
                height: '14px',
                borderRadius: '50%',
                background: statusColor(health.status),
                boxShadow: `0 0 8px ${statusColor(health.status)}66`,
              }} />
              <div>
                <span style={{ fontSize: '16px', fontWeight: '700', color: '#1f2937', textTransform: 'capitalize' }}>
                  System {health.status}
                </span>
                <span style={{ fontSize: '13px', color: '#64748b', marginLeft: '10px' }}>
                  {health.environment}
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '13px', color: '#64748b' }}>
                Uptime: <strong>{Math.floor((health.uptimeSeconds || 0) / 3600)}h {Math.floor(((health.uptimeSeconds || 0) % 3600) / 60)}m</strong>
              </span>
              <span style={{ fontSize: '13px', color: '#64748b' }}>
                Response: <strong>{health.responseTimeMs}ms</strong>
              </span>
              <span style={{ fontSize: '13px', color: '#64748b' }}>
                {new Date(health.timestamp).toLocaleTimeString()}
              </span>
            </div>
          </div>

          {/* Service Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '14px', marginBottom: '28px' }}>
            {SERVICES.map((svc) => {
              const data = health.services?.[svc.key];
              const status = data?.status || 'unknown';
              const latency = data?.latencyMs;
              const history = latencyHistory[svc.key] || [];
              const maxLatency = Math.max(...history, 1);

              return (
                <div key={svc.key} style={{
                  background: '#ffffff',
                  border: `1px solid ${statusColor(status)}33`,
                  borderRadius: '12px',
                  padding: '20px',
                }}>
                  {/* Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div>
                        <h4 style={{ fontSize: '14px', fontWeight: '700', color: '#1f2937' }}>{svc.label}</h4>
                        <span style={{ fontSize: '12px', color: '#94a3b8' }}>{svc.provider}</span>
                      </div>
                    </div>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: '700',
                      padding: '3px 10px',
                      borderRadius: '20px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      background: statusBg(status),
                      color: status === 'connected' ? '#22543d' : status === 'degraded' ? '#744210' : '#9b2c2c',
                    }}>
                      {status}
                    </span>
                  </div>

                  {/* Latency */}
                  <div style={{ marginBottom: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>Latency</span>
                      <span style={{ fontSize: '13px', fontWeight: '700', fontFamily: 'monospace', color: latency != null && latency < 500 ? '#38a169' : latency != null && latency < 2000 ? '#d69e2e' : '#e53e3e' }}>
                        {latency != null ? `${latency}ms` : '—'}
                      </span>
                    </div>
                    {/* Mini sparkline */}
                    {history.length > 1 && (
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '32px' }}>
                        {history.map((val, i) => (
                          <div key={i} style={{
                            flex: 1,
                            height: `${Math.max((val / maxLatency) * 100, 4)}%`,
                            background: val < 500 ? '#38a169' : val < 2000 ? '#d69e2e' : '#e53e3e',
                            borderRadius: '2px',
                            opacity: 0.3 + (i / history.length) * 0.7,
                          }} title={`${val}ms`} />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Extra info */}
                  {data?.error && (
                    <div style={{
                      fontSize: '12px',
                      color: '#c53030',
                      background: '#fff5f5',
                      borderRadius: '6px',
                      padding: '8px 10px',
                      marginTop: '8px',
                    }}>
                      {data.error}
                    </div>
                  )}
                  {data?.short_url && (
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                      Last link: <a href={data.short_url} target="_blank" rel="noopener noreferrer" style={{ color: '#3182ce' }}>{data.short_url}</a>
                    </div>
                  )}
                  {data?.model && (
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                      Model: {data.model}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* API Configuration */}
          <div style={{ marginBottom: '28px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '14px', color: 'var(--text)' }}>
              API Configuration
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
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '700', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#64748b' }}>Parameter</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '700', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#64748b' }}>Value</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '700', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#64748b' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { param: 'Supabase URL', value: health.services?.database?.status === 'connected' ? 'hzqymcakpfcgttewyleu.supabase.co' : '—', ok: health.services?.database?.status === 'connected' },
                    { param: 'Supabase Database', value: health.services?.database?.status === 'connected' ? `Connected (${health.services.database.latencyMs}ms)` : 'Disconnected', ok: health.services?.database?.status === 'connected' },
                    { param: 'Groq LLM Model', value: health.services?.llm?.model || 'qwen/qwen3.6-27b', ok: health.services?.llm?.status === 'connected' },
                    { param: 'Groq LLM API', value: health.services?.llm?.status === 'connected' ? `Connected (${health.services.llm.latencyMs}ms)` : 'Disconnected', ok: health.services?.llm?.status === 'connected' },
                    { param: 'Razorpay API', value: health.services?.razorpay?.status === 'connected' ? `Connected (${health.services.razorpay.latencyMs}ms)` : health.services?.razorpay?.error || 'Disconnected', ok: health.services?.razorpay?.status === 'connected' },
                    { param: 'Razorpay Mode', value: 'Test', ok: true },
                    { param: 'Webhook Secret', value: 'retrek_webhook_secret_123', ok: true },
                    { param: 'Backend URL', value: 'retrek-backend.vercel.app', ok: true },
                  ].map((row) => (
                    <tr key={row.param} style={{ borderBottom: '1px solid rgba(23, 79, 67, 0.06)' }}>
                      <td style={{ padding: '12px 16px', fontWeight: '600', color: '#1f2937' }}>{row.param}</td>
                      <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: '13px', color: '#475569' }}>{row.value}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        {row.ok ? (
                          <span style={{ color: '#38a169', fontWeight: '700' }}>✓</span>
                        ) : (
                          <span style={{ color: '#e53e3e', fontWeight: '700' }}>✗</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Latency History Table */}
          {Object.values(latencyHistory).some((h) => h.length > 0) && (
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '14px', color: 'var(--text)' }}>
                Latency History (Last 30 Pings)
              </h3>
              <div style={{
                background: '#ffffff',
                border: '1px solid rgba(23, 79, 67, 0.1)',
                borderRadius: '12px',
                overflow: 'hidden',
              }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#f8f7f1' }}>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '700', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#64748b' }}>Service</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '700', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#64748b' }}>Latest</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '700', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#64748b' }}>Avg</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '700', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#64748b' }}>Min</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '700', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#64748b' }}>Max</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '700', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#64748b', width: '30%' }}>Trend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {SERVICES.map((svc) => {
                      const history = latencyHistory[svc.key] || [];
                      if (history.length === 0) return null;
                      const latest = history[history.length - 1];
                      const avg = Math.round(history.reduce((a, b) => a + b, 0) / history.length);
                      const min = Math.min(...history);
                      const max = Math.max(...history);
                      const maxVal = max || 1;

                      return (
                        <tr key={svc.key} style={{ borderBottom: '1px solid rgba(23, 79, 67, 0.06)' }}>
                          <td style={{ padding: '12px 16px', fontWeight: '600' }}>
                            {svc.label}
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'monospace', fontWeight: '700' }}>
                            {latest}ms
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'monospace' }}>
                            {avg}ms
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'monospace', color: '#38a169' }}>
                            {min}ms
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'monospace', color: '#e53e3e' }}>
                            {max}ms
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1px', height: '20px' }}>
                              {history.slice(-20).map((val, i) => (
                                <div key={i} style={{
                                  flex: 1,
                                  height: `${Math.max((val / maxVal) * 100, 4)}%`,
                                  background: val < 500 ? '#38a169' : val < 2000 ? '#d69e2e' : '#e53e3e',
                                  borderRadius: '1px',
                                }} />
                              ))}
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
        </>
      )}
    </div>
  );
}
