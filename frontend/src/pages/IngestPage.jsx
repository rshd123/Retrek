import { useState } from 'react';
import { api } from '../services/api';

const DECLINE_CODES = [
  { value: 'BANK_TIMEOUT_2FA', label: 'Bank Timeout (2FA)', desc: 'Bank did not respond during 2FA verification' },
  { value: 'BANK_TIMEOUT_GATEWAY', label: 'Bank Timeout (Gateway)', desc: 'Bank gateway connection timed out' },
  { value: 'INSUFFICIENT_FUNDS', label: 'Insufficient Funds', desc: 'Customer account has insufficient balance' },
  { value: 'SUSPECTED_FRAUD', label: 'Suspected Fraud', desc: 'Transaction flagged as potential fraud' },
  { value: 'STOLEN_CARD', label: 'Stolen Card', desc: 'Card reported stolen' },
  { value: 'EXPIRED_CARD', label: 'Expired Card', desc: 'Card has passed its expiry date' },
  { value: 'CARD_LIMIT_EXCEEDED', label: 'Card Limit Exceeded', desc: 'Transaction exceeds card spending limit' },
  { value: 'PAYMENT_GATEWAY_DOWN', label: 'Payment Gateway Down', desc: 'Gateway temporarily unavailable' },
  { value: 'ISSUER_DECLINED_GENERIC', label: 'Issuer Declined', desc: 'Bank declined without specific reason' },
  { value: 'MICRO_TRANSACTION_FAILED', label: 'Micro-Transaction Failed', desc: 'Small-value transaction processing failure' },
];

const SCENARIO_TYPES = [
  { value: 'payment_degradation', label: 'Payment Degradation', suggestedCodes: ['BANK_TIMEOUT_2FA', 'BANK_TIMEOUT_GATEWAY', 'INSUFFICIENT_FUNDS', 'SUSPECTED_FRAUD', 'EXPIRED_CARD', 'CARD_LIMIT_EXCEEDED', 'PAYMENT_GATEWAY_DOWN', 'ISSUER_DECLINED_GENERIC', 'MICRO_TRANSACTION_FAILED'] },
  { value: 'checkout_dropoff', label: 'Checkout Drop-off', suggestedCodes: ['CHECKOUT_ABANDONED', 'ISSUER_DECLINED_GENERIC'] },
  { value: 'subscription_failure', label: 'Subscription Failure', suggestedCodes: ['INSUFFICIENT_FUNDS', 'EXPIRED_CARD', 'ISSUER_DECLINED_GENERIC'] },
  { value: 'b2b_receivables', label: 'B2B Receivables', suggestedCodes: ['ISSUER_DECLINED_GENERIC', 'CARD_LIMIT_EXCEEDED'] },
  { value: 'mandate_retry', label: 'Mandate Retry', suggestedCodes: ['BANK_TIMEOUT_2FA', 'INSUFFICIENT_FUNDS', 'MANDATE_ACTIVATION_FAILED'] },
  { value: 'voice_recovery', label: 'Voice Recovery', suggestedCodes: ['BANK_TIMEOUT_GATEWAY', 'BANK_TIMEOUT_2FA', 'ISSUER_DECLINED_GENERIC'] },
  { value: 'ptp_commitment', label: 'Promise-to-Pay', suggestedCodes: ['INSUFFICIENT_FUNDS', 'ISSUER_DECLINED_GENERIC'] },
];

const INITIAL_FORM = {
  id: '',
  amount: '',
  decline_code: '',
  scenario_type: 'payment_degradation',
  customer_name: '',
  retry_count: 0,
  past_success_count: 0,
};

export default function IngestPage() {
  const [form, setForm] = useState(INITIAL_FORM);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [processResult, setProcessResult] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => {
      const updated = {
        ...prev,
        [name]: name === 'retry_count' || name === 'past_success_count'
          ? Math.max(0, parseInt(value, 10) || 0)
          : value,
      };
      if (name === 'scenario_type') {
        const scenario = SCENARIO_TYPES.find((s) => s.value === value);
        if (scenario && !scenario.suggestedCodes.includes(prev.decline_code)) {
          updated.decline_code = '';
        }
      }
      return updated;
    });
  };

  const generateId = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let id = 'pay_';
    for (let i = 0; i < 7; i++) id += chars.charAt(Math.floor(Math.random() * chars.length));
    return id;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    setProcessResult(null);

    const payload = {
      id: form.id || generateId(),
      amount: parseFloat(form.amount),
      decline_code: form.decline_code,
      scenario_type: form.scenario_type,
      customer_name: form.customer_name || 'Customer',
      retry_count: form.retry_count,
      past_success_count: form.past_success_count,
    };

    try {
      const res = await api.ingestTransaction(payload);
      setResult({ type: 'success', data: res });
      setForm(INITIAL_FORM);
    } catch (err) {
      setResult({ type: 'error', text: err.message || 'Ingestion failed' });
    } finally {
      setLoading(false);
    }
  };

  const handleIngestAndProcess = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    setProcessResult(null);

    const txId = form.id || generateId();
    const payload = {
      id: txId,
      amount: parseFloat(form.amount),
      decline_code: form.decline_code,
      scenario_type: form.scenario_type,
      customer_name: form.customer_name || 'Customer',
      retry_count: form.retry_count,
      past_success_count: form.past_success_count,
    };

    try {
      await api.ingestTransaction(payload);
      setResult({ type: 'success', text: `Transaction ${txId} ingested. Running AI diagnosis...` });

      const processRes = await api.processTransaction(txId);
      setProcessResult({ type: 'success', data: processRes.data });
      setForm(INITIAL_FORM);
    } catch (err) {
      if (!result) {
        setResult({ type: 'error', text: err.message || 'Ingest & process failed' });
      } else {
        setProcessResult({ type: 'error', text: err.message || 'AI processing failed' });
      }
    } finally {
      setLoading(false);
    }
  };

  const isFormValid = form.amount && form.decline_code;

  return (
    <>
      <div className="view-header">
        <div>
          <h1 className="view-title">Ingest Transaction</h1>
          <p className="view-subtitle">Manually input a failed payment for AI diagnosis</p>
        </div>
      </div>

      {result && (
        <div className={`dash-alert ${result.type === 'error' ? 'dash-alert-error' : 'dash-alert-success'}`} style={{ marginBottom: '16px' }}>
          <span>{result.text || `Transaction ${result.data?.data?.id} ingested successfully.`}</span>
          <button onClick={() => setResult(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
        </div>
      )}

      {processResult && (
        <div className={`dash-alert ${processResult.type === 'error' ? 'dash-alert-error' : 'dash-alert-success'}`} style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {processResult.type === 'success' ? (
              <>
                <strong>AI Diagnosis Complete</strong>
                <span>Gate Decision: <strong>{processResult.data?.gate_decision}</strong></span>
                <span>Recovery Probability: <strong>{processResult.data?.recovery_probability}</strong></span>
                <span>Root Cause: {processResult.data?.root_cause}</span>
                <span>Status: <strong>{processResult.data?.status}</strong></span>
                {processResult.data?.payment_link_url && (
                  <span>Payment Link: <a href={processResult.data.payment_link_url} target="_blank" rel="noopener noreferrer" style={{ color: '#2b7a3a' }}>{processResult.data.payment_link_url}</a></span>
                )}
              </>
            ) : (
              <span>{processResult.text}</span>
            )}
          </div>
          <button onClick={() => setProcessResult(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
        </div>
      )}

      <div style={{ maxWidth: 600 }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Transaction ID */}
          <div className="form-group">
            <label htmlFor="id">Transaction ID</label>
            <input
              id="id"
              name="id"
              type="text"
              placeholder="e.g. pay_Kx9281a (auto-generated if empty)"
              value={form.id}
              onChange={handleChange}
            />
          </div>

          {/* Scenario Type */}
          <div className="form-group">
            <label htmlFor="scenario_type">Scenario Type</label>
            <select
              id="scenario_type"
              name="scenario_type"
              value={form.scenario_type}
              onChange={handleChange}
              style={{
                height: 44,
                padding: '0 14px',
                border: '1px solid rgba(23, 79, 67, 0.2)',
                borderRadius: 8,
                fontSize: 15,
                background: '#fbfaf6',
                color: 'var(--text)',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              {SCENARIO_TYPES.map((st) => (
                <option key={st.value} value={st.value}>{st.label}</option>
              ))}
            </select>
          </div>

          {/* Amount */}
          <div className="form-group">
            <label htmlFor="amount">Amount (INR) *</label>
            <input
              id="amount"
              name="amount"
              type="number"
              min="1"
              step="0.01"
              placeholder="e.g. 2499.00"
              value={form.amount}
              onChange={handleChange}
              required
            />
          </div>

          {/* Decline Code */}
          <div className="form-group">
            <label htmlFor="decline_code">Decline Code *</label>
            <select
              id="decline_code"
              name="decline_code"
              value={form.decline_code}
              onChange={handleChange}
              required
              style={{
                height: 44,
                padding: '0 14px',
                border: '1px solid rgba(23, 79, 67, 0.2)',
                borderRadius: 8,
                fontSize: 15,
                background: '#fbfaf6',
                color: 'var(--text)',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="">Select decline code...</option>
              {(() => {
                const scenario = SCENARIO_TYPES.find((s) => s.value === form.scenario_type);
                const suggested = scenario?.suggestedCodes || [];
                const suggestedCodes = DECLINE_CODES.filter((dc) => suggested.includes(dc.value));
                const otherCodes = DECLINE_CODES.filter((dc) => !suggested.includes(dc.value));
                return (
                  <>
                    {suggestedCodes.length > 0 && (
                      <optgroup label={`Suggested for ${scenario.label}`}>
                        {suggestedCodes.map((dc) => (
                          <option key={dc.value} value={dc.value}>{dc.label}</option>
                        ))}
                      </optgroup>
                    )}
                    {otherCodes.length > 0 && (
                      <optgroup label="Other codes">
                        {otherCodes.map((dc) => (
                          <option key={dc.value} value={dc.value}>{dc.label}</option>
                        ))}
                      </optgroup>
                    )}
                  </>
                );
              })()}
            </select>
            {form.decline_code && (
              <span style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                {DECLINE_CODES.find((dc) => dc.value === form.decline_code)?.desc || 'Custom decline code'}
              </span>
            )}
          </div>

          {/* Customer Name */}
          <div className="form-group">
            <label htmlFor="customer_name">Customer Name</label>
            <input
              id="customer_name"
              name="customer_name"
              type="text"
              placeholder="e.g. Rahul Sharma"
              value={form.customer_name}
              onChange={handleChange}
            />
          </div>

          {/* Retry Count & Past Success Count */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="form-group">
              <label htmlFor="retry_count">Retry Count</label>
              <input
                id="retry_count"
                name="retry_count"
                type="number"
                min="0"
                max="10"
                value={form.retry_count}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label htmlFor="past_success_count">Past Success Count</label>
              <input
                id="past_success_count"
                name="past_success_count"
                type="number"
                min="0"
                max="100"
                value={form.past_success_count}
                onChange={handleChange}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || !isFormValid}
              style={{ height: 44, flex: 1, fontSize: 15, fontWeight: 700 }}
            >
              {loading ? 'Ingesting...' : 'Ingest Only'}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={loading || !isFormValid}
              onClick={handleIngestAndProcess}
              style={{ height: 44, flex: 1, fontSize: 15, fontWeight: 700, background: '#174f43' }}
            >
              {loading ? 'Processing...' : 'Ingest & Run AI'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
