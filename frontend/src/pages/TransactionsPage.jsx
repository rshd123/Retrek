import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import TransactionsView from '../components/TransactionsView';

export default function TransactionsPage({ seedVersion }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);

  const loadTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getTransactions();
      setTransactions(res.data || []);
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to fetch transactions' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTransactions();
  }, [seedVersion, loadTransactions]);

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
