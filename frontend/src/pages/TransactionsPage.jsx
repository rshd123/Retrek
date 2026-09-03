import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { useRefetchKey } from '../context/RealtimeContext';
import TransactionsView from '../components/TransactionsView';

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const refetchKey = useRefetchKey();

  const loadTransactions = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const res = await api.getTransactions();
      setTransactions(res.data || []);
      if (isSilent) setMessage(null);
    } catch (err) {
      if (!isSilent) {
        setMessage({ type: 'error', text: err.message || 'Failed to fetch transactions' });
      }
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTransactions(false);
  }, [loadTransactions, refetchKey]);

  // Polling fallback: refresh silently every 5s without flashing error toasts
  useEffect(() => {
    const interval = setInterval(() => {
      loadTransactions(true);
    }, 5000);
    return () => clearInterval(interval);
  }, [loadTransactions]);

  const handleSeed = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await api.seedTransactions();
      setMessage({ type: 'success', text: res.message || 'Seeded 10 failure test scenarios into database.' });
      await loadTransactions();
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to seed transactions' });
      setLoading(false);
    }
  };

  return (
    <>
      {message && (
        <div className={`dash-alert ${message.type === 'error' ? 'dash-alert-error' : 'dash-alert-success'}`} style={{ marginBottom: '16px' }}>
          <span>{message.text}</span>
          <button
            onClick={() => setMessage(null)}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
          >
            ✕
          </button>
        </div>
      )}

      <TransactionsView
        transactions={transactions}
        loading={loading}
        onRefresh={loadTransactions}
        onSeed={handleSeed}
        setMessage={setMessage}
      />
    </>
  );
}
